import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { dashboardsApi } from '../../services/dashboards.service';

export const StoresDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardsApi.getStores().then((res: any) => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) return <div>Loading stores metrics...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <Card title="Pending RM Requests" className="border-l-4 border-l-orange-500">
        <div className="text-4xl font-bold text-orange-600">{data?.pendingRmRequests || 0}</div>
        <p className="text-sm text-gray-500 mt-2">New RMs waiting for material issue</p>
      </Card>
      <Card title="Pending Extra Requests" className="border-l-4 border-l-red-500">
        <div className="text-4xl font-bold text-red-600">{data?.pendingAdditionalRequests || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Production requests awaiting approval</p>
      </Card>
      <Card title="Approved Extra Issues" className="border-l-4 border-l-green-500">
        <div className="text-4xl font-bold text-green-600">{data?.approvedAdditionalToIssue || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Approved requests waiting to be issued</p>
      </Card>
    </div>
  );
};
