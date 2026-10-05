import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { IssueMaterialWorkspace } from './pages/IssueMaterialWorkspace';
import { MslAlertsWorkspace } from './pages/MslAlertsWorkspace';
import { ProcessMasterWorkspace } from './pages/ProcessMasterWorkspace';
import { VendorSlaWorkspace } from './pages/VendorSlaWorkspace';
import { Type1DispatchWorkspace } from './pages/Type1DispatchWorkspace';
import { Type2DispatchWorkspace } from './pages/Type2DispatchWorkspace';
import { DockReceiptWorkspace } from './pages/DockReceiptWorkspace';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/stores/issue-material" replace />} />
            <Route path="/stores/issue-material" element={<IssueMaterialWorkspace />} />
            <Route path="/inventory/msl-alerts" element={<MslAlertsWorkspace />} />
            <Route path="/governance/process-master" element={<ProcessMasterWorkspace />} />
            <Route path="/governance/vendor-slas" element={<VendorSlaWorkspace />} />
            <Route path="/dispatch/delivery-challan/type-1" element={<Type1DispatchWorkspace />} />
            <Route path="/dispatch/delivery-challan/type-2" element={<Type2DispatchWorkspace />} />
            <Route path="/dispatch/returns" element={<DockReceiptWorkspace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
