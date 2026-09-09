import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './auth.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Cases from './pages/Cases.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import Clients from './pages/Clients.jsx';
import ConflictCheck from './pages/ConflictCheck.jsx';
import Hearings from './pages/Hearings.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Deadlines from './pages/Deadlines.jsx';
import Tasks from './pages/Tasks.jsx';
import Documents from './pages/Documents.jsx';
import Templates from './pages/Templates.jsx';
import Library from './pages/Library.jsx';
import Directory from './pages/Directory.jsx';
import Finance from './pages/Finance.jsx';
import Contacts from './pages/Contacts.jsx';
import Staff from './pages/Staff.jsx';
import Archives from './pages/Archives.jsx';
import Reports from './pages/Reports.jsx';
import SearchPage from './pages/SearchPage.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<Clients />} />
        <Route path="/conflict" element={<ConflictCheck />} />
        <Route path="/hearings" element={<Hearings />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/deadlines" element={<Deadlines />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/library/*" element={<Library />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/archives" element={<Archives />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
