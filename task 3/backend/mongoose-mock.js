const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

// Ensure db.json exists with empty array
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Simple unique ID generator mimicking MongoDB ObjectId
function generateId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

class QueryChain {
  constructor(data) {
    this._data = data;
    this._sortFn = null;
    this._skipNum = 0;
    this._limitNum = null;
  }

  sort(sortObj) {
    const keys = Object.keys(sortObj);
    if (keys.length > 0) {
      this._sortFn = (a, b) => {
        for (const key of keys) {
          const dir = sortObj[key];
          let valA = a[key];
          let valB = b[key];
          if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
          }
          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
        }
        return 0;
      };
    }
    return this;
  }

  skip(num) {
    this._skipNum = num;
    return this;
  }

  limit(num) {
    this._limitNum = num;
    return this;
  }

  // Make it thenable/awaitable
  then(resolve, reject) {
    let result = [...this._data];
    if (this._sortFn) {
      result.sort(this._sortFn);
    }
    if (this._skipNum) {
      result = result.slice(this._skipNum);
    }
    if (this._limitNum !== null) {
      result = result.slice(0, this._limitNum);
    }
    const docs = result.map(item => new Document(item));
    return Promise.resolve(docs).then(resolve, reject);
  }
}

class Document {
  constructor(data) {
    Object.assign(this, data);
    if (!this._id) {
      this._id = generateId();
    }
  }

  async save() {
    const data = readData();
    const idx = data.findIndex(item => item._id === this._id);
    this.updatedAt = new Date().toISOString();
    const plainObj = { ...this };
    if (idx >= 0) {
      data[idx] = plainObj;
    } else {
      plainObj.createdAt = new Date().toISOString();
      data.push(plainObj);
    }
    writeData(data);
    return this;
  }
}

function matchQuery(item, query) {
  for (const key of Object.keys(query)) {
    if (key === '$or') {
      const subQueries = query[key];
      const matchAny = subQueries.some(sub => matchQuery(item, sub));
      if (!matchAny) return false;
      continue;
    }

    const queryVal = query[key];
    const itemVal = item[key];

    if (queryVal && typeof queryVal === 'object') {
      if ('$regex' in queryVal) {
        const regexStr = queryVal['$regex'];
        const options = queryVal['$options'] || '';
        const regex = new RegExp(regexStr, options);
        if (!regex.test(String(itemVal || ''))) return false;
      }
      if ('$ne' in queryVal) {
        const neVal = queryVal['$ne'];
        if (String(itemVal) === String(neVal)) return false;
      }
    } else {
      if (String(itemVal || '') !== String(queryVal || '')) return false;
    }
  }
  return true;
}

const mockModel = {
  async countDocuments(query = {}) {
    const data = readData();
    const filtered = data.filter(item => matchQuery(item, query));
    return filtered.length;
  },

  async distinct(field) {
    const data = readData();
    const values = data.map(item => item[field]).filter(Boolean);
    return [...new Set(values)];
  },

  find(query = {}) {
    const data = readData();
    const filtered = data.filter(item => matchQuery(item, query));
    return new QueryChain(filtered);
  },

  async findById(id) {
    const data = readData();
    const found = data.find(item => String(item._id) === String(id));
    return found ? new Document(found) : null;
  },

  async findOne(query = {}) {
    const data = readData();
    const found = data.find(item => matchQuery(item, query));
    return found ? new Document(found) : null;
  },

  async create(payload) {
    const doc = new Document(payload);
    await doc.save();
    return doc;
  },

  async findByIdAndDelete(id) {
    const data = readData();
    const idx = data.findIndex(item => String(item._id) === String(id));
    if (idx >= 0) {
      const deleted = data.splice(idx, 1)[0];
      writeData(data);
      return new Document(deleted);
    }
    return null;
  },

  async updateOne(query = {}, update = {}) {
    const data = readData();
    const idx = data.findIndex(item => matchQuery(item, query));
    if (idx >= 0) {
      const setFields = update.$set || update;
      data[idx] = { ...data[idx], ...setFields, updatedAt: new Date().toISOString() };
      writeData(data);
      return { matchedCount: 1, modifiedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  },

  async aggregate(pipeline) {
    const data = readData();
    
    const isGroupBySemester = pipeline.some(p => p.$group && p.$group._id === '$semester');
    if (isGroupBySemester) {
      const counts = {};
      data.forEach(item => {
        const sem = item.semester;
        counts[sem] = (counts[sem] || 0) + 1;
      });
      const result = Object.keys(counts).map(sem => ({
        _id: Number(sem),
        count: counts[sem]
      }));
      result.sort((a, b) => a._id - b._id);
      return result;
    }

    const isAvgSemester = pipeline.some(p => p.$group && p.$group.avg && p.$group.avg.$avg === '$semester');
    if (isAvgSemester) {
      const sems = data.map(item => item.semester).filter(val => typeof val === 'number');
      const sum = sems.reduce((a, b) => a + b, 0);
      const avg = sems.length ? sum / sems.length : 0;
      return [{ _id: null, avg }];
    }

    const isGroupByDept = pipeline.some(p => p.$group && p.$group._id === '$department');
    if (isGroupByDept) {
      const counts = {};
      data.forEach(item => {
        const dept = item.department;
        counts[dept] = (counts[dept] || 0) + 1;
      });
      const result = Object.keys(counts).map(dept => ({
        _id: dept,
        count: counts[dept]
      }));
      result.sort((a, b) => b.count - a.count);
      return result;
    }

    return [];
  }
};

const mongooseMock = {
  set() {},
  connection: {
    on() {}
  },
  async connect() {
    console.log('Connected to mock local JSON database');
    return Promise.resolve();
  },
  isValidObjectId(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  },
  Schema: class {
    pre() {}
  },
  model(name, schema) {
    return mockModel;
  }
};

module.exports = mongooseMock;
