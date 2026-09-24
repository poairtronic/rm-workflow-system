import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { EmailObservabilityService, type EmailQueueObservabilitySummary } from '../services/emailObservability.service';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const EmailObservabilityPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [metrics, setMetrics] = useState<EmailQueueObservabilitySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadMetrics = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setFetchError(null);

    try {
      const data = await EmailObservabilityService.getObservability();
      setMetrics(data);
    } catch (err: any) {
      setFetchError(err.message || 'Unable to load email queue status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadMetrics();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadMetrics]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'None recorded';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  if (!isAdmin) {
    return (
      <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        <Card title="Access Restricted" className="border-error">
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <p style={{ color: '#f87171', fontSize: '15px', fontWeight: 600, margin: '0 0 8px' }}>
              Access Denied
            </p>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
              Email Queue Observability is restricted to Administrator role.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div
        className="observability-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1 className="title" style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px', color: '#f8fafc' }}>
            Email Queue Health &amp; Observability
          </h1>
          <p className="subtitle" style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Read-only operational status and health metrics of the RMRIT email delivery queue.
          </p>
        </div>

        <Button
          onClick={() => loadMetrics(true)}
          disabled={loading || refreshing}
          variant="secondary"
          size="sm"
        >
          {refreshing ? '↻ Refreshing...' : '↻ Refresh Status'}
        </Button>
      </div>

      {/* Fetch Error State */}
      {fetchError && (
        <div style={{ marginBottom: '24px' }}>
          <Card title="Operational Error" className="border-error">
            <p style={{ color: '#f87171', margin: '0 0 16px', fontWeight: 500 }}>
              {fetchError}
            </p>
            <Button onClick={() => loadMetrics()} variant="primary" size="sm">
              ↻ Retry Loading Metrics
            </Button>
          </Card>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <Card title="Loading Queue Metrics...">
          <div className="flex-center p-8 text-center">
            <span className="badge badge-warning">
              Retrieving database-aggregated email metrics from RMRIT server...
            </span>
          </div>
        </Card>
      ) : metrics ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status Metric Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {/* PENDING */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: metrics.pending > 0 ? '1px solid #f59e0b' : '1px solid #334155',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Pending
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: metrics.pending > 0 ? '#f59e0b' : '#f8fafc' }}>
                {metrics.pending}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Waiting for worker claim
              </div>
            </div>

            {/* PROCESSING */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: metrics.processing > 0 ? '1px solid #3b82f6' : '1px solid #334155',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Processing
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: metrics.processing > 0 ? '#60a5fa' : '#f8fafc' }}>
                {metrics.processing}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Active worker processing
              </div>
            </div>

            {/* RETRYING */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: metrics.retrying > 0 ? '1px solid #fb923c' : '1px solid #334155',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Retrying
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: metrics.retrying > 0 ? '#fb923c' : '#f8fafc' }}>
                {metrics.retrying}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Awaiting retry backoff
              </div>
            </div>

            {/* FAILED */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: metrics.failed > 0 ? '1px solid #ef4444' : '1px solid #334155',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Failed
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: metrics.failed > 0 ? '#f87171' : '#f8fafc' }}>
                {metrics.failed}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Exhausted max retries
              </div>
            </div>

            {/* SENT */}
            <div
              style={{
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: '1px solid #10b981',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Sent Count
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#34d399' }}>
                {metrics.sent}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Successfully delivered
              </div>
            </div>
          </div>

          {/* Operational Timings Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Last Successful Send */}
            <Card title="LAST SUCCESSFUL SEND">
              {metrics.lastSuccessfulSend && metrics.lastSuccessfulSend.timestamp ? (
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                    {formatDate(metrics.lastSuccessfulSend.timestamp)}
                  </div>
                  {metrics.lastSuccessfulSend.eventType && (
                    <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                      <strong>Event:</strong> {metrics.lastSuccessfulSend.eventType}
                    </div>
                  )}
                  {metrics.lastSuccessfulSend.recipientEmail && (
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                      <strong>Recipient:</strong> {metrics.lastSuccessfulSend.recipientEmail}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                  No successful send recorded yet.
                </div>
              )}
            </Card>

            {/* Last Failure */}
            <Card title="LAST FAILURE">
              {metrics.lastFailure && metrics.lastFailure.timestamp ? (
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>
                    {formatDate(metrics.lastFailure.timestamp)}
                  </div>
                  {metrics.lastFailure.eventType && (
                    <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                      <strong>Event:</strong> {metrics.lastFailure.eventType}
                    </div>
                  )}
                  {metrics.lastFailure.errorCode && (
                    <div style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '4px' }}>
                      <strong>Error Code:</strong> {metrics.lastFailure.errorCode}
                    </div>
                  )}
                  {metrics.lastFailure.errorMessage && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#cbd5e1',
                        backgroundColor: '#0f172a',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        fontFamily: 'monospace',
                        wordBreak: 'break-word',
                      }}
                    >
                      {metrics.lastFailure.errorMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#34d399', fontSize: '14px', fontWeight: 500 }}>
                  ✓ No email delivery failures recorded.
                </div>
              )}
            </Card>
          </div>

          {/* Operational Policy & Scope Footnote */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              fontSize: '13px',
              color: '#94a3b8',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: '#f1f5f9' }}>Read-Only Operational View:</strong> Metrics are aggregated directly from the database schema (`email_jobs` &amp; `email_logs`). This module does not perform queue mutations, job claims, retries, or deletions.
          </div>
        </div>
      ) : null}
    </div>
  );
};
