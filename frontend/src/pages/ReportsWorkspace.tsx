import React, { useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusAlert } from '../components/feedback/StatusAlert';
import { useAuth } from '../hooks/useAuth';
import { api, reportApi } from '../services/api';

export const ReportsWorkspace: React.FC = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [challanIdInput, setChallanIdInput] = useState('');
  const [issueIdInput, setIssueIdInput] = useState('');

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
      <div className="space-y-6 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Traceability & Analytics Reports</h1>
          <p className="text-gray-600 mt-2">Export comprehensive JSON-to-CSV data across processes, items, and material consumption.</p>
        </div>

        {error && <div className="mb-6"><StatusAlert type="error" title="Export Error" message={error} /></div>}

        {!hasAccess ? (
          <StatusAlert type="warning" title="Restricted Access" message="You do not have the necessary permissions (Management/Admin) to view or export these reports." />
        ) : (
          <div className="space-y-8">
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

            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Executive Multi-Tab Excel Workbooks (.xlsx)</h2>
              <p className="text-sm text-slate-500 mb-6">
                Download formatted, multi-tab Excel workbooks with frozen headers, auto-adjusted columns, and audit trail data.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                  title="SC & PO Traceability Workbook"
                  subtitle="3 Tabs: SC/PO Summary, Raw Material Requirements, and Material Consumption Audit."
                >
                  <Button
                    onClick={async () => {
                      try {
                        setLoading('excel-traceability');
                        const blob = await reportApi.exportTraceabilityExcel();
                        downloadBlob(blob, `SC_PO_Traceability_${new Date().toISOString().split('T')[0]}.xlsx`);
                      } catch (err: any) {
                        setError('Failed to export Traceability Excel workbook.');
                      } finally {
                        setLoading(null);
                      }
                    }}
                    disabled={loading !== null}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {loading === 'excel-traceability' ? 'Exporting...' : 'Download Traceability .xlsx'}
                  </Button>
                </Card>

                <Card
                  title="Stock Movement & Balances"
                  subtitle="2 Tabs: Current Stock Balances by Bin and Historical Stock Transactions Ledger."
                >
                  <Button
                    onClick={async () => {
                      try {
                        setLoading('excel-stock');
                        const blob = await reportApi.exportStockMovementExcel();
                        downloadBlob(blob, `Stock_Movement_${new Date().toISOString().split('T')[0]}.xlsx`);
                      } catch (err: any) {
                        setError('Failed to export Stock Movement Excel workbook.');
                      } finally {
                        setLoading(null);
                      }
                    }}
                    disabled={loading !== null}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {loading === 'excel-stock' ? 'Exporting...' : 'Download Stock .xlsx'}
                  </Button>
                </Card>

                <Card
                  title="Vendor SLA & DC Tracker"
                  subtitle="2 Tabs: Active Outward Challans and Overdue SLA Breach Escalations."
                >
                  <Button
                    onClick={async () => {
                      try {
                        setLoading('excel-vendor');
                        const blob = await reportApi.exportVendorSlaExcel();
                        downloadBlob(blob, `Vendor_SLA_Tracker_${new Date().toISOString().split('T')[0]}.xlsx`);
                      } catch (err: any) {
                        setError('Failed to export Vendor SLA Excel workbook.');
                      } finally {
                        setLoading(null);
                      }
                    }}
                    disabled={loading !== null}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {loading === 'excel-vendor' ? 'Exporting...' : 'Download Vendor SLA .xlsx'}
                  </Button>
                </Card>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Statutory & Operational Vector PDFs (Low-RAM Server Render)</h2>
              <p className="text-sm text-slate-500 mb-6">
                Pure JavaScript vector PDF rendering powered by pdfmake (&lt;15MB RAM). Export Type 1/2 Delivery Challans and Stores Material Issue Slips.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card
                  title="Delivery Challan (Type 1 & 2)"
                  subtitle="Statutory outward challan with vendor details, job work items, dispatch terms, and authorized signature blocks."
                >
                  <div className="space-y-3 mt-4">
                    <input
                      type="text"
                      placeholder="Enter Delivery Challan UUID..."
                      value={challanIdInput}
                      onChange={(e) => setChallanIdInput(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
                    />
                    <Button
                      onClick={async () => {
                        if (!challanIdInput.trim()) {
                          setError('Please enter a valid Delivery Challan UUID.');
                          return;
                        }
                        try {
                          setLoading('pdf-challan');
                          setError('');
                          const blob = await reportApi.exportDeliveryChallanPdf(challanIdInput.trim());
                          downloadBlob(blob, `Delivery_Challan_${challanIdInput.trim().slice(0, 8)}.pdf`);
                        } catch (err: any) {
                          setError('Failed to export Delivery Challan PDF. Check if ID exists.');
                        } finally {
                          setLoading(null);
                        }
                      }}
                      disabled={loading !== null}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                    >
                      {loading === 'pdf-challan' ? 'Rendering PDF...' : 'Download Delivery Challan PDF'}
                    </Button>
                  </div>
                </Card>

                <Card
                  title="Material Issue Slip (Stores to Floor)"
                  subtitle="Internal material transfer slip with raw material requirements, issued quantities, bin references, and 3-way sign-off."
                >
                  <div className="space-y-3 mt-4">
                    <input
                      type="text"
                      placeholder="Enter Material Issue UUID..."
                      value={issueIdInput}
                      onChange={(e) => setIssueIdInput(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
                    />
                    <Button
                      onClick={async () => {
                        if (!issueIdInput.trim()) {
                          setError('Please enter a valid Material Issue UUID.');
                          return;
                        }
                        try {
                          setLoading('pdf-issue');
                          setError('');
                          const blob = await reportApi.exportMaterialIssueSlipPdf(issueIdInput.trim());
                          downloadBlob(blob, `Material_Issue_Slip_${issueIdInput.trim().slice(0, 8)}.pdf`);
                        } catch (err: any) {
                          setError('Failed to export Material Issue Slip PDF. Check if ID exists.');
                        } finally {
                          setLoading(null);
                        }
                      }}
                      disabled={loading !== null}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                    >
                      {loading === 'pdf-issue' ? 'Rendering PDF...' : 'Download Issue Slip PDF'}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
