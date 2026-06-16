const fs = require('fs');
const path = require('path');
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

