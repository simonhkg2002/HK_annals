import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { DailyArchive } from './pages/DailyArchive';
import { MediaPage } from './pages/MediaPage';
import { SeriesBoard } from './pages/SeriesBoard';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { ReviewQueue } from './pages/ReviewQueue';
import { NewsDetail } from './pages/NewsDetail';
import { AdminUser } from './lib/data';

const ADMIN_STORAGE_KEY = 'hk_portal_session';

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
          <Route path="/series" element={<SeriesBoard />} />
          <Route
            path="/portal_9f3k2m"
            element={
              adminUser ? (
                <Navigate to="/portal_9f3k2m/console" replace />
              ) : (
                <AdminLogin onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/portal_9f3k2m/console"
            element={
              <AdminDashboard user={adminUser} onLogout={handleLogout} />
            }
          />
          <Route
            path="/portal_9f3k2m/review"
            element={
              <ReviewQueue />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
