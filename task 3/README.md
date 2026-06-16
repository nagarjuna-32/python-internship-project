# Student Management System

A full-stack **Student Management System** internship-ready project (CRUD) built with:
- **Frontend:** React.js (Vite)
- **Backend:** Node.js + Express.js
- **Database:** MongoDB (MongoDB Atlas) + Mongoose

## Features

### Student CRUD
- Add student
- View student list
- Edit student
- Delete student (with confirmation on UI)
- Search (instant) by **Name** or **USN**
- Filter by **Department** and **Semester**
- Sort by **Name** and **Semester**
- Pagination

### CSV
- Export students to CSV
- Import students from CSV (upsert by USN)

### Dashboard
- Total students
- Total departments
- Average semester
- Recently added students
- Students by Department (chart-ready data)
- Students by Semester (chart-ready data)

## Screenshots
- Dashboard: `./docs/screenshot-dashboard.png` (placeholder)
- Students table: `./docs/screenshot-students.png` (placeholder)

## Tech Stack
- React, React Router
- Axios
- React Toastify
- Lucide React (icons)
- Express
- Helmet, CORS, Rate Limiting
- Mongoose

## Folder Structure

### Backend
```
backend/
├── config/
│   ├── mongo.js
│   ├── validation.js
│   └── sanitize.js
├── controllers/
│   ├── studentController.js
│   └── dashboardController.js
├── middleware/
│   └── errorMiddleware.js
├── models/
│   └── Student.js
├── routes/
│   ├── studentRoutes.js
│   └── dashboardRoutes.js
├── utils/
│   ├── seed.js
│   ├── sampleStudents.js
│   └── csvTemplate.csv
├── server.js
└── package.json
```

### Frontend
```
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── assets/
│   └── styles/
│   └── App.jsx
└── package.json
```

## Environment Setup

### Backend
Copy:
- `backend/.env.example` -> `backend/.env`

Example:
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<db>?retryWrites=true&w=majority
```

### Frontend
Copy:
- `frontend/.env.example` -> `frontend/.env`

Example:
```
VITE_API_URL=http://localhost:5000/api
```

## API Documentation
Base URL: `http://localhost:5000/api`

### Students
- `GET /students`
  - Query: `search`, `department`, `semester`, `page`, `limit`, `sortBy` (`name|semester`), `sortOrder` (`asc|desc`)
- `GET /students/:id`
- `POST /students`
- `PUT /students/:id`
- `DELETE /students/:id`

### CSV
- `GET /students/export/csv`
- `POST /students/import/csv`
  - Body: `{ "csvBase64": "..." }`

### Dashboard
- `GET /dashboard`

## Installation & Running

### Backend
```bash
cd backend
npm install
npm run dev
```

(Optional seed)
```bash
npm run seed
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Sample Data
- CSV template: `backend/utils/csvTemplate.csv`
- Seed script uses `backend/utils/sampleStudents.js`

## Future Enhancements
- Add JWT auth + roles
- Improve CSV import UI with row-level preview
- Add more dashboard charts
- Add unit/integration tests

## Author
**Your Name**


