const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: Object.values(err.errors || {}).map((e) => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  // Custom bad request
  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ message: err.message || 'Bad request' });
  }

  return res.status(500).json({ message: 'Internal server error' });
};

module.exports = { notFoundHandler, errorHandler };

