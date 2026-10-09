import { useState } from 'react';
import { Modal, FormField, TextInput, Button } from '../ui';
import { KeyRound, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password complexity checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumberOrSymbol = /[\d\W]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasUpper &&
    hasLower &&
    hasNumberOrSymbol &&
    isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    if (currentPassword === newPassword) {
      toast.error('New password cannot be the same as the current password');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      toast.success(res.message || 'Password changed successfully!');
      handleClose();
    } catch (err: any) {
      // Error is toasted by ApiClient or extracted here
      const msg = err?.message || 'Failed to change password';
      if (!msg.includes('failed: 400')) {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2 text-slate-800">
          <KeyRound className="w-5 h-5 text-primary" />
          <span className="font-semibold text-base">Change Password</span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <FormField label="Current Password" required>
          <div className="relative">
            <TextInput
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FormField>

        <FormField label="New Password" required>
          <div className="relative">
            <TextInput
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new strong password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FormField>

        <FormField label="Confirm New Password" required>
          <TextInput
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            error={confirmPassword.length > 0 && !isMatch}
          />
          {confirmPassword.length > 0 && !isMatch && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
        </FormField>

        {/* Complexity validation checklist */}
        <div className="bg-slate-50 p-3 rounded-md text-xs space-y-1.5 border border-slate-200">
          <span className="font-medium text-slate-700 block mb-1">Password Requirements:</span>
          <div className="flex items-center gap-1.5 text-slate-600">
            {hasMinLength ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className={hasMinLength ? 'text-emerald-700 font-medium' : ''}>
              At least 8 characters
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            {hasUpper ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className={hasUpper ? 'text-emerald-700 font-medium' : ''}>
              At least 1 uppercase letter
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            {hasLower ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className={hasLower ? 'text-emerald-700 font-medium' : ''}>
              At least 1 lowercase letter
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            {hasNumberOrSymbol ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className={hasNumberOrSymbol ? 'text-emerald-700 font-medium' : ''}>
              At least 1 number or special character
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
