const validator = require('validator');

function validateEmail(email) {
  return validator.isEmail(String(email));
}

function validatePhone(phone) {
  // Simple international-friendly validation
  const p = String(phone).trim();
  return validator.isMobilePhone(p, undefined, { strictMode: false });
}

module.exports = { validateEmail, validatePhone };

