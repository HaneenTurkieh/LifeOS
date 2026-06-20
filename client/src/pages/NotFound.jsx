import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';

export default function NotFound() {
  return (
    <div className="pt-20">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="That page doesn't exist. Let's get you back to your dashboard."
        action={<Link to="/" className="btn-primary mt-2">Back to Dashboard</Link>}
      />
    </div>
  );
}