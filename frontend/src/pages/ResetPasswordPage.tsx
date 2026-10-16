import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { authApi } from '../services/api';

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
    <div className="min-h-screen w-full bg-slate-50 text-slate-800 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Visual Enhancements */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100/80 to-indigo-50/40 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.6) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 md:py-12 flex-1 flex flex-col justify-between">
        {/* Top Navbar / Brand Header */}
        <header className="flex items-center justify-between pb-6">
          <Link to="/login" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                V-SMART
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  Secure Portal
                </span>
              </span>
              <p className="text-[11px] text-slate-500 font-medium tracking-wide">
                Velan Stock, Material &amp; Asset Resource Tracker
              </p>
            </div>
          </Link>
        </header>

        {/* Center Split Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-8 my-auto">
          {/* Left Column: Enterprise Security Branding */}
          <div className="lg:col-span-7 flex flex-col space-y-6 pr-0 lg:pr-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 w-fit">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-indigo-800">
                Encrypted Credential Protection
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
              Secure your account,{' '}
              <br className="hidden sm:inline" />
              resume{' '}
              <span className="text-indigo-600">
                seamless operations.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed font-normal">
              Set a strong, high-entropy password to protect critical inventory records, engineering
              specifications, and production dispatch workflows.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Bcrypt Password Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Automatic Session Revocation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Zero-Trust Architecture</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/70 border border-slate-200/80 text-slate-900 transition-all">
              {isVerifying ? (
                /* Verifying State */
                <div className="py-12 text-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm font-medium text-slate-600">
                    Verifying security token...
                  </p>
                </div>
              ) : !tokenValid ? (
                /* Invalid / Expired Token State */
                <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <XCircle className="w-7 h-7 text-rose-600" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      Link Invalid or Expired
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      {verifyError || 'This password reset link is invalid, expired, or has already been used.'}
                    </p>
                  </div>

                  <div className="pt-2 space-y-3">
                    <Link
                      to="/forgot-password"
                      className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Request a New Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors w-full"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Return to Sign In
                    </Link>
                  </div>
                </div>
              ) : submitSuccess ? (
                /* Password Reset Success State */
                <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      Password Reset Complete
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      Your password has been securely updated. All previous active sessions have
                      been signed out for your safety.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/login', { replace: true })}
                      className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Proceed to Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Set New Password Form */
                <div className="space-y-6">
                  {/* Top Lock Badge */}
                  <div className="flex justify-center">
                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                      <Lock className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="text-center space-y-1.5">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      Set New Password
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {userEmail ? (
                        <span>
                          Updating credentials for{' '}
                          <strong className="text-slate-700">{userEmail}</strong>
                        </span>
                      ) : (
                        'Enter your new secure password below'
                      )}
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* New Password */}
                    <div>
                      <label
                        htmlFor="new-password"
                        className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2"
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          id="new-password"
                          name="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-4 pr-11 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2"
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirm-password"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-4 pr-11 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password Requirements Checklist */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                            hasMinLength
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span className={hasMinLength ? 'text-emerald-700 font-medium' : ''}>
                          At least 8 characters
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                            hasLetter && hasNumber
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span
                          className={hasLetter && hasNumber ? 'text-emerald-700 font-medium' : ''}
                        >
                          Contains letters and numbers
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                            passwordsMatch
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span className={passwordsMatch ? 'text-emerald-700 font-medium' : ''}>
                          Passwords match
                        </span>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                        {errorMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !isFormValid}
                      className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <span>Reset Password</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Return to Sign In */}
                  <div className="text-center pt-2">
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Return to Sign In
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="pt-6 border-t border-slate-200/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 V-SMART Enterprise Systems. All rights reserved.</p>
          <div className="flex items-center gap-6 text-[11px] text-slate-400">
            <span className="hover:text-slate-600 transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-600 transition-colors cursor-pointer">Security Standards</span>
            <span className="hover:text-slate-600 transition-colors cursor-pointer">Support Portal</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
