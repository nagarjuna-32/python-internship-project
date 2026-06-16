import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import studentService from '../services/studentService';
import styles from './studentForm.module.css';
import EmptyState from '../components/common/EmptyState';
import ConfirmModal from '../components/common/ConfirmModal';

const GENDERS = ['Male', 'Female', 'Other'];

function Field({ label, children, error }) {
  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      {children}
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}

function validateClient(payload) {
  const errors = {};
  const required = {
    name: 'Full Name is required.',
    usn: 'USN is required.',
    email: 'Email is required.',
    phone: 'Phone Number is required.',
    department: 'Department is required.',
    semester: 'Semester is required.',
    gender: 'Gender is required.',
    dob: 'Date of Birth is required.',
    address: 'Address is required.'
  };

  for (const [k, msg] of Object.entries(required)) {
    if (!payload[k] || String(payload[k]).trim() === '') errors[k] = msg;
  }

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email).trim())) {
    errors.email = 'Invalid email format.';
  }

  if (payload.phone && String(payload.phone).trim().length < 8) {
    errors.phone = 'Invalid phone number.';
  }

  const sem = Number(payload.semester);
  if (payload.semester !== '' && (Number.isNaN(sem) || sem < 1 || sem > 12)) {
    errors.semester = 'Semester must be between 1 and 12.';
  }

  if (payload.gender && !GENDERS.includes(payload.gender)) {
    errors.gender = 'Gender must be Male, Female, or Other.';
  }

  return errors;
}

export default function StudentFormPage({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState({});

  const [confirmOpen, setConfirmOpen] = useState(false);

  const initialState = useMemo(
    () => ({
      name: '',
      usn: '',
      email: '',
      phone: '',
      department: '',
      semester: '',
      gender: 'Male',
      dob: '',
      address: '',
      profilePhoto: ''
    }),
    []
  );

  const [form, setForm] = useState(initialState);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!isEdit) {
          setLoading(false);
          return;
        }
        setLoading(true);
        const res = await studentService.getStudent(id);
        if (!mounted) return;
        const s = res.data || res;
        setForm({
          name: s.name || '',
          usn: s.usn || '',
          email: s.email || '',
          phone: s.phone || '',
          department: s.department || '',
          semester: s.semester ?? '',
          gender: s.gender || 'Male',
          dob: s.dob ? String(s.dob).slice(0, 10) : '',
          address: s.address || '',
          profilePhoto: s.profilePhoto || ''
        });
      } catch (e) {
        if (!mounted) return;
        setServerError(e?.response?.data?.message || e.message || 'Failed to load student');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, isEdit]);

  async function onSubmit(e) {
    e.preventDefault();
    setServerError('');

    const clientErrors = validateClient(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    const payload = {
      ...form,
      semester: Number(form.semester)
    };

    try {
      setSaving(true);
      if (isEdit) {
        await studentService.updateStudent(id, payload);
      } else {
        await studentService.createStudent(payload);
      }
      navigate('/students');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Validation failed';
      const serverErrors = err?.response?.data?.errors;
      setServerError(msg);
      if (serverErrors && typeof serverErrors === 'object') setErrors(serverErrors);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="card" style={{ padding: 18 }}>Loading...</div>
      </div>
    );
  }

  if (serverError && isEdit && !form.usn) {
    return (
      <div className={styles.page}>
        <EmptyState title="Could not load student" description={serverError} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{isEdit ? 'Edit Student' : 'Add Student'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              {isEdit ? 'Update student record' : 'Create a new student record'}
            </div>
          </div>
          <button className="btn" type="button" onClick={() => setConfirmOpen(true)}>
            Back
          </button>
        </div>

        {serverError ? <div className={styles.serverError}>{serverError}</div> : null}

        <form onSubmit={onSubmit}>
          <div className={styles.grid}>
            <Field label="Full Name" error={errors.name}>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>

            <Field label="USN (unique)" error={errors.usn}>
              <input className="input" value={form.usn} onChange={(e) => setForm((f) => ({ ...f, usn: e.target.value }))} />
            </Field>

            <Field label="Email" error={errors.email}>
              <input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>

            <Field label="Phone Number" error={errors.phone}>
              <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>

            <Field label="Department" error={errors.department}>
              <input className="input" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Computer Science" />
            </Field>

            <Field label="Semester" error={errors.semester}>
              <select className="select" value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}>
                <option value="">Select</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Gender" error={errors.gender}>
              <select className="select" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Date of Birth" error={errors.dob}>
              <input type="date" className="input" value={form.dob} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} />
            </Field>

            <div className={styles.full}>
              <Field label="Address" error={errors.address}>
                <textarea className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
              </Field>
            </div>

            <Field label="Profile Photo URL (optional)" error={errors.profilePhoto}>
              <input className="input" value={form.profilePhoto} onChange={(e) => setForm((f) => ({ ...f, profilePhoto: e.target.value }))} placeholder="https://..." />
              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                <img
                  alt="preview"
                  src={form.profilePhoto || 'https://placehold.co/48x48/png?text=👤'}
                  style={{ width: 48, height: 48, borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', objectFit: 'cover' }}
                />
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Preview</div>
              </div>
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button className="btn" type="button" onClick={() => navigate('/students')}>
              Cancel
            </button>
            <button className="btn btnPrimary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Discard changes?"
        description="Your changes may not be saved."
        confirmText="Leave"
        cancelText="Stay"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          navigate('/students');
        }}
      />
    </div>
  );
}

