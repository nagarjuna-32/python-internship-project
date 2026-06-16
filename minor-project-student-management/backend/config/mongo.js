const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectMongo = async () => {
  let uri = process.env.MONGODB_URI;
  let isInMemory = false;

  if (uri) {
    try {
      mongoose.set('strictQuery', true);
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });
      await mongoose.connect(uri);
      console.log(`Connected to MongoDB at ${uri}`);
      return;
    } catch (err) {
      console.error(`Failed to connect to MONGODB_URI: ${err.message}`);
    }
  }

  // Try MongoMemoryServer
  try {
    console.log('Starting mongodb-memory-server...');
    const mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
    global.__MONGO_SERVER__ = mongoServer;
    isInMemory = true;

    mongoose.set('strictQuery', true);
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    await mongoose.connect(uri);
    console.log(`Connected to in-memory MongoDB at ${uri}`);

    // Seed it
    try {
      const Student = require('../models/Student');
      const { sampleStudents } = require('../utils/sampleStudents');
      const count = await Student.countDocuments();
      if (count === 0) {
        console.log('Seeding sample students...');
        await Student.insertMany(sampleStudents);
        console.log('Sample students seeded successfully.');
      }
    } catch (err) {
      console.error('Failed to seed database:', err);
    }
    return;
  } catch (err) {
    console.warn(`Could not start mongodb-memory-server: ${err.message}`);
  }

  // Fallback to JS In-Memory Mock database
  console.log('----------------------------------------------------');
  console.log('WARNING: Falling back to JS In-Memory Mock Database!');
  console.log('All CRUD changes will reside in server process memory.');
  console.log('----------------------------------------------------');
  global.USE_MOCK_DATABASE = true;
};

module.exports = { connectMongo };

