import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { Shield, Loader2, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleDefaultPath, isPathAllowedForUser } from '../routeConfig';
import { getCurrentTheme, applyTheme } from '../utils/theme';

export function LoginView() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTheme, setCurrentTheme] = useState(() => getCurrentTheme());

  useEffect(() => {
    const handler = (e: any) => {
      setCurrentTheme(e.detail?.theme || getCurrentTheme());
    };
    window.addEventListener('theme-changed', handler);
    return () => window.removeEventListener('theme-changed', handler);
  }, []);

  const toggleTheme = () => {
    const nextTheme = currentTheme === 'Modern Dark' ? 'Enterprise Light' : 'Modern Dark';
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
  };

  if (isAuthenticated && currentUser) {
    const rawFrom = location.state?.from;
    const target = isPathAllowedForUser(rawFrom, currentUser)
      ? rawFrom
      : getRoleDefaultPath(currentUser.role);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const loggedInUser = await login({ employeeId, password });
      const rawFrom = location.state?.from;
      const target = isPathAllowedForUser(rawFrom, loggedInUser)
        ? rawFrom
        : getRoleDefaultPath(loggedInUser?.role);
      navigate(target, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090a10] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors">
      {/* Top Right Quick Theme Switcher */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-[#8896ab] hover:text-primary dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-[#161a2e] border border-transparent dark:border-[#1e233d] transition-colors cursor-pointer"
          title={currentTheme === 'Modern Dark' ? 'Switch to Light Mode' : 'Switch to Modern Dark Mode'}
        >
          {currentTheme === 'Modern Dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          V-SMART Secure Portal
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Velan Stock, Material &amp; Asset Resource Tracker
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#121526] py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-slate-200 dark:border-[#1e233d]">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee ID / Email
              </label>
              <div className="mt-1">
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-slate-200 dark:border-[#1e233d] text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 dark:bg-[#0e111f] dark:text-white transition-colors"
                  placeholder="Enter your ID or email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-slate-200 dark:border-[#1e233d] text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 dark:bg-[#0e111f] dark:text-white transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-900/50">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting || !employeeId || !password}
                className="w-full flex justify-center items-center h-10 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            For access issues, please contact IT Support.
          </div>
        </div>
      </div>
    </div>
  );
}
