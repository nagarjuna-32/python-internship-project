import api from './api';

const studentService = {
  listStudents: async (params) => {
    const res = await api.get('/students', { params });
    return res.data;
  },
  getStudent: async (id) => {
    const res = await api.get(`/students/${id}`);
    return res.data;
  },
  createStudent: async (payload) => {
    const res = await api.post('/students', payload);
    return res.data;
  },
  updateStudent: async (id, payload) => {
    const res = await api.put(`/students/${id}`, payload);
    return res.data;
  },
  deleteStudent: async (id) => {
    const res = await api.delete(`/students/${id}`);
    return res.data;
  },
  exportStudentsCSV: async (params) => {
    const res = await api.get('/students/export/csv', {
      params,
      responseType: 'blob'
    });
    return res;
  },
  importStudentsCSV: async (csvBase64) => {
    const res = await api.post('/students/import/csv', { csvBase64 });
    return res.data;
  },
  dashboard: async () => {
    const res = await api.get('/dashboard');
    return res.data;
  }
};

export default studentService;

