const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

// Inject Mongoose Mock if configured
if (process.env.USE_MOCK_DB === 'true') {
  const mongooseMock = require('./mongoose-mock');
  require.cache[require.resolve('mongoose')] = {
    id: require.resolve('mongoose'),
    filename: require.resolve('mongoose'),
    loaded: true,
    exports: mongooseMock
  };
  console.log('Using in-memory JSON file database mock for Mongoose');
}

const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { connectMongo } = require('./config/mongo');
const studentRoutes = require('./routes/studentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Basic logging
app.use(morgan('dev'));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'student-management-system-backend' });
});

app.use('/api', dashboardRoutes);
app.use('/api', studentRoutes);


app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Mongo connection failed:', err);
    process.exit(1);
  });

