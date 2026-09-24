import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { NotificationSettingsService } from '../services/notificationSettings.service';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

export const NotificationSettingsPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  // State
  const [globalEnabled, setGlobalEnabled] = useState<boolean | null>(null);
  const [userEnabled, setUserEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingGlobal, setSavingGlobal] = useState<boolean>(false);
  const [savingUser, setSavingUser] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      if (isAdmin) {
        const [globalRes, userRes] = await Promise.all([
          NotificationSettingsService.getGlobalSettings(),
          NotificationSettingsService.getMyPreferences(),
        ]);
        setGlobalEnabled(globalRes.workflowEmailEnabled);
        setUserEnabled(userRes.workflowEmailEnabled);
      } else {
        const userRes = await NotificationSettingsService.getMyPreferences();
        setUserEnabled(userRes.workflowEmailEnabled);
      }
    } catch (err: any) {
      setFetchError(err.message || 'Unable to load notification settings.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleGlobalToggle = async () => {
    if (globalEnabled === null || savingGlobal) return;
    const nextVal = !globalEnabled;
    const prevVal = globalEnabled;
    setSavingGlobal(true);
    // Optimistic UI update with rollback on failure
    setGlobalEnabled(nextVal);

    try {
      const res = await NotificationSettingsService.updateGlobalSettings(nextVal);
      setGlobalEnabled(res.workflowEmailEnabled);
      showToast('success', 'Global notification settings updated.');
    } catch (err: any) {
      setGlobalEnabled(prevVal);
      showToast('error', err.message || 'Failed to update global notification settings.');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleUserToggle = async () => {
    if (userEnabled === null || savingUser) return;
    const nextVal = !userEnabled;
    const prevVal = userEnabled;
    setSavingUser(true);
    setUserEnabled(nextVal);

    try {
      const res = await NotificationSettingsService.updateMyPreferences(nextVal);
      setUserEnabled(res.workflowEmailEnabled);
      showToast('success', 'Personal notification preferences updated.');
    } catch (err: any) {
      setUserEnabled(prevVal);
      showToast('error', err.message || 'Failed to update personal notification preferences.');
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div className="settings-header" style={{ marginBottom: '28px' }}>
        <h1 className="title" style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px' }}>
          Notifications &amp; Alerts
        </h1>
        <p className="subtitle" style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
          Manage how RMRIT communicates workflow updates across email and in-app channels.
        </p>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontWeight: 600,
            fontSize: '14px',
            backgroundColor: toast.type === 'success' ? '#065f46' : '#991b1b',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{toast.type === 'success' ? '✓ ' : '✕ '}{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Fetch Error */}
      {fetchError && (
        <div style={{ marginBottom: '24px' }}>
          <Card title="Error Loading Settings" className="border-error">
            <p style={{ color: '#f87171', margin: '0 0 16px' }}>{fetchError}</p>
            <Button onClick={loadSettings} variant="primary" size="sm">
              ↻ Retry Loading Settings
            </Button>
          </Card>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <Card title="Loading Settings...">
          <div className="flex-center p-6 text-center">
            <span className="badge badge-warning">Retrieving notification configuration from RMRIT server...</span>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* ADMIN ONLY: Global Workflow Email Toggle */}
          {isAdmin && (
            <Card
              title="GLOBAL EMAIL NOTIFICATIONS"
              subtitle="Control workflow email notifications across the entire RMRIT application."
              className="primary-card"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
                    Global Workflow Email System
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    When disabled, workflow email jobs will not be queued for any user across the system.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: globalEnabled ? '#34d399' : '#f87171',
                    }}
                  >
                    {globalEnabled ? 'ON' : 'OFF'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={globalEnabled || false}
                    aria-label="Global Email Notifications Toggle"
                    onClick={handleGlobalToggle}
                    disabled={savingGlobal}
                    style={{
                      position: 'relative',
                      width: '52px',
                      height: '28px',
                      borderRadius: '14px',
                      backgroundColor: globalEnabled ? '#2563eb' : '#475569',
                      border: 'none',
                      cursor: savingGlobal ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      opacity: savingGlobal ? 0.6 : 1,
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '3px',
                        left: globalEnabled ? '27px' : '3px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        transition: 'left 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* USER: Personal Workflow Email Preference */}
          <Card
            title="WORKFLOW EMAILS"
            subtitle="Receive email notifications for approved RMRIT workflow events."
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 0',
              }}
            >
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
                  Personal Workflow Email Notifications
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                  Send email notifications to your account when workflow actions (e.g., RM Submitted, Material Issued, SC Completed) occur.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: userEnabled ? '#34d399' : '#f87171',
                  }}
                >
                  {userEnabled ? 'ON' : 'OFF'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={userEnabled || false}
                  aria-label="Personal Workflow Email Notifications Toggle"
                  onClick={handleUserToggle}
                  disabled={savingUser}
                  style={{
                    position: 'relative',
                    width: '52px',
                    height: '28px',
                    borderRadius: '14px',
                    backgroundColor: userEnabled ? '#2563eb' : '#475569',
                    border: 'none',
                    cursor: savingUser ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    opacity: savingUser ? 0.6 : 1,
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: userEnabled ? '27px' : '3px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Operational Guidance Card */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              fontSize: '13px',
              color: '#cbd5e1',
              lineHeight: 1.6,
            }}
          >
            <h5 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>
              Channel Independence &amp; Security Policy
            </h5>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>
                <strong>In-App Notifications:</strong> Always created and available in the RMRIT interface regardless of email preference settings.
              </li>
              <li>
                <strong>Workflow Email Suppression:</strong> Turning off workflow email suppresses outgoing email delivery without affecting in-app notifications.
              </li>
              <li>
                <strong>Mandatory Security Emails:</strong> Critical security notices (such as Password Reset requests) remain independent of workflow email settings.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
