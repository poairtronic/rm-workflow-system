import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { profileApi } from '../services/api';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { PageHeader } from '../components/ui';
import {
  User as UserIcon,
  Mail,
  Building2,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  LogOut,
  Eye,
  EyeOff,
  Check,
  X,
  Lock,
  Edit2,
  Save,
  CheckCircle2,
} from 'lucide-react';

export function ProfileWorkspace() {
  const { currentUser, logout, refreshUser } = useAuth();

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setDepartment(currentUser.department || '');
    }
  }, [currentUser]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshUser();
      toast.success('Profile refreshed.');
    } catch {
      toast.error('Could not refresh profile.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    try {
      setSavingProfile(true);
      await profileApi.updateProfile({ name: name.trim(), department: department.trim() });
      await refreshUser();
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Password Strength Calculation
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const validScore = [hasMinLength, hasUpper, hasLower, hasNumberOrSpecial].filter(Boolean).length;
  const isFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasUpper &&
    hasLower &&
    hasNumberOrSpecial &&
    passwordsMatch;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast.error('Please meet all password security requirements.');
      return;
    }

    try {
      setUpdatingPassword(true);
      await profileApi.changePassword({ currentPassword, newPassword });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update password.'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  const userInitial = (currentUser?.name || currentUser?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="space-y-6 w-full pb-12">
      <PageHeader
        title="My Profile & Security"
        subtitle="Manage your personal credentials, enterprise role, and password security in one place."
        breadcrumbs={<span>Home / System Settings / Profile</span>}
        actionSlot={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* 2-Column Responsive Layout: Left = Profile Details, Right = Change Password */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ================= LEFT CARD: USER PROFILE ================= */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          {/* Header with Avatar & Identity */}
          <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-sm shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 truncate">
                  {currentUser?.name || 'Enterprise User'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {currentUser?.role || 'USER'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Emp Code: {(currentUser as any)?.employeeCode || currentUser?.id?.slice(0, 8) || 'N/A'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  <Building2 className="w-3 h-3 text-gray-500" />
                  {currentUser?.department || 'Operations'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  Active Account
                </span>
              </div>
            </div>
          </div>

          {/* Profile Form / View */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Email Address (Immutable)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    disabled
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Stores / Management"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" /> Email
                  </span>
                  <span className="font-medium text-gray-900">{currentUser?.email || '-'}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" /> Department
                  </span>
                  <span className="font-medium text-gray-900">{currentUser?.department || '-'}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-gray-400" /> Role Authority
                  </span>
                  <span className="font-semibold text-blue-700">{currentUser?.role || '-'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile Details
                </button>

                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT CARD: CHANGE PASSWORD ================= */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="pb-5 border-b border-gray-100">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <KeyRound className="w-5 h-5" />
              <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
            </div>
            <p className="text-xs text-gray-500">
              Update your authentication credentials for secure enterprise access.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter strong new password"
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Strength Meter */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Password Strength:</span>
                  <span
                    className={`font-semibold ${
                      validScore <= 2
                        ? 'text-red-500'
                        : validScore === 3
                        ? 'text-amber-500'
                        : 'text-green-600'
                    }`}
                  >
                    {validScore <= 2 ? 'Weak' : validScore === 3 ? 'Moderate' : 'Strong'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${
                      validScore <= 2
                        ? 'w-1/3 bg-red-500'
                        : validScore === 3
                        ? 'w-2/3 bg-amber-500'
                        : 'w-full bg-green-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Password Requirements Checklist */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5 text-xs">
              <span className="font-semibold text-gray-700 block">Password Requirements:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <div
                  className={`flex items-center gap-1.5 ${
                    hasMinLength ? 'text-green-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  At least 8 characters
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasUpper ? 'text-green-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {hasUpper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  Uppercase letter
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasLower ? 'text-green-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {hasLower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  Lowercase letter
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasNumberOrSpecial ? 'text-green-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {hasNumberOrSpecial ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  Number or symbol
                </div>
              </div>
              <div
                className={`flex items-center gap-1.5 pt-1 border-t border-gray-200 ${
                  passwordsMatch ? 'text-green-600 font-medium' : 'text-gray-400'
                }`}
              >
                {passwordsMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                Passwords match
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || updatingPassword}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              <Lock className="w-4 h-4" />
              {updatingPassword ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
