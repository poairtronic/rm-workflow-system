import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginView } from './pages/LoginView';
import { UnauthorizedView } from './pages/UnauthorizedView';
import { ROUTE_CONFIG } from './routeConfig';
import { PrintableDocumentLayout } from './components/layout/PrintableDocumentLayout';
import { useAuth } from './contexts/AuthContext';

const queryClient = new QueryClient();

function RoleBasedHome() {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  switch (currentUser.role) {
    case 'DESIGNER': return <Navigate to="/design/requisitions" replace />;
    case 'STORES': return <Navigate to="/stores/issue-material" replace />;
    case 'PRODUCTION': return <Navigate to="/production/jobs" replace />;
    default: return <Navigate to="/governance/po-traceability" replace />;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route path="/unauthorized" element={<UnauthorizedView />} />
            
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<RoleBasedHome />} />
                
                {ROUTE_CONFIG.filter(route => route.isSidebar).map(route => (
                  <Route 
                    key={route.path}
                    path={route.path} 
                    element={<ProtectedRoute allowedRoles={route.roles}><route.component /></ProtectedRoute>} 
                  />
                ))}
              </Route>
              
              <Route element={<PrintableDocumentLayout />}>
                {ROUTE_CONFIG.filter(route => route.isPrintable).map(route => (
                  <Route 
                    key={route.path}
                    path={route.path} 
                    element={<ProtectedRoute allowedRoles={route.roles}><route.component /></ProtectedRoute>} 
                  />
                ))}
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
