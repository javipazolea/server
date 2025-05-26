const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Transaction } = require("transbank-sdk").WebpayPlus; // 🔥 Importar Transaction directamente

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/crear-transaccion", async (req, res) => {
  try {
    const { monto } = req.body;
    const buyOrder = `orden_${Math.floor(Math.random() * 1000000)}`;
    const sessionId = `sesion_${Math.floor(Math.random() * 1000000)}`;
    const returnUrl = `http://localhost:${PORT}/retorno-webpay`;

    const response = await Transaction.create(
      buyOrder,
      sessionId,
      monto,
      returnUrl
    );

    res.status(200).json({
      url: response.url,
      token: response.token,
    });
  } catch (error) {
    console.error("Error al crear la transacción:", error);
    res.status(500).json({ error: "Error al crear transacción" });
  }
});

app.post("/retorno-webpay", async (req, res) => {
  const { token_ws } = req.body;

  try {
    const result = await Transaction.commit(token_ws);

    res.status(200).json({
      message: "Transacción completada",
      resultado: result,
    });
  } catch (error) {
    console.error("Error al confirmar la transacción:", error);
    res.status(500).json({ error: "Error al confirmar transacción" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Webpay corriendo en http://localhost:${PORT}`);
});
