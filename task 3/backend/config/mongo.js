const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectMongo = async () => {
  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing in environment variables');

  mongoose.set('strictQuery', true);

  // Prevent OverwriteModelError in watch mode
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  try {
    console.log(`Attempting to connect to MongoDB at ${uri}...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to MongoDB');
  } catch (err) {
    if (uri.includes('127.0.0.1') || uri.includes('localhost')) {
      console.log('Local MongoDB not running. Starting in-memory MongoDB server...');
      try {
        const mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        console.log(`In-memory MongoDB started at: ${mongoUri}`);
        await mongoose.connect(mongoUri);
        console.log('Connected to in-memory MongoDB');
      } catch (memErr) {
        console.error('Failed to start in-memory MongoDB server:', memErr);
        throw err;
      }
    } else {
      throw err;
    }
  }
};

module.exports = { connectMongo };

