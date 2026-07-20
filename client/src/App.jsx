import useTaskReminders from './hooks/useTaskReminders.js';
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import GlobalBackground from './components/GlobalBackground.jsx';
import Sidebar from './components/Sidebar.jsx';
import MobileNav from './components/MobileNav.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Goals from './pages/Goals.jsx';
import Learning from './pages/Learning.jsx';
import Analytics from './pages/Analytics.jsx';
import Internships from './pages/Internships.jsx';
import CVBuilder from './pages/CVBuilder.jsx';
import Projects from './pages/Projects.jsx';
import AITools from './pages/AITools.jsx';
import History from './pages/History.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <>
      <GlobalBackground />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function AppShell() {
  const location = useLocation();
useTaskReminders();
  return (
    <div className="min-h-screen flex relative z-10">
      <Sidebar />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-10 pt-6 max-w-[1600px] mx-auto w-full">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/internships" element={<Internships />} />
            <Route path="/cv" element={<CVBuilder />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/ai" element={<AITools />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </main>
      <MobileNav />
    </div>
  );
}
