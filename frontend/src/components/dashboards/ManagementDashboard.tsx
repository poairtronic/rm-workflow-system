import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { dashboardsApi } from '../../services/dashboards.service';

export const ManagementDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardsApi.getManagement().then((res: any) => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) return <div>Loading management metrics...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <Card title="Total Active SCs" className="border-l-4 border-l-blue-500">
        <div className="text-4xl font-bold text-blue-600">{data?.totalActiveScs || 0}</div>
        <p className="text-sm text-gray-500 mt-2">All styles currently in progress</p>
      </Card>
      <Card title="Completed SCs" className="border-l-4 border-l-green-500">
        <div className="text-4xl font-bold text-green-600">{data?.totalCompletedScs || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Production finished, awaiting closure</p>
      </Card>
      <Card title="Closed SCs" className="border-l-4 border-l-gray-500">
        <div className="text-4xl font-bold text-gray-600">{data?.totalClosedScs || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Fully closed workflows</p>
      </Card>
      <Card title="Total Exceptions" className="border-l-4 border-l-red-500">
        <div className="text-4xl font-bold text-red-600">{data?.totalExceptions || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Extra material, damage, or wastage</p>
      </Card>
    </div>
  );
};
