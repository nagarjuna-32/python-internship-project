import React, { useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, GraduationCap, LayoutDashboard, LogOut, Menu, Plus, Search } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import styles from './layout.module.css';

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const nav = useMemo(
    () => [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/students', label: 'Students', icon: GraduationCap }
    ],
    []
  );

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandMark}>
            <BarChart3 size={18} />
          </div>
          <div className={styles.brandText}>
            <div className={styles.brandTitle}>Student PMS</div>
            <div className={styles.brandSub}>Admin Dashboard</div>
          </div>
          <button className={styles.iconBtn} onClick={() => setCollapsed((v) => !v)} aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
        </div>

        <nav className={styles.nav}>
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}>
                <Icon size={18} />
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} type="button" title="Logout (demo)" onClick={() => {}}>
            <LogOut size={18} />
            <span className={styles.navLabel}>Logout</span>
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageTitle}>
              {location.pathname.startsWith('/dashboard') ? 'Dashboard' : 'Students'}
            </div>
            <div className={styles.pageHint}>Manage student records efficiently</div>
          </div>

          <div className={styles.topbarRight}>
            {location.pathname.startsWith('/students') && !location.pathname.includes('/edit') && !location.pathname.includes('/new') ? (
              <Link to="/students/new" className="btn btnPrimary">
                <Plus size={18} />
                Add Student
              </Link>
            ) : null}
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      <ToastContainer position="top-right" autoClose={2400} hideProgressBar theme="dark" />
    </div>
  );
}

