import { useState, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleDefaultPath, isPathAllowedForUser } from '../routeConfig';
import { getCurrentTheme, applyTheme } from '../utils/theme';
import './LoginView.css';

export function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
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
    const isLight =
      document.documentElement.getAttribute('data-theme') === 'light' ||
      currentTheme === 'Enterprise Light';
    const nextTheme = isLight ? 'Modern Dark' : 'Enterprise Light';
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const handleCaps = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  if (isAuthenticated && currentUser) {
    const rawFrom = location.state?.from;
    const target = isPathAllowedForUser(rawFrom, currentUser)
      ? rawFrom
      : getRoleDefaultPath(currentUser.role);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) {
      setError('Enter your employee ID or email and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const loggedInUser = await login({ employeeId: u, username: u, password });
      const rawFrom = location.state?.from;
      const target = isPathAllowedForUser(rawFrom, loggedInUser)
        ? rawFrom
        : getRoleDefaultPath(loggedInUser?.role);
      navigate(target, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Incorrect ID or password. Check and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="vsmart-login-page">
      {/* ---------- Left: brand + photo watermark ---------- */}
      <aside className="brand">
        <div className="logo">
          <div className="logo-mark">V</div>
          <div>
            <b>V-SMART</b>
            <span>Material Governance System</span>
          </div>
        </div>

        <div className="hero">
          <span className="badge">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            </svg>
            Industrial RM &amp; DC Governance Platform
          </span>
          <h1>Precision control across materials, challans &amp; production.</h1>
          <p>
            End-to-end material issuance verification, multi-stage delivery challan movements,
            and immutable audit trails for stores, design, and manufacturing floors.
          </p>

          <ul className="feats">
            <li className="feat">
              <span className="ico">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <div>
                <b>Dual Verification Handshake</b>
                <small>Stores issuance and Production verification with zero discrepancies</small>
              </div>
            </li>
            <li className="feat">
              <span className="ico">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
                  <circle cx="7" cy="18" r="1.8" />
                  <circle cx="17" cy="18" r="1.8" />
                </svg>
              </span>
              <div>
                <b>Type 1 &amp; Type 2 DC Lifecycle</b>
                <small>Complete outward dispatch, vendor tracking, and dock return verification</small>
              </div>
            </li>
            <li className="feat">
              <span className="ico">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                  <path d="M4 7.5L12 12l8-4.5M12 12v9" />
                </svg>
              </span>
              <div>
                <b>Live Stock &amp; MSL Observability</b>
                <small>Automated minimum stock alerts and supplier inward (GRN) logging</small>
              </div>
            </li>
          </ul>
        </div>

        <div className="bfoot">
          <span>Enterprise 256-bit TLS Encrypted</span>
          <span>v2.4 Production Baseline</span>
        </div>
      </aside>

      {/* ---------- Right: sign in ---------- */}
      <main className="side">
        <button
          className="themebtn"
          id="theme"
          type="button"
          onClick={toggleTheme}
          aria-label="Switch colour theme"
        >
          <svg
            className="i-moon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
          </svg>
          <svg
            className="i-sun"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>

        <div className="card">
          <h2>Sign In</h2>
          <p className="sub">Enter your employee credentials to access your workspace.</p>

          <form id="loginForm" onSubmit={handleSubmit} noValidate>
            <div className={`err ${error ? 'on' : ''}`} id="err" role="alert">
              {error}
            </div>

            <div className="f">
              <label htmlFor="username">Employee ID / Email</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="e.g. VM1042 or name@company.com"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="f pw">
              <div className="lr">
                <label htmlFor="password">Password</label>
                <Link className="link" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleCaps}
                onKeyUp={handleCaps}
              />
              <button
                type="button"
                className="eye"
                id="eye"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
              <div className={`caps ${capsLockOn ? 'on' : ''}`} id="caps">
                Caps Lock is on.
              </div>
            </div>

            <button className="go" id="go" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="help">
            For account or access issues, please contact your System Administrator.
          </p>
        </div>

        <div className="foot">© 2026 V-SMART Material Governance. All rights reserved.</div>
      </main>
    </div>
  );
}
