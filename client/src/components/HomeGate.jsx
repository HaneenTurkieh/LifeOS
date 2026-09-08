import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

// Same gate as ProtectedRoute (components/ProtectedRoute.jsx), with one
// addition: a logged-out visitor landing on the bare root ("/") sees the
// public homepage instead of being bounced to /login. Every other path
// under the app's "/*" route still redirects to /login exactly as before —
// this only changes what a stranger sees when they type nuvora.ps itself
// with nothing else in the URL; a deep link into, say, /tasks while
// logged out still correctly redirects to /login (and back to /tasks
// after signing in, via the same location.state.from ProtectedRoute
// already used). A logged-in visit to "/" is completely unaffected: the
// extra branch below only ever runs when `user` is falsy, so an
// authenticated visitor still renders `children` (AppShell, which shows
// Dashboard at "/" via its own nested routes) exactly like ProtectedRoute
// always has — zero change to the existing logged-in experience.
//
// `landing` is passed in by App.jsx (already holding a lazy-loaded
// reference to Landing.jsx for the /welcome route) rather than imported
// fresh here, so the marketing page's JS chunk still only ever loads once,
// not duplicated across two separate import sites.
export default function HomeGate({ children, landing }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-gradient">
        <Loader2 className="animate-spin text-lavender-500" size={32} />
      </div>
    );
  }

  if (!user) {
    if (location.pathname === '/') return landing;
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
