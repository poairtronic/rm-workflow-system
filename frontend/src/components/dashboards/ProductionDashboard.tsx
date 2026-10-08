import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { dashboardsApi } from '../../services/dashboards.service';

export const ProductionDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardsApi.getProduction().then((res: any) => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) return <div>Loading production metrics...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <Card title="Pending Receipts" className="border-l-4 border-l-orange-500">
        <div className="text-4xl font-bold text-orange-600">{data?.pendingReceipts || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Material issued but not received</p>
      </Card>
      <Card title="Active Batches" className="border-l-4 border-l-blue-500">
        <div className="text-4xl font-bold text-blue-600">{data?.activeBatches || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Style Codes currently in production</p>
      </Card>
      <Card title="Extra Requests" className="border-l-4 border-l-yellow-500">
        <div className="text-4xl font-bold text-yellow-600">{data?.additionalRequested || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Pending additional material requests</p>
      </Card>
    </div>
  );
};
