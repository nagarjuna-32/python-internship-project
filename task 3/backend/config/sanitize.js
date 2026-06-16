const xss = require('xss');

function sanitizeString(value) {
  if (value === undefined || value === null) return '';
  return xss(String(value)).trim();
}

function sanitizeObjectStrings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'string') out[key] = sanitizeString(out[key]);
  }
  return out;
}

module.exports = { sanitizeString, sanitizeObjectStrings };

