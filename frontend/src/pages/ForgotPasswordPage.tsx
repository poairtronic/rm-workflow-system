import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { authApi } from '../services/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      await authApi.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Unable to process your request at this time. Please try again later.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Visual Enhancements: Modern Industrial Gradients & Grid */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 md:py-12 flex-1 flex flex-col justify-between">
        {/* Top Navbar / Brand Header */}
        <header className="flex items-center justify-between pb-6">
          <Link to="/login" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                V-SMART
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Secure Portal
                </span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                Velan Stock, Material &amp; Asset Resource Tracker
              </p>
            </div>
          </Link>
        </header>

        {/* Center Split Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-8 my-auto">
          {/* Left Column: Enterprise Hero Branding */}
          <div className="lg:col-span-7 flex flex-col space-y-6 pr-0 lg:pr-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-indigo-300">
                Enterprise Identity &amp; Access Management
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
              Optimizing yield,{' '}
              <br className="hidden sm:inline" />
              tracking{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-blue-400">
                real-time cost.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300/90 max-w-xl leading-relaxed font-normal">
              Unify supply workflows, machine telemetry, automated indents, and operational costs
              into a single control plane built for modern heavy industry.
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Single Sign-On Security</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Role-Based Access Control</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Audit Trail Compliant</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Card Matching Reference Screenshot */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl shadow-indigo-950/40 border border-slate-100 text-slate-900 transition-all">
              {submitted ? (
                /* Success State */
                <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      Check Your Email
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      If an account is associated with{' '}
                      <span className="font-semibold text-slate-900 break-all">{email}</span>, we
                      have sent a secure password reset link.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 text-left border border-slate-100">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      • The link is valid for <strong>60 minutes</strong>.
                      <br />
                      • If you do not see it shortly, check your spam or junk folder.
                    </p>
                  </div>

                  <div className="pt-2 space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setEmail('');
                      }}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/60 hover:bg-indigo-50 rounded-xl transition-colors"
                    >
                      Try another email address
                    </button>

                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors w-full"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Return to Sign In
                    </Link>
                  </div>
                </div>
              ) : (
                /* Form State matching Screenshot 2 */
                <div className="space-y-6">
                  {/* Top Key Icon Badge */}
                  <div className="flex justify-center">
                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                      <KeyRound className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="text-center space-y-1.5">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      Forgot Password
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Enter your email and we'll send you a password reset link
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label
                        htmlFor="email-address"
                        className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2"
                      >
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="email-address"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@airtronic.com"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                        {errorMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Link...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Reset Link</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Bottom Return to Sign In Link */}
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
        <footer className="pt-6 border-t border-slate-800/60 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 V-SMART Enterprise Systems. All rights reserved.</p>
          <div className="flex items-center gap-6 text-[11px] text-slate-400">
            <span className="hover:text-slate-300 transition-colors">Privacy Policy</span>
            <span className="hover:text-slate-300 transition-colors">Security Standards</span>
            <span className="hover:text-slate-300 transition-colors">Support Portal</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
