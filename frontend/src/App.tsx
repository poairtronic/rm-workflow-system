import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { IssueMaterialWorkspace } from './pages/IssueMaterialWorkspace';
import { MslAlertsWorkspace } from './pages/MslAlertsWorkspace';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/stores/issue-material" replace />} />
          <Route path="/stores/issue-material" element={<IssueMaterialWorkspace />} />
          <Route path="/inventory/msl-alerts" element={<MslAlertsWorkspace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
