import React, { useEffect, useMemo, useState } from 'react';
import studentService from '../services/studentService';
import useDebounce from '../hooks/useDebounce';
import EmptyState from '../components/common/EmptyState';
import ConfirmModal from '../components/common/ConfirmModal';
import styles from './students.module.css';


function FieldRow({ label, children }) {
  return (
    <div>
      <div className={styles.label}>{label}</div>
      {children}
    </div>
  );
}

function studentsToCsvParams(filters) {
  return {
    search: filters.search,
    department: filters.department,
    semester: filters.semester,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  };
}

export default function StudentsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, total: 0 });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const [department, setDepartment] = useState('All');
  const [semester, setSemester] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [page, setPage] = useState(1);

  const [error, setError] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError('');

        const res = await studentService.listStudents({
          search: debouncedSearch,
          department,
          semester,
          page,
          limit: pagination.limit,
          sortBy,
          sortOrder
        });

        if (!mounted) return;
        setRows(res.data || []);
        setPagination(res.pagination);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || 'Failed to load students');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, department, semester, sortBy, sortOrder, page]);

  const departments = useMemo(() => {
    const fromRows = Array.from(new Set(rows.map((r) => r.department))).filter(Boolean);
    return ['All', ...fromRows];
  }, [rows]);

  async function handleDelete(id) {
    setConfirmOpen(false);
    setToDelete(null);
    try {
      setLoading(true);
      await studentService.deleteStudent(id);
      // refresh
      const res = await studentService.listStudents({
        search: debouncedSearch,
        department,
        semester,
        page,
        limit: pagination.limit,
        sortBy,
        sortOrder
      });
      setRows(res.data || []);
      setPagination(res.pagination);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCSV() {
    try {
      const blobRes = await studentService.exportStudentsCSV(
        studentsToCsvParams({ search: debouncedSearch, department, semester, sortBy, sortOrder })
      );

      const url = window.URL.createObjectURL(blobRes.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'students.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Export failed');
    }
  }

  async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        // dataUrl format: data:text/csv;base64,XXXX
        const base64 = String(dataUrl).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function handleImportCSV(file) {
    try {
      setImportBusy(true);
      setError('');
      const base64 = await readFileAsBase64(file);
      const res = await studentService.importStudentsCSV(base64);
      // refresh
      const listRes = await studentService.listStudents({
        search: debouncedSearch,
        department,
        semester,
        page: 1,
        limit: pagination.limit,
        sortBy,
        sortOrder
      });
      setRows(listRes.data || []);
      setPagination(listRes.pagination);
      setPage(1);
      setError(res?.message ? '' : error);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Import failed');
    } finally {
      setImportBusy(false);
    }
  }

  // const activeFilters = { search: debouncedSearch, department, semester, sortBy, sortOrder };

  return (
    <div className={styles.pageWrap}>
      <div className={`${styles.toolbar} card`}>
        <div className={styles.toolbarTop}>
          <div className={styles.title}>Students</div>
          <div className={styles.toolbarActions}>
            <button className="btn" onClick={handleExportCSV} type="button">
              Export CSV
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              {importBusy ? 'Importing...' : 'Import CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                disabled={importBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportCSV(file);
                }}
              />
            </label>
          </div>
        </div>

        <div className={styles.filters}>
          <FieldRow label="Search (Name / USN)">
            <input
              className="input"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="e.g. Aarav or 1DS21CS001"
            />
          </FieldRow>

          <FieldRow label="Department">
            <select
              className="select"
              value={department}
              onChange={(e) => {
                setPage(1);
                setDepartment(e.target.value);
              }}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Semester">
            <select
              className="select"
              value={semester}
              onChange={(e) => {
                setPage(1);
                setSemester(e.target.value);
              }}
            >
              {['All', ...Array.from({ length: 12 }, (_, i) => String(i + 1))].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Sort">
            <div style={{ display: 'flex', gap: 10 }}>
              <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Name</option>
                <option value="semester">Semester</option>
              </select>
              <select className="select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </FieldRow>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ padding: 14, marginTop: 14, color: 'rgba(239,68,68,.95)' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className={styles.tableShell}>
          <div className="card" style={{ padding: 16 }}>Loading students...</div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No students found" description="Try clearing filters or importing CSV." />
      ) : (
        <div className={`${styles.tableShell} card`}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Full Name</th>
                  <th>USN</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Semester</th>
                  <th>Gender</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <img
                        alt={s.name}
                        src={s.profilePhoto || 'https://placehold.co/40x40/png?text=👤'}
                        style={{ width: 38, height: 38, borderRadius: 14, objectFit: 'cover', border: '1px solid rgba(255,255,255,.08)' }}
                      />
                    </td>
                    <td style={{ fontWeight: 800 }}>{s.name}</td>
                    <td>
                      <div className={styles.mono}>{s.usn}</div>
                    </td>
                    <td>{s.email}</td>
                    <td>
                      <span className={styles.dim}>{s.department}</span>
                    </td>
                    <td>
                      <span className="badge">Sem {s.semester}</span>
                    </td>
                    <td>{s.gender}</td>
                    <td>
                      <div className={styles.actions}>
                        <a className="btn" href={`/students/${s._id}/edit`}>Edit</a>
                        <button
                          className="btn btnDanger"
                          type="button"
                          onClick={() => {
                            setToDelete(s);
                            setConfirmOpen(true);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              Page {pagination.page} of {pagination.totalPages} • Total {pagination.total}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </button>
              <button
                className="btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        danger
        title="Delete student?"
        description={toDelete ? `This will delete ${toDelete.name} (${toDelete.usn}).` : 'This action cannot be undone.'}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handleDelete(toDelete?._id)}
        onCancel={() => {
          setConfirmOpen(false);
          setToDelete(null);
        }}
      />
    </div>
  );
}

