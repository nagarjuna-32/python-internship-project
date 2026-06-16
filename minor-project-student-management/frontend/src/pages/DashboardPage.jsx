import React, { useEffect, useMemo, useState } from 'react';
import studentService from '../services/studentService';
import EmptyState from '../components/common/EmptyState';

import styles from './dashboard.module.css';

function MiniStat({ title, value, hint }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statTitle}>{title}</div>
      <div className={styles.statValue}>{value}</div>
      {hint ? <div className={styles.statHint}>{hint}</div> : null}
    </div>
  );
}

function BarLikeChart({ items, color = 'rgba(124,58,237,.75)' }) {
  const max = Math.max(1, ...items.map((x) => x.count));
  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartGrid}>
        {items.map((it) => {
          const h = Math.round((it.count / max) * 100);
          return (
            <div key={it.department ?? it.semester} className={styles.chartCol}>
              <div className={styles.chartBar} style={{ height: `${Math.max(6, h)}%`, background: color }} />
              <div className={styles.chartLabel}>{it.department ?? `Sem ${it.semester}`}</div>
              <div className={styles.chartValue}>{it.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await studentService.dashboard();
        if (mounted) setStats(res.stats);
      } catch (e) {
        if (mounted) setErr(e?.response?.data?.message || e.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const recent = useMemo(() => (stats?.recentStudents || []).slice(0, 5), [stats]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="card" style={{ padding: 18 }}>Loading dashboard...</div>
      </div>
    );
  }

  if (err || !stats) {
    return (
      <div className={styles.page}>
        <EmptyState title="Could not load dashboard" description={err || 'Please try again.'} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.gridStats}>
        <MiniStat title="Total Students" value={stats.totalStudents} />
        <MiniStat title="Total Departments" value={stats.totalDepartments} />
        <MiniStat title="Average Semester" value={stats.avgSemester} hint="Computed from all students" />
      </div>

      <div className={styles.grid2}>
        <div className="card" style={{ padding: 16 }}>
          <div className={styles.sectionTitle}>Students by Department</div>
          <BarLikeChart
            items={(stats.studentsByDepartment || []).slice(0, 8).filter((x) => x.count > 0)}
            color={'rgba(124,58,237,.75)'}
          />
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className={styles.sectionTitle}>Students by Semester</div>
          <BarLikeChart
            items={(stats.studentsBySemester || []).slice(0, 8)}
            color={'rgba(34,197,94,.7)'}
          />
        </div>
      </div>

      <div className={styles.recentWrap}>
        <div className="card" style={{ padding: 16 }}>
          <div className={styles.sectionTitle}>Recently Added Students</div>
          {recent.length === 0 ? (
            <div style={{ color: 'var(--muted)', marginTop: 10 }}>No students yet.</div>
          ) : (
            <div className={styles.recentList}>
              {recent.map((s) => (
                <div key={s._id} className={styles.recentItem}>
                  <img
                    alt={s.name}
                    src={s.profilePhoto || 'https://placehold.co/40x40/png?text=👤'}
                    style={{ width: 36, height: 36, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,.08)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{s.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{s.usn} • {s.department}</div>
                  </div>
                  <div className="badge" style={{ marginLeft: 10 }}>Sem {s.semester}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

