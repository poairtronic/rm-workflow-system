import React, { useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusAlert } from '../components/feedback/StatusAlert';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export const ReportsWorkspace: React.FC = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleExport = async (type: string, filename: string) => {
    try {
      setLoading(type);
      setError('');
      // Using generic api to get raw json data from the backend
      const data = await api.get<any>(`/api/reports/${type}`);
      
      // Convert JSON array to CSV
      if (!Array.isArray(data) || data.length === 0) {
        setError('No data available for this report.');
        return;
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map((row: any) => 
        Object.values(row).map(val => `"${val}"`).join(',')
      );
      const csvContent = [headers, ...rows].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      console.error(err);
      setError('Failed to generate report. You might not have the correct permissions.');
    } finally {
      setLoading(null);
    }
  };

  const hasAccess = ['SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'].includes(role || '');

  return (
    <AppLayout activeNav="reports">
      <div className="page-container">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Traceability & Analytics Reports</h1>
          <p className="text-gray-600 mt-2">Export comprehensive JSON-to-CSV data across processes, items, and material consumption.</p>
        </div>

        {error && <div className="mb-6"><StatusAlert type="error" title="Export Error" message={error} /></div>}

        {!hasAccess ? (
          <StatusAlert type="warning" title="Restricted Access" message="You do not have the necessary permissions (Management/Admin) to view or export these reports." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title="Process-Wise Traceability" subtitle="Exports SC records along with target quantities and completion timestamps.">
              <Button 
                onClick={() => handleExport('process-wise', 'process_wise_report')} 
                disabled={loading !== null}
                className="w-full mt-4"
              >
                {loading === 'process-wise' ? 'Generating...' : 'Export Process CSV'}
              </Button>
            </Card>

            <Card title="Item-Wise History" subtitle="Exports specific Raw Material items and their dimensional usage.">
              <Button 
                onClick={() => handleExport('item-wise', 'item_wise_report')} 
                disabled={loading !== null}
                className="w-full mt-4"
              >
                {loading === 'item-wise' ? 'Generating...' : 'Export Items CSV'}
              </Button>
            </Card>

            <Card title="Material Consumption Ledger" subtitle="Exports all consumptions tracked against specific batches.">
              <Button 
                onClick={() => handleExport('rm-consumption', 'rm_consumption_report')} 
                disabled={loading !== null}
                className="w-full mt-4"
              >
                {loading === 'rm-consumption' ? 'Generating...' : 'Export Consumption CSV'}
              </Button>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
