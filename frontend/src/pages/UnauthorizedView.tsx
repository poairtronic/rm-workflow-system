import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleDefaultPath } from '../routeConfig';

export function UnauthorizedView() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 items-center">
      <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Access Denied</h2>
      <p className="text-slate-600 mb-6">You do not have access to view this page.</p>
      <Link
        to={currentUser ? getRoleDefaultPath(currentUser.role) : '/'}
        className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
      >
        Return to Home
      </Link>
    </div>
  );
}
