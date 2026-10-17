import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  Check,
  Sun,
  Moon,
} from 'lucide-react';
import { authApi } from '../services/api';
import { getCurrentTheme, applyTheme } from '../utils/theme';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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

  // Validate token on mount
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        setIsVerifying(false);
        setTokenValid(false);
        setVerifyError('Password reset token is missing from this URL.');
        return;
      }

      try {
        const res = await authApi.verifyResetToken(token);
        if (!isMounted) return;

        if (res?.valid) {
          setTokenValid(true);
          setUserEmail(res.email || '');
        } else {
          setTokenValid(false);
          setVerifyError(
            res?.message || 'This password reset link is invalid or has expired.',
          );
        }
      } catch (err: any) {
        if (!isMounted) return;
        setTokenValid(false);
        setVerifyError(
          err?.message || 'Unable to verify reset link. It may have expired or already been used.',
        );
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    }

    checkToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isFormValid = hasMinLength && hasLetter && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await authApi.resetPassword({ token, newPassword });
      setSubmitSuccess(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to reset password. The link may have expired.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-[#090a10] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative transition-colors font-sans overflow-x-hidden">
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

      {/* Brand Header */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Set New Password
        </h2>
        <p className="mt-1.5 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Velan Stock, Material &amp; Asset Resource Tracker
        </p>
      </div>

      {/* Centered Auth Card */}
      <div className="mt-6 sm:mt-8 w-full max-w-sm sm:max-w-md mx-auto">
        <div className="bg-white dark:bg-[#121526] py-6 sm:py-8 px-5 sm:px-8 shadow-xl sm:shadow-lg rounded-2xl border border-slate-200 dark:border-[#1e233d]">
          {isVerifying ? (
            /* Verifying Token State */
            <div className="py-10 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Verifying security token...
              </p>
            </div>
          ) : !tokenValid ? (
            /* Invalid / Expired Token State */
            <div className="text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Link Invalid or Expired
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {verifyError || 'This password reset link is invalid, expired, or has already been used.'}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  to="/forgot-password"
                  className="w-full min-h-[44px] h-11 flex justify-center items-center px-4 border border-transparent rounded-xl shadow-sm text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  Request a New Reset Link
                </Link>

                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Return to Sign In
                  </Link>
                </div>
              </div>
            </div>
          ) : submitSuccess ? (
            /* Password Reset Success State */
            <div className="text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Password Reset Complete
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Your password has been successfully updated. All active sessions have been signed out for security.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full min-h-[44px] h-11 flex justify-center items-center px-4 border border-transparent rounded-xl shadow-sm text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  Proceed to Sign In
                </button>
              </div>
            </div>
          ) : (
            /* Set New Password Form */
            <form className="space-y-5" onSubmit={handleSubmit}>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {userEmail ? (
                  <span>
                    Setting new password for <strong className="text-slate-900 dark:text-white">{userEmail}</strong>
                  </span>
                ) : (
                  'Create a new password for your account.'
                )}
              </p>

              {/* New Password */}
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  New Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] h-11 px-3.5 pr-10 rounded-xl border border-slate-200 dark:border-[#1e233d] text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 dark:bg-[#0e111f] dark:text-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] h-11 px-3.5 pr-10 rounded-xl border border-slate-200 dark:border-[#1e233d] text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 dark:bg-[#0e111f] dark:text-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="bg-slate-50 dark:bg-[#0e111f] rounded-lg p-3 border border-slate-200 dark:border-[#1e233d] space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      hasMinLength
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={hasMinLength ? 'text-emerald-700 dark:text-emerald-300 font-medium' : ''}>
                    At least 8 characters
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      hasLetter && hasNumber
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span
                    className={
                      hasLetter && hasNumber ? 'text-emerald-700 dark:text-emerald-300 font-medium' : ''
                    }
                  >
                    Contains letters and numbers
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      passwordsMatch
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={passwordsMatch ? 'text-emerald-700 dark:text-emerald-300 font-medium' : ''}>
                    Passwords match
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium">
                    {errorMessage}
                  </p>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="w-full min-h-[44px] h-11 flex justify-center items-center px-4 border border-transparent rounded-xl shadow-sm text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to Sign In
                </Link>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            For access issues, please contact IT Support.
          </div>
        </div>
      </div>
    </div>
  );
}
