const express = require('express');
const router = express.Router();

const {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  exportStudentsCSV,
  importStudentsCSV
} = require('../controllers/studentController');

router.get('/students', listStudents);
router.get('/students/:id', getStudent);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);

router.get('/students/export/csv', exportStudentsCSV);
router.post('/students/import/csv', importStudentsCSV);

module.exports = router;

