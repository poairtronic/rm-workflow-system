import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import {
  CheckCircle2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { APP_CONFIG } from '../../app/config';
import { mercIndentService } from '../../services/mercIndent.service';
import type { MercIndentSummary } from '../../types/mercIndent.types';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

export function MercIndentIssue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Fetch MERC Indents summary list
  const {
    data: indents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MercIndentSummary[]>({
    queryKey: ['merc-indents'],
    queryFn: async () => {
      return await mercIndentService.getMercIndents();
    },
  });

  // 2. Socket.IO Real-time listener
  useEffect(() => {
    const token = localStorage.getItem('rm_access_token');
    if (!token) return;

    const backendUrl = APP_CONFIG.apiBaseUrl || 'http://localhost:3002';
    const socket: Socket = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('notification', (payload: any) => {
      if (payload?.type === 'MERC_INDENT') {
        toast('New MERC indent pending notification', {
          icon: '🔔',
          duration: 4000,
        });
        queryClient.invalidateQueries({ queryKey: ['merc-indents'] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ISSUED
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            PARTIAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            PENDING
          </span>
        );
    }
  };

  // Main Table Columns
  const columns: ColumnDef<MercIndentSummary>[] = [
    {
      key: 'indentNumber',
      header: 'INDENT NO',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-white">
          {row.indentNumber}
        </span>
      ),
    },
    {
      key: 'poNumber',
      header: 'PO NUMBER',
      render: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-400">
          {row.poNumber || '—'}
        </span>
      ),
    },
    {
      key: 'customerName',
      header: 'CUSTOMER',
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {row.customerName || '—'}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'ITEMS',
      render: (row) => {
        const isComplete = row.issuedItems === row.totalItems && row.totalItems > 0;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`font-semibold text-xs ${
                isComplete
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : row.issuedItems > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {row.issuedItems}/{row.totalItems} issued
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      render: (row) => {
        const isFullyIssued = row.status === 'ISSUED';
        return (
          <Button
            size="sm"
            variant={isFullyIssued ? 'secondary' : 'primary'}
            onClick={() => navigate(`/governance/merc-indents/${row.id}`)}
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              isFullyIssued
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isFullyIssued ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                View Detail
              </>
            ) : (
              <>
                View &amp; Issue
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="MERC Indent Issue"
        subtitle="Issue materials from RM stock against MERC production indents"
        actionSlot={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      {/* Render Main Table States */}
      {isLoading ? (
        <LoadingState text="Loading MERC production indents..." />
      ) : isError ? (
        <ErrorState
          message={(error as any)?.message || 'Failed to load MERC indents'}
          onRetry={() => refetch()}
        />
      ) : indents.length === 0 ? (
        <EmptyState
          title="No MERC Indents"
          description="There are currently no production indents pending material issuance from stores."
        />
      ) : (
        <DataTable
          columns={columns}
          data={indents}
          searchable={true}
          searchKeys={['indentNumber', 'poNumber', 'customerName']}
          pagination={true}
          defaultPageSize={10}
        />
      )}
    </div>
  );
}

export default MercIndentIssue;
