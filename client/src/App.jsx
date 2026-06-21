import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import MobileNav from './components/MobileNav.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Goals from './pages/Goals.jsx';
import Habits from './pages/Habits.jsx';
import Learning from './pages/Learning.jsx';
import Analytics from './pages/Analytics.jsx';
import Internships from './pages/Internships.jsx';
import CVBuilder from './pages/CVBuilder.jsx';
import Projects from './pages/Projects.jsx';
import AITools from './pages/AITools.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public — no session required */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Everything else requires a logged-in user */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function AppShell() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-10 pt-6 max-w-[1600px] mx-auto w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/internships" element={<Internships />} />
          <Route path="/cv" element={<CVBuilder />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/ai" element={<AITools />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <MobileNav />
    </div>
  );
}