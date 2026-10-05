import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginView } from './pages/LoginView';
import { IssueMaterialWorkspace } from './pages/IssueMaterialWorkspace';
import { MslAlertsWorkspace } from './pages/MslAlertsWorkspace';
import { ProcessMasterWorkspace } from './pages/ProcessMasterWorkspace';
import { VendorSlaWorkspace } from './pages/VendorSlaWorkspace';
import { Type1DispatchWorkspace } from './pages/Type1DispatchWorkspace';
import { Type2DispatchWorkspace } from './pages/Type2DispatchWorkspace';
import { DockReceiptWorkspace } from './pages/DockReceiptWorkspace';
import { TraceabilityWorkspace } from './pages/TraceabilityWorkspace';
import { PoTraceabilityWorkspace } from './pages/PoTraceabilityWorkspace';
import { VendorDashboardWorkspace } from './pages/VendorDashboardWorkspace';
import { PrintableDocumentLayout } from './components/layout/PrintableDocumentLayout';
import { DeliveryChallanPrintView } from './pages/DeliveryChallanPrintView';
import { ReportGeneratorWorkspace } from './pages/ReportGeneratorWorkspace';
import { ProjectSetupWorkspace } from './pages/ProjectSetupWorkspace';
import { RmRequisitionWorkspace } from './pages/RmRequisitionWorkspace';
import { ProductionJobsWorkspace } from './pages/ProductionJobsWorkspace';
import { ProductionConsumptionWorkspace } from './pages/ProductionConsumptionWorkspace';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<LoginView />} />
            
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/stores/issue-material" replace />} />
                
                {/* DESIGN ENGINEER */}
                <Route path="/design/project-setup" element={<ProjectSetupWorkspace />} />
                <Route path="/design/requisitions" element={<RmRequisitionWorkspace />} />
                
                {/* STORES / DISPATCH */}
            <Route path="/stores/issue-material" element={<IssueMaterialWorkspace />} />
            <Route path="/inventory/msl-alerts" element={<MslAlertsWorkspace />} />
            <Route path="/governance/process-master" element={<ProcessMasterWorkspace />} />
            <Route path="/governance/vendor-slas" element={<VendorSlaWorkspace />} />
            <Route path="/governance/traceability" element={<TraceabilityWorkspace />} />
            <Route path="/governance/po-traceability" element={<PoTraceabilityWorkspace />} />
            <Route path="/governance/vendor-analytics" element={<VendorDashboardWorkspace />} />
            <Route path="/dispatch/delivery-challan/type-1" element={<Type1DispatchWorkspace />} />
            <Route path="/dispatch/delivery-challan/type-2" element={<Type2DispatchWorkspace />} />
            <Route path="/dispatch/returns" element={<DockReceiptWorkspace />} />
            
            {/* PRODUCTION MGR */}
            <Route path="/production/jobs" element={<ProductionJobsWorkspace />} />
            <Route path="/production/consumption" element={<ProductionConsumptionWorkspace />} />
            
            <Route path="/reports/generation" element={<ReportGeneratorWorkspace />} />
          </Route>
          
          <Route element={<PrintableDocumentLayout />}>
            <Route path="/dispatch/delivery-challan/:id/print" element={<DeliveryChallanPrintView />} />
            </Route>
          </Route>
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
