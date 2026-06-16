const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    usn: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
      maxlength: 30
    },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    semester: { type: Number, required: true, min: 1, max: 12 },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    dob: { type: Date, required: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    profilePhoto: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

StudentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Student', StudentSchema);

