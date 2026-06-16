const Student = require('../models/Student');

// Lightweight dashboard data for the frontend charts
const getDashboardStats = async (req, res) => {
  const [totalStudents, departmentsAgg, semestersAgg, recent] = await Promise.all([
    Student.countDocuments(),
    Student.distinct('department'),
    Student.aggregate([
      { $group: { _id: '$semester', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Student.find().sort({ createdAt: -1 }).limit(6)
  ]);

  const avgSemesterAgg = await Student.aggregate([
    { $group: { _id: null, avg: { $avg: '$semester' } } }
  ]);

  const avgSemester = avgSemesterAgg?.[0]?.avg ? Number(avgSemesterAgg[0].avg.toFixed(2)) : 0;

  const studentsByDepartment = departmentsAgg.map((d) => ({
    department: d,
    count: 0
  }));

  // fill counts with another aggregate (keeps code simple)
  const deptCounts = await Student.aggregate([
    { $group: { _id: '$department', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  deptCounts.forEach((x) => {
    const idx = studentsByDepartment.findIndex((y) => y.department === x._id);
    if (idx >= 0) studentsByDepartment[idx].count = x.count;
  });

  const studentsBySemester = semestersAgg.map((x) => ({
    semester: x._id,
    count: x.count
  }));

  res.json({
    stats: {
      totalStudents,
      totalDepartments: departmentsAgg.length,
      avgSemester,
      recentStudents: recent,
      studentsByDepartment,
      studentsBySemester
    }
  });
};

module.exports = { getDashboardStats };

