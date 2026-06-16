const helmet = require('helmet');

function securityMiddleware(app) {
  app.use(helmet());
}

module.exports = { securityMiddleware };
