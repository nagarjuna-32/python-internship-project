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

const RealStudentModel = mongoose.model('Student', StudentSchema);

const getMockModel = () => {
  const { sampleStudents } = require('../utils/sampleStudents');
  if (!global.__MOCK_DB__) {
    global.__MOCK_DB__ = sampleStudents.map((s, index) => ({
      _id: `abcdef12345678901234567${index}`,
      ...s,
      createdAt: new Date(Date.now() - index * 60000),
      updatedAt: new Date(Date.now() - index * 60000)
    }));
  }
  const mockDB = global.__MOCK_DB__;

  const matchesQuery = (doc, query) => {
    if (!query) return true;
    for (const key of Object.keys(query)) {
      if (key === '$or') {
        const match = query.$or.some(cond => matchesQuery(doc, cond));
        if (!match) return false;
        continue;
      }
      if (key === '_id') {
        const val = query._id;
        if (val && val.$ne) {
          if (doc._id === val.$ne) return false;
          continue;
        }
        if (doc._id !== val) return false;
        continue;
      }
      const val = query[key];
      if (val && val.$regex) {
        let pattern = val.$regex;
        let flags = val.$options || '';
        const regex = new RegExp(pattern, flags);
        if (!regex.test(doc[key])) return false;
      } else {
        if (doc[key] !== val) return false;
      }
    }
    return true;
  };

  return {
    find: function (query) {
      let filtered = mockDB.filter(doc => matchesQuery(doc, query));
      let sortFn = null;
      let skipVal = 0;
      let limitVal = null;

      const chain = {
        sort: function (sortObj) {
          sortFn = (a, b) => {
            for (const field of Object.keys(sortObj)) {
              const dir = sortObj[field];
              if (a[field] < b[field]) return -dir;
              if (a[field] > b[field]) return dir;
            }
            return 0;
          };
          return chain;
        },
        skip: function (val) {
          skipVal = val;
          return chain;
        },
        limit: function (val) {
          limitVal = val;
          return chain;
        },
        then: function (resolve, reject) {
          let result = [...filtered];
          if (sortFn) result.sort(sortFn);
          if (skipVal) result = result.slice(skipVal);
          if (limitVal !== null) result = result.slice(0, limitVal);
          resolve(result);
        }
      };
      return chain;
    },
    countDocuments: async function (query) {
      return mockDB.filter(doc => matchesQuery(doc, query)).length;
    },
    findOne: async function (query) {
      const doc = mockDB.find(doc => matchesQuery(doc, query));
      return doc || null;
    },
    findById: async function (id) {
      const doc = mockDB.find(doc => doc._id === id);
      if (!doc) return null;
      return {
        ...doc,
        save: async function () {
          const idx = mockDB.findIndex(d => d._id === id);
          if (idx !== -1) {
            this.updatedAt = new Date();
            mockDB[idx] = { ...this };
          }
          return this;
        }
      };
    },
    create: async function (payload) {
      const newDoc = {
        _id: 'abcdef' + Math.random().toString(16).substr(2, 18).padEnd(18, '0'),
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockDB.push(newDoc);
      return newDoc;
    },
    findByIdAndDelete: async function (id) {
      const idx = mockDB.findIndex(doc => doc._id === id);
      if (idx === -1) return null;
      const deleted = mockDB[idx];
      mockDB.splice(idx, 1);
      return deleted;
    },
    distinct: async function (field) {
      const values = mockDB.map(doc => doc[field]);
      return [...new Set(values)];
    },
    aggregate: async function (pipeline) {
      const groupStage = pipeline.find(stage => stage.$group);
      if (groupStage) {
        const groupKey = groupStage.$group._id;
        if (groupKey === '$semester') {
          const counts = {};
          mockDB.forEach(doc => {
            counts[doc.semester] = (counts[doc.semester] || 0) + 1;
          });
          const res = Object.keys(counts).map(sem => ({
            _id: Number(sem),
            count: counts[sem]
          }));
          if (pipeline.some(stage => stage.$sort && stage.$sort._id)) {
            res.sort((a, b) => a._id - b._id);
          }
          return res;
        }
        if (groupKey === null) {
          if (mockDB.length === 0) return [{ _id: null, avg: 0 }];
          const totalSem = mockDB.reduce((sum, doc) => sum + doc.semester, 0);
          return [{ _id: null, avg: totalSem / mockDB.length }];
        }
        if (groupKey === '$department') {
          const counts = {};
          mockDB.forEach(doc => {
            counts[doc.department] = (counts[doc.department] || 0) + 1;
          });
          const res = Object.keys(counts).map(dept => ({
            _id: dept,
            count: counts[dept]
          }));
          if (pipeline.some(stage => stage.$sort && stage.$sort.count)) {
            res.sort((a, b) => b.count - a.count);
          }
          return res;
        }
      }
      return [];
    },
    insertMany: async function (docs) {
      docs.forEach(doc => {
        mockDB.push({
          _id: 'abcdef' + Math.random().toString(16).substr(2, 18).padEnd(18, '0'),
          ...doc,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
      return docs;
    },
    updateOne: async function (query, update) {
      const doc = mockDB.find(doc => matchesQuery(doc, query));
      if (doc && update.$set) {
        Object.assign(doc, update.$set);
        doc.updatedAt = new Date();
      }
      return { nModified: doc ? 1 : 0 };
    }
  };
};

const dynamicDispatcher = new Proxy({}, {
  get(target, prop) {
    const activeModel = global.USE_MOCK_DATABASE ? getMockModel() : RealStudentModel;
    return activeModel[prop];
  }
});

module.exports = dynamicDispatcher;

