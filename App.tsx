import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { DailyArchive } from './pages/DailyArchive';
import { MediaPage } from './pages/MediaPage';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { NewsDetail } from './pages/NewsDetail';
import { AdminUser } from './lib/data';

const ADMIN_STORAGE_KEY = 'hk_annals_admin';

function App() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // 從 localStorage 恢復登入狀態
  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      try {
        setAdminUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      }
    }
  }, []);

  const handleLogin = (user: AdminUser) => {
    setAdminUser(user);
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
    setAdminUser(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  };

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route path="/daily" element={<DailyArchive />} />
          <Route path="/media" element={<MediaPage />} />
          <Route
            path="/admin/login"
            element={
              adminUser ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <AdminLogin onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <AdminDashboard user={adminUser} onLogout={handleLogout} />
            }
          />
          <Route
            path="/admin"
            element={
              <Navigate to={adminUser ? '/admin/dashboard' : '/admin/login'} replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
