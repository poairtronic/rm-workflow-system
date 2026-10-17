import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ArrowLeft, Loader2, CheckCircle2, Sun, Moon } from 'lucide-react';
import { authApi } from '../services/api';
import { getCurrentTheme, applyTheme } from '../utils/theme';

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      await authApi.forgotPassword(identifier.trim());
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Unable to process your request at this time. Please try again.',
      );
    } finally {
      setIsLoading(false);
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
            <KeyRound className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Forgot Password
        </h2>
        <p className="mt-1.5 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Velan Stock, Material &amp; Asset Resource Tracker
        </p>
      </div>

      {/* Centered Auth Card */}
      <div className="mt-6 sm:mt-8 w-full max-w-sm sm:max-w-md mx-auto">
        <div className="bg-white dark:bg-[#121526] py-6 sm:py-8 px-5 sm:px-8 shadow-xl sm:shadow-lg rounded-2xl border border-slate-200 dark:border-[#1e233d]">
          {submitted ? (
            /* Success State */
            <div className="text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Check Your Inbox
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  If an account exists for <strong className="text-slate-900 dark:text-white break-all">{identifier}</strong>, we have sent a password reset link.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-[#0e111f] rounded-lg p-3 text-left border border-slate-200 dark:border-[#1e233d]">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  • The reset link is valid for <strong>60 minutes</strong>.
                  <br />
                  • If you don't receive an email, please verify the address or check spam.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  to="/login"
                  className="w-full min-h-[44px] h-11 flex justify-center items-center px-4 border border-transparent rounded-xl shadow-sm text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  Return to Sign In
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setIdentifier('');
                  }}
                  className="w-full min-h-[44px] text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors py-2 flex items-center justify-center cursor-pointer"
                >
                  Try another email / ID
                </button>
              </div>
            </div>
          ) : (
            /* Reset Request Form */
            <form className="space-y-5" onSubmit={handleSubmit}>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Enter your registered Employee ID or email address to receive a secure password reset link.
              </p>

              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Employee ID / Email
                </label>
                <div className="mt-1">
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your ID or email"
                    className="w-full min-h-[44px] h-11 px-3.5 rounded-xl border border-slate-200 dark:border-[#1e233d] text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 dark:bg-[#0e111f] dark:text-white transition-colors"
                  />
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
                  disabled={isLoading || !identifier.trim()}
                  className="w-full min-h-[44px] h-11 flex justify-center items-center px-4 border border-transparent rounded-xl shadow-sm text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Send Reset Link'
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
