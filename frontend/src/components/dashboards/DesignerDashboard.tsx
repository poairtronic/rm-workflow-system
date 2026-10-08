import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { dashboardsApi } from '../../services/dashboards.service';

export const DesignerDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardsApi.getDesigner().then((res: any) => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) return <div>Loading designer metrics...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <Card title="Active Drafts" className="border-l-4 border-l-blue-500">
        <div className="text-4xl font-bold text-blue-600">{data?.activeDrafts || 0}</div>
        <p className="text-sm text-gray-500 mt-2">RM drafts pending your review</p>
      </Card>
      <Card title="Submitted RMs" className="border-l-4 border-l-green-500">
        <div className="text-4xl font-bold text-green-600">{data?.submittedRms || 0}</div>
        <p className="text-sm text-gray-500 mt-2">RMs waiting for stores issue</p>
      </Card>
      <Card title="Total Associated SCs" className="border-l-4 border-l-purple-500">
        <div className="text-4xl font-bold text-purple-600">{data?.totalSCAssociated || 0}</div>
        <p className="text-sm text-gray-500 mt-2">Total active Style Codes</p>
      </Card>
    </div>
  );
};
