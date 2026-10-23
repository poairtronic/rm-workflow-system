import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { workflowService, type ReworkScItem } from '../services/workflowService';
import { DataTable, type ColumnDef } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ReworkSubmitModal } from '../components/rework/ReworkSubmitModal';

export function ReworkWorkspace() {
  const queryClient = useQueryClient();

  const [selectedSc, setSelectedSc] = useState<ReworkScItem | null>(null);
  const [selectedType, setSelectedType] = useState<'REWORK' | 'REJECTION' | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch SC list for Rework & Rejection inspection
  const {
    data: scList = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ReworkScItem[]>({
    queryKey: ['rework-sc-list'],
    queryFn: async () => {
      const res = await workflowService.getReworkScList();
      return Array.isArray(res) ? res : (res as any)?.data || [];
    },
  });

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSc(null);
    setSelectedType(null);
  };

  const handleReportCreated = (_reportNumber: string) => {
    queryClient.invalidateQueries({ queryKey: ['rework-sc-list'] });
  };

  // Only display items in Stores Issued, Production Received, or Stores Issued Partially
  const filteredScList = useMemo(() => {
    const allowed = new Set([
      'STORES_ISSUED',
      'STORES ISSUED',
      'ISSUED',
      'PRODUCTION_PENDING',
      'PRODUCTION PENDING',
      'PRODUCTION_RECEIVED',
      'PRODUCTION RECEIVED',
      'IN_PRODUCTION',
      'IN PRODUCTION',
      'STORES_ISSUED_PARTIALLY',
      'STORES ISSUED PARTIALLY',
      'PARTIALLY_ISSUED',
      'PARTIALLY ISSUED',
      'PARTIAL_ISSUE',
    ]);
    return scList.filter((item) => {
      const normalized = (item.status || '').toUpperCase().trim();
      return allowed.has(normalized);
    });
  }, [scList]);

  const columns = useMemo<ColumnDef<ReworkScItem>[]>(
    () => [
      {
        key: 'scNumber',
        header: 'SC Number',
        sortable: true,
        render: (row) => (
          <span className="font-semibold text-slate-900 dark:text-white">
            {row.scNumber}
          </span>
        ),
      },
      {
        key: 'productName',
        header: 'Component / Product',
        sortable: true,
        render: (row) => (
          <span className="text-slate-700 dark:text-slate-200">
            {row.productName}
          </span>
        ),
      },
      {
        key: 'poNumber',
        header: 'PO Number',
        sortable: true,
        render: (row) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
            {row.poNumber || '—'}
          </span>
        ),
      },
      {
        key: 'customerName',
        header: 'Customer',
        sortable: true,
        render: (row) => (
          <span className="text-slate-600 dark:text-slate-300">
            {row.customerName || '—'}
          </span>
        ),
      },
      {
        key: 'targetQuantity',
        header: 'Target Qty',
        isNumeric: true,
        sortable: true,
        render: (row) => (
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {row.targetQuantity}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSc(row);
                setSelectedType('REWORK');
                setIsModalOpen(true);
              }}
            >
              Rework
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="font-medium shadow-xs"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSc(row);
                setSelectedType('REJECTION');
                setIsModalOpen(true);
              }}
            >
              Rejection
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="w-full pb-24 space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            Rework Governance
          </span>
        }
        subtitle="Manage shop-floor quality inspection, log rework loops, and report component defects directly to Quality Hub."
      />

      {/* Render States */}
      {isLoading ? (
        <LoadingState text="Loading SC list for rework..." />
      ) : isError ? (
        <ErrorState
          message={(error as any)?.message || 'Failed to load SC list for rework'}
          onRetry={() => refetch()}
        />
      ) : filteredScList.length === 0 ? (
        <EmptyState
          title="No Sales Order Components found"
          description="There are currently no materials in Stores Issued, Production Received, or Partially Issued stage available for rework."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredScList}
          searchable={true}
          searchKeys={['scNumber', 'productName', 'poNumber', 'customerName', 'status']}
          pagination={true}
          defaultPageSize={10}
        />
      )}

      {/* Rework / Rejection Submit Modal */}
      {selectedSc && selectedType && (
        <ReworkSubmitModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          sc={selectedSc}
          type={selectedType}
          onSuccess={handleReportCreated}
        />
      )}
    </div>
  );
}

export default ReworkWorkspace;
