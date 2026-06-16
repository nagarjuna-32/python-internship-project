const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { stringify } = require('csv-stringify/sync');
const { parse } = require('csv-parse/sync');
const Student = require('../models/Student');
const { validateEmail, validatePhone } = require('../config/validation');

function buildQuery({ search, department, semester }) {
  const query = {};

  if (department && department !== 'All') query.department = department;
  if (semester && semester !== 'All') query.semester = Number(semester);

  if (search) {
    const s = String(search).trim();
    // search by name or USN
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { usn: { $regex: `^${s}$`, $options: 'i' } },
      { usn: { $regex: s, $options: 'i' } }
    ];
  }

  return query;
}

function buildSort(sortBy, sortOrder) {
  const dir = sortOrder === 'desc' ? -1 : 1;

  switch (sortBy) {
    case 'semester':
      return { semester: dir };
    case 'name':
    default:
      return { name: dir, usn: 1 };
  }
}

function normalizeStudentInput(body) {
  // Keep this beginner-friendly and sanitize string-like inputs.
  const normalized = {
    name: body.name?.trim(),
    usn: body.usn?.trim().toUpperCase(),
    email: body.email?.trim().toLowerCase(),
    phone: body.phone?.trim(),
    department: body.department?.trim(),
    semester: Number(body.semester),
    gender: body.gender,
    dob: body.dob,
    address: body.address?.trim(),
    profilePhoto: body.profilePhoto?.trim() || ''
  };

  return normalized;
}

async function validateStudentPayload(payload, { requireUsnUnique, existingId } = {}) {
  const errors = {};

  if (!payload.name) errors.name = 'Full Name is required.';
  if (!payload.usn) errors.usn = 'USN is required.';
  if (!payload.email) errors.email = 'Email is required.';
  if (!payload.phone) errors.phone = 'Phone Number is required.';
  if (!payload.department) errors.department = 'Department is required.';
  if (!payload.semester) errors.semester = 'Semester is required.';
  if (!payload.gender) errors.gender = 'Gender is required.';
  if (!payload.dob) errors.dob = 'Date of Birth is required.';
  if (!payload.address) errors.address = 'Address is required.';

  if (payload.email && !validateEmail(payload.email)) errors.email = 'Invalid email format.';
  if (payload.phone && !validatePhone(payload.phone)) errors.phone = 'Invalid phone number.';

  // Basic gender check
  const allowedGender = ['Male', 'Female', 'Other'];
  if (payload.gender && !allowedGender.includes(payload.gender)) {
    errors.gender = 'Gender must be Male, Female, or Other.';
  }

  // USN uniqueness (advanced validation)
  if (requireUsnUnique && payload.usn) {
    const q = { usn: payload.usn };
    if (existingId) q._id = { $ne: existingId };

    const existing = await Student.findOne(q);
    if (existing) errors.usn = 'USN must be unique.';
  }

  return errors;
}

const listStudents = async (req, res) => {
  const {
    search = '',
    department = 'All',
    semester = 'All',
    page = '1',
    limit = '10',
    sortBy = 'name',
    sortOrder = 'asc'
  } = req.query;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(100, Number(limit)));

  const query = buildQuery({ search, department, semester });
  const sort = buildSort(sortBy, sortOrder);

  const [total, students] = await Promise.all([
    Student.countDocuments(query),
    Student.find(query)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
  ]);

  res.json({
    data: students,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  });
};

const getStudent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid student id.' });
  }

  const student = await Student.findById(id);
  if (!student) return res.status(404).json({ message: 'Student not found.' });

  res.json({ data: student });
};

const createStudent = async (req, res) => {
  const payload = normalizeStudentInput(req.body || {});


  // Basic sanitization for text fields already handled via trim/lower/upper.
  const errors = await validateStudentPayload(payload, { requireUsnUnique: true });
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const student = await Student.create(payload);
  res.status(201).json({ data: student });
};

const updateStudent = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid student id.' });
  }

  const existing = await Student.findById(id);
  if (!existing) return res.status(404).json({ message: 'Student not found.' });

  const payload = normalizeStudentInput(req.body || {});

  const errors = await validateStudentPayload(payload, {
    requireUsnUnique: true,
    existingId: id
  });

  if (Object.keys(errors).length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  existing.name = payload.name;
  existing.usn = payload.usn;
  existing.email = payload.email;
  existing.phone = payload.phone;
  existing.department = payload.department;
  existing.semester = payload.semester;
  existing.gender = payload.gender;
  existing.dob = payload.dob;
  existing.address = payload.address;
  existing.profilePhoto = payload.profilePhoto;

  existing.updatedAt = new Date();

  await existing.save();

  res.json({ data: existing });
};

const deleteStudent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid student id.' });
  }

  const deleted = await Student.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ message: 'Student not found.' });

  res.json({ message: 'Student deleted successfully.' });
};

// CSV Export: returns CSV string
const exportStudentsCSV = async (req, res) => {
  const {
    search = '',
    department = 'All',
    semester = 'All',
    sortBy = 'name',
    sortOrder = 'asc'
  } = req.query;

  const query = buildQuery({ search, department, semester });
  const sort = buildSort(sortBy, sortOrder);

  const students = await Student.find(query).sort(sort);

  const header = [
    'name',
    'usn',
    'email',
    'phone',
    'department',
    'semester',
    'gender',
    'dob',
    'address',
    'profilePhoto'
  ];

  const records = students.map((s) => [
    s.name,
    s.usn,
    s.email,
    s.phone,
    s.department,
    s.semester,
    s.gender,
    new Date(s.dob).toISOString().slice(0, 10),
    s.address,
    s.profilePhoto || ''
  ]);

  const csv = stringify(records, { header: true, columns: header });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
  res.send(csv);
};

// CSV Import: expects JSON body { csvBase64 } OR multipart in future. For simplicity, accept base64 string.
// Payload fields: csvBase64
const importStudentsCSV = async (req, res) => {
  const { csvBase64 } = req.body || {};
  if (!csvBase64) return res.status(400).json({ message: 'csvBase64 is required.' });

  let csvRaw;
  try {
    csvRaw = Buffer.from(csvBase64, 'base64').toString('utf-8');
  } catch (e) {
    return res.status(400).json({ message: 'Invalid csvBase64.' });
  }

  let rows;
  try {
    rows = parse(csvRaw, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (e) {
    return res.status(400).json({ message: 'Could not parse CSV. Ensure headers are correct.' });
  }

  const results = {
    inserted: 0,
    updated: 0,
    errors: []
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const normalized = {
      name: row.name,
      usn: row.usn?.trim().toUpperCase(),
      email: row.email,
      phone: row.phone,
      department: row.department,
      semester: Number(row.semester),
      gender: row.gender,
      dob: row.dob,
      address: row.address,
      profilePhoto: row.profilePhoto || ''
    };

    const errors = await validateStudentPayload(normalized, { requireUsnUnique: false });

    // Additional required fields check for import
    if (!normalized.usn) errors.usn = errors.usn || 'USN is required.';
    if (!normalized.name) errors.name = errors.name || 'Full Name is required.';

    if (Object.keys(errors).length) {
      results.errors.push({ row: i + 1, usn: normalized.usn, errors });
      continue;
    }

    // Upsert by USN
    const existing = await Student.findOne({ usn: normalized.usn });
    if (existing) {
      existing.name = normalized.name;
      existing.email = normalized.email;
      existing.phone = normalized.phone;
      existing.department = normalized.department;
      existing.semester = normalized.semester;
      existing.gender = normalized.gender;
      existing.dob = normalized.dob;
      existing.address = normalized.address;
      existing.profilePhoto = normalized.profilePhoto;
      existing.updatedAt = new Date();

      await existing.save();
      results.updated += 1;
    } else {
      await Student.create(normalized);
      results.inserted += 1;
    }
  }

  res.json({ message: 'CSV import completed.', ...results });
};

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  exportStudentsCSV,
  importStudentsCSV
};

