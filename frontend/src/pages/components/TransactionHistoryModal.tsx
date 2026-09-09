import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { APP_CONFIG } from '../../app/config';

interface TransactionHistoryModalProps {
  onClose: () => void;
  item: any;
}

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  onClose,
  item,
}) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    if (item) {
      fetchHistory();
    }
  }, [item, page]);

  const fetchHistory = async () => {
    if (!item) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/inventory/${item.id}/transactions?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transaction history');
      }

      const data = await response.json();
      setTransactions(data.data);
      setTotalPages(data.totalPages);
      setTotalRecords(data.total);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching history');
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">
            Transaction History
          </h2>
          <p className="text-gray-600 mt-1">
            {item.material} ({item.materialType}) - {item.grade}, {item.size}
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="p-3 font-semibold text-gray-700">Date/Time</th>
                  <th className="p-3 font-semibold text-gray-700">Transaction Type</th>
                  <th className="p-3 font-semibold text-gray-700">Quantity</th>
                  <th className="p-3 font-semibold text-gray-700">Performed By</th>
                  <th className="p-3 font-semibold text-gray-700">Reference</th>
                  <th className="p-3 font-semibold text-gray-700">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Loading transaction history...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No transactions recorded for this item.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => {
                    // Formatting the quantity string with sign
                    let qtyPrefix = '';
                    if (tx.transactionType === 'STOCK_IN' || tx.adjustmentDirection === 'INCREASE') {
                      qtyPrefix = '+';
                    } else if (tx.transactionType === 'STOCK_OUT' || tx.adjustmentDirection === 'DECREASE') {
                      qtyPrefix = '-';
                    }

                    // Formatting the transaction type display
                    let txTypeDisplay = tx.transactionType;
                    if (tx.transactionType === 'ADJUSTMENT' && tx.adjustmentDirection) {
                      txTypeDisplay = `ADJUSTMENT ${tx.adjustmentDirection}`;
                    }

                    const userDisplay = tx.createdBy ? `${tx.createdBy.name} (${tx.createdBy.email})` : 'System';

                    return (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium
                            ${tx.transactionType === 'STOCK_IN' ? 'bg-green-100 text-green-800' :
                              tx.transactionType === 'STOCK_OUT' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'}`}
                          >
                            {txTypeDisplay}
                          </span>
                        </td>
                        <td className="p-3 text-sm font-mono whitespace-nowrap">
                          {qtyPrefix} {Number(tx.quantity).toFixed(3)} {item.unit}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {userDisplay}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {tx.referenceType} {tx.referenceId ? `- ${tx.referenceId}` : ''}
                        </td>
                        <td className="p-3 text-sm text-gray-600 max-w-xs truncate" title={tx.remarks}>
                          {tx.remarks || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between rounded-b-xl">
          <span className="text-sm text-gray-600">
            Showing page {page} of {totalPages} ({totalRecords} records total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
            <Button variant="secondary" onClick={onClose} className="ml-4">
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
