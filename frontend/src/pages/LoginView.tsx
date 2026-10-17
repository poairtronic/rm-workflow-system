import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { Shield, Loader2, Sun, Moon, ShieldCheck, Box, Truck } from 'lucide-react';
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
    <div className="min-h-[100dvh] w-full bg-slate-50 dark:bg-[#090a10] flex flex-col md:grid md:grid-cols-2 relative transition-colors overflow-x-hidden">
      {/* Top Right Quick Theme Switcher */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 dark:text-[#8896ab] hover:text-primary dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-[#161a2e] border border-slate-200/60 dark:border-[#1e233d] bg-white/70 dark:bg-[#0d0f1b]/70 backdrop-blur-xs transition-colors cursor-pointer"
          title={currentTheme === 'Modern Dark' ? 'Switch to Light Mode' : 'Switch to Modern Dark Mode'}
          aria-label="Toggle theme"
        >
          {currentTheme === 'Modern Dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>
      </div>

      {/* Desktop Left Branding Hero (Hidden on Mobile) */}
      <aside className="hidden md:flex flex-col justify-between p-8 lg:p-12 xl:p-16 bg-gradient-to-br from-[#0c101d] via-[#0d1326] to-[#080a14] border-r border-slate-200/10 dark:border-[#1a1e33] relative overflow-hidden text-white select-none">
        {/* Subtle Ambient Background Glows */}
        <div className="absolute top-0 -left-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/25 border border-indigo-400/30 flex items-center justify-center text-indigo-400 font-black text-lg shadow-lg">
            V
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white block leading-none">V-SMART</span>
            <span className="text-[11px] text-indigo-300/80 font-medium tracking-wider uppercase">Material Governance System</span>
          </div>
        </div>

        {/* Center Hero Proposition */}
        <div className="relative z-10 my-auto py-8 space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Industrial RM &amp; DC Governance Platform
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Precision control across materials, challans &amp; production.
          </h1>

          <p className="text-sm text-slate-300/90 leading-relaxed">
            End-to-end material issuance verification, multi-stage delivery challan movements, and immutable audit trails for stores, design, and manufacturing floors.
          </p>

          <div className="grid gap-3 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Dual Verification Handshake</p>
                <p className="text-[11px] text-slate-400">Stores issuance and Production verification with zero discrepancies</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Type 1 &amp; Type 2 DC Lifecycle</p>
                <p className="text-[11px] text-slate-400">Complete outward dispatch, vendor tracking, and dock return verification</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Box className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Live Stock &amp; MSL Observability</p>
                <p className="text-[11px] text-slate-400">Automated minimum stock alerts and supplier inward (GRN) logging</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Compliance & Version */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-4">
          <span>Enterprise 256-bit TLS Encrypted</span>
          <span>v2.4 Production Baseline</span>
        </div>
      </aside>

      {/* Right Column: Form Container (Desktop: Centered; Mobile: Full Width with Compact Top Banner) */}
      <main className="flex-1 flex flex-col justify-between py-6 px-4 sm:px-8 lg:px-12 xl:px-16 relative">
        {/* Mobile Compact Top Banner (Collapsed from left pane) */}
        <header className="md:hidden pt-4 pb-2 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl shadow-xs mb-2.5">
            V
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            V-SMART Secure Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Material &amp; Delivery Challan Governance
          </p>
        </header>

        {/* Vertically Centered Login Form Card */}
        <div className="my-auto w-full max-w-sm sm:max-w-md mx-auto py-4">
          <div className="bg-white dark:bg-[#121526] p-6 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-[#1e233d] shadow-xl sm:shadow-lg transition-colors">
            {/* Desktop form title header */}
            <div className="hidden md:block mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Sign In
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your employee credentials to access your workspace.
              </p>
            </div>

            {/* Mobile form heading */}
            <div className="md:hidden mb-5 text-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Sign in to your account
              </h2>
            </div>

            <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="employeeId"
                  className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Employee ID / Email
                </label>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  required
                  autoComplete="username"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full min-h-[44px] h-11 px-3.5 rounded-xl border border-slate-200 dark:border-[#1e233d] text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 dark:bg-[#0e111f] text-slate-900 dark:text-white transition-colors placeholder:text-slate-400 dark:placeholder:text-[#55627a]"
                  placeholder="e.g. EMP1029 or name@velan.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline p-1 -mr-1 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] h-11 px-3.5 rounded-xl border border-slate-200 dark:border-[#1e233d] text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 dark:bg-[#0e111f] text-slate-900 dark:text-white transition-colors placeholder:text-slate-400 dark:placeholder:text-[#55627a]"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50 animate-in fade-in duration-150">
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !employeeId || !password}
                className="w-full min-h-[44px] h-11 px-4 border border-transparent rounded-xl shadow-sm text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              For account or access issues, please contact your System Administrator.
            </div>
          </div>
        </div>

        {/* Footer for mobile/desktop */}
        <footer className="text-center py-2 text-[11px] text-slate-400 dark:text-[#55627a]">
          &copy; {new Date().getFullYear()} V-SMART Material Governance. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
