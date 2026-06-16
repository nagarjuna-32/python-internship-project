const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (process.env.USE_MOCK_DB === 'true') {
  const mongooseMock = require('../mongoose-mock');
  require.cache[require.resolve('mongoose')] = {
    id: require.resolve('mongoose'),
    filename: require.resolve('mongoose'),
    loaded: true,
    exports: mongooseMock
  };
  console.log('Seed: Using in-memory JSON file database mock for Mongoose');
}

const fs = require('fs');
const Student = require('../models/Student');
const { connectMongo } = require('../config/mongo');
const { sampleStudents } = require('./sampleStudents');

async function seed() {
  await connectMongo();

  // Upsert by USN
  for (const s of sampleStudents) {
    const existing = await Student.findOne({ usn: s.usn });
    if (existing) {
      await Student.updateOne({ usn: s.usn }, { $set: s });
    } else {
      await Student.create(s);
    }
  }

  console.log('Seed completed.');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});

