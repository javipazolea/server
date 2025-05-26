const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = require('transbank-sdk');

// Configuración para ambiente de integración (pruebas)
const webpayConfig = {
  environment: Environment.Integration,
  commerceCode: IntegrationCommerceCodes.WEBPAY_PLUS,
  apiKey: IntegrationApiKeys.WEBPAY
};

// Configurar WebPay Plus para integración
const transaction = new WebpayPlus.Transaction(
  new Options(webpayConfig.commerceCode, webpayConfig.apiKey, webpayConfig.environment)
);

module.exports = {
  transaction,
  webpayConfig,
  WebpayPlus,
  Options,
  Environment
};