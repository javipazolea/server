// routes/divisas.js - Integración simplificada del sistema de divisas
const express = require("express");
const axios = require("axios");
const db = require("../utils/db");

const router = express.Router();

// Configuración del Banco Central
const BCCH_CONFIG = {
  baseURL: "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx",
  user: process.env.BCCH_USER || "j.olea@duocuc.cl",
  password: process.env.BCCH_PASSWORD || "Jungkook97$",
};

// Códigos de series del Banco Central
const SERIES_CODES = {
  USD: "F073.TCO.PRE.Z.D",
  EUR: "F072.CLP.EUR.N.O.D",
  UF: "F073.UF.CLP.Z.D",
  UTM: "F073.UTM.CLP.Z.D",
  GBP: "F072.CLP.GBP.N.O.D",
  JPY: "F072.CLP.JPY.N.O.D",
};

// GET /api/divisas - Información del servicio
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Servicio de Conversión de Divisas - Ferremas",
    version: "1.0.0",
    description:
      "API para conversión de divisas usando datos oficiales del Banco Central de Chile",
    endpoints: {
      "GET /api/divisas/rates": "Obtener todos los tipos de cambio actuales",
      "GET /api/divisas/rates/:currency": "Obtener tipo de cambio específico",
      "POST /api/divisas/convert": "Convertir entre monedas",
      "GET /api/divisas/health": "Estado de salud del servicio",
      "GET /api/divisas/test-connection": "Probar conexión con Banco Central",
    },
    supportedCurrencies: Object.keys(SERIES_CODES).concat(["CLP"]),
    dataSource: "Banco Central de Chile",
  });
});

// GET /api/divisas/rates - Obtener todos los tipos de cambio
router.get("/rates", async (req, res) => {
  try {
    console.log("🔄 Obteniendo tipos de cambio...");

    // Obtener rates desde caché
    const [cachedRates] = await db.query(`
      SELECT currency, exchange_rate, rate_date, updated_at
      FROM ferremas_db.currency_rates 
      WHERE rate_date = CURDATE()
        AND updated_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)
      ORDER BY updated_at DESC
    `);

    if (cachedRates.length > 0) {
      console.log("✅ Devolviendo rates desde caché");
      const rates = {};
      rates.CLP = {
        currency: "CLP",
        value: 1,
        date: new Date().toISOString().split("T")[0],
        source: "BASE",
      };

      cachedRates.forEach((rate) => {
        rates[rate.currency] = {
          currency: rate.currency,
          value: parseFloat(rate.exchange_rate),
          date: rate.rate_date,
          source: "CACHE",
        };
      });

      return res.json({
        success: true,
        message: "Tipos de cambio obtenidos desde caché",
        data: { rates },
      });
    }

    // Si no hay cache, obtener desde BCCH
    console.log("📡 Obteniendo desde Banco Central...");
    const rates = {
      CLP: {
        currency: "CLP",
        value: 1,
        date: new Date().toISOString().split("T")[0],
        source: "BASE",
      },
    };

    for (const [currency, seriesCode] of Object.entries(SERIES_CODES)) {
      try {
        const rate = await fetchRateFromBCCH(seriesCode, currency);
        if (rate.success) {
          rates[currency] = {
            currency,
            value: rate.value,
            date: rate.date,
            source: "BCCH_API",
          };

          // Guardar en caché
          await saveRateToCache(currency, rate.value, rate.date);
        }
      } catch (error) {
        console.warn(`⚠️ Error obteniendo ${currency}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: "Tipos de cambio obtenidos correctamente",
      data: { rates },
    });
  } catch (error) {
    console.error("❌ Error al obtener tipos de cambio:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/divisas/rates/:currency - Obtener tipo específico
router.get("/rates/:currency", async (req, res) => {
  try {
    const { currency } = req.params;
    const currencyUpper = currency.toUpperCase();

    console.log(`🔄 Obteniendo tipo de cambio para ${currencyUpper}...`);

    if (currencyUpper === "CLP") {
      return res.json({
        success: true,
        data: {
          currency: "CLP",
          value: 1,
          date: new Date().toISOString().split("T")[0],
          source: "BASE_CURRENCY",
        },
      });
    }

    if (!SERIES_CODES[currencyUpper]) {
      return res.status(404).json({
        success: false,
        message: `Moneda ${currencyUpper} no soportada`,
        supportedCurrencies: Object.keys(SERIES_CODES).concat(["CLP"]),
      });
    }

    // Verificar caché
    const [cached] = await db.query(
      `
      SELECT exchange_rate, rate_date 
      FROM ferremas_db.currency_rates 
      WHERE currency = ? AND rate_date = CURDATE()
        AND updated_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)
      ORDER BY updated_at DESC LIMIT 1
    `,
      [currencyUpper]
    );

    if (cached.length > 0) {
      console.log(`✅ ${currencyUpper} desde caché`);
      return res.json({
        success: true,
        data: {
          currency: currencyUpper,
          value: parseFloat(cached[0].exchange_rate),
          date: cached[0].rate_date,
          source: "CACHE",
        },
      });
    }

    // Obtener desde BCCH
    const rate = await fetchRateFromBCCH(
      SERIES_CODES[currencyUpper],
      currencyUpper
    );

    if (!rate.success) {
      return res.status(502).json({
        success: false,
        message: `Error al obtener ${currencyUpper} desde Banco Central`,
        error: rate.error,
      });
    }

    // Guardar en caché
    await saveRateToCache(currencyUpper, rate.value, rate.date);

    res.json({
      success: true,
      data: {
        currency: currencyUpper,
        value: rate.value,
        date: rate.date,
        source: "BCCH_API",
      },
    });
  } catch (error) {
    console.error(`❌ Error obteniendo ${req.params.currency}:`, error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// POST /api/divisas/convert - Convertir entre monedas
router.post("/convert", async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    // Validaciones
    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        message: "Campos requeridos: amount, fromCurrency, toCurrency",
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "El monto debe ser un número positivo",
      });
    }

    const fromCurr = fromCurrency.toUpperCase();
    const toCurr = toCurrency.toUpperCase();

    console.log(`🔄 Convirtiendo ${amount} ${fromCurr} → ${toCurr}...`);

    // Si es la misma moneda
    if (fromCurr === toCurr) {
      return res.json({
        success: true,
        data: {
          originalAmount: parseFloat(amount),
          convertedAmount: parseFloat(amount),
          fromCurrency: fromCurr,
          toCurrency: toCurr,
          exchangeRate: 1,
          conversionDate: new Date().toISOString().split("T")[0],
        },
      });
    }

    // Obtener tipos de cambio
    const rates = {};

    // Obtener rate FROM
    if (fromCurr !== "CLP") {
      const fromRate = await getRateValue(fromCurr);
      if (!fromRate) {
        return res.status(502).json({
          success: false,
          message: `No se pudo obtener tipo de cambio para ${fromCurr}`,
        });
      }
      rates[fromCurr] = fromRate;
    }

    // Obtener rate TO
    if (toCurr !== "CLP") {
      const toRate = await getRateValue(toCurr);
      if (!toRate) {
        return res.status(502).json({
          success: false,
          message: `No se pudo obtener tipo de cambio para ${toCurr}`,
        });
      }
      rates[toCurr] = toRate;
    }

    // Realizar conversión
    let amountInCLP;
    if (fromCurr === "CLP") {
      amountInCLP = amount;
    } else {
      amountInCLP = amount * rates[fromCurr];
    }

    let convertedAmount;
    let exchangeRate;

    if (toCurr === "CLP") {
      convertedAmount = amountInCLP;
      exchangeRate = fromCurr === "CLP" ? 1 : rates[fromCurr];
    } else {
      convertedAmount = amountInCLP / rates[toCurr];
      exchangeRate =
        fromCurr === "CLP"
          ? 1 / rates[toCurr]
          : rates[fromCurr] / rates[toCurr];
    }

    const result = {
      originalAmount: parseFloat(amount),
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      fromCurrency: fromCurr,
      toCurrency: toCurr,
      exchangeRate: Math.round(exchangeRate * 10000) / 10000,
      conversionDate: new Date().toISOString().split("T")[0],
    };

    // Registrar conversión
    try {
      await db.query(
        `
        INSERT INTO ferremas_db.currency_conversions 
        (amount, from_currency, to_currency, exchange_rate, converted_amount, conversion_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          amount,
          fromCurr,
          toCurr,
          exchangeRate,
          convertedAmount,
          result.conversionDate,
        ]
      );
    } catch (logError) {
      console.warn("No se pudo registrar conversión:", logError.message);
    }

    console.log(`✅ ${amount} ${fromCurr} = ${convertedAmount} ${toCurr}`);

    res.json({
      success: true,
      message: "Conversión realizada correctamente",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error en conversión:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/divisas/health - Estado de salud
router.get("/health", async (req, res) => {
  try {
    const health = {
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "Currency Exchange Service",
      dependencies: {},
    };

    // Test base de datos
    try {
      await db.query("SELECT 1");
      health.dependencies.database = "OK";
    } catch (dbError) {
      health.dependencies.database = "ERROR";
      health.status = "DEGRADED";
    }

    // Test BCCH API
    try {
      const testRate = await fetchRateFromBCCH(SERIES_CODES.USD, "USD");
      health.dependencies.bcch_api = testRate.success ? "OK" : "ERROR";
      if (!testRate.success) health.status = "DEGRADED";
    } catch (apiError) {
      health.dependencies.bcch_api = "ERROR";
      health.status = "DEGRADED";
    }

    res.status(health.status === "OK" ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// GET /api/divisas/test-connection - Probar conexión BCCH
router.get("/test-connection", async (req, res) => {
  try {
    console.log("🧪 Probando conexión con Banco Central...");

    const testResult = await fetchRateFromBCCH(SERIES_CODES.USD, "USD");

    if (testResult.success) {
      res.json({
        success: true,
        message: "Conexión exitosa con API del Banco Central",
        data: {
          currency: "USD",
          rate: testResult.value,
          date: testResult.date,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      res.status(502).json({
        success: false,
        message: "Error de conexión con API del Banco Central",
        error: testResult.error,
      });
    }
  } catch (error) {
    console.error("❌ Error en test de conexión:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// Funciones auxiliares

const fetchRateFromBCCH = async (seriesCode, currency) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const params = {
      user: BCCH_CONFIG.user,
      pass: BCCH_CONFIG.password,
      function: "GetSeries",
      timeseries: seriesCode,
      firstdate: today,
      lastdate: today,
    };

    console.log(`📡 Consultando BCCH para ${currency}...`);

    const response = await axios.get(BCCH_CONFIG.baseURL, {
      params,
      timeout: 15000,
    });

    if (response.data && response.data.Series && response.data.Series.Obs) {
      const observations = response.data.Series.Obs;
      const latestObs = Array.isArray(observations)
        ? observations[observations.length - 1]
        : observations;

      return {
        success: true,
        value: parseFloat(latestObs.value),
        date: latestObs.indexDateString,
        statusCode: latestObs.statusCode,
      };
    } else {
      throw new Error(`No hay datos para ${currency}`);
    }
  } catch (error) {
    console.error(`❌ Error BCCH ${currency}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

const getRateValue = async (currency) => {
  try {
    // Primero intentar desde caché
    const [cached] = await db.query(
      `
      SELECT exchange_rate 
      FROM ferremas_db.currency_rates 
      WHERE currency = ? AND rate_date = CURDATE()
        AND updated_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)
      ORDER BY updated_at DESC LIMIT 1
    `,
      [currency]
    );

    if (cached.length > 0) {
      return parseFloat(cached[0].exchange_rate);
    }

    // Si no está en caché, obtener desde BCCH
    const rate = await fetchRateFromBCCH(SERIES_CODES[currency], currency);
    if (rate.success) {
      await saveRateToCache(currency, rate.value, rate.date);
      return rate.value;
    }

    return null;
  } catch (error) {
    console.error(`Error obteniendo rate para ${currency}:`, error);
    return null;
  }
};

const saveRateToCache = async (currency, rate, date) => {
  try {
    await db.query(
      `
      INSERT INTO ferremas_db.currency_rates (currency, exchange_rate, rate_date, source)
      VALUES (?, ?, ?, 'BCCH_API')
      ON DUPLICATE KEY UPDATE 
        exchange_rate = VALUES(exchange_rate),
        updated_at = NOW()
    `,
      [currency, rate, date]
    );

    console.log(`💾 ${currency} guardado en caché: ${rate}`);
  } catch (error) {
    console.warn(`⚠️ No se pudo guardar ${currency} en caché:`, error.message);
  }
};

module.exports = router;
