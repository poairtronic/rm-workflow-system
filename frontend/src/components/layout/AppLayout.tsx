import { useState, useCallback, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RouteLoadingSkeleton } from '../common/RouteLoadingSkeleton';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ErrorBoundary } from './ErrorBoundary';
import { BarcodeScannerModal } from '../inventory/BarcodeScannerModal';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

export function AppLayout() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string>('');

  const handleScan = useCallback((barcode: string) => {
    setScannedBarcode(barcode);
    setIsScannerOpen(true);
  }, []);

  const handleHotkey = useCallback(() => {
    setScannedBarcode('');
    setIsScannerOpen((prev) => !prev);
  }, []);

  // Global listener for USB / Bluetooth keyboard wedge scanners and F2 hotkey
  useBarcodeScanner({
    onScan: handleScan,
    onHotkey: handleHotkey,
    enabled: true,
  });

  // Listen for programmatic open requests across any component
  useEffect(() => {
    const handleCustomOpen = (e: any) => {
      setScannedBarcode(e.detail?.barcode || '');
      setIsScannerOpen(true);
    };
    window.addEventListener('open-barcode-scanner', handleCustomOpen);
    return () => window.removeEventListener('open-barcode-scanner', handleCustomOpen);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090a10] text-slate-900 dark:text-slate-100 overflow-x-clip transition-colors duration-150">
      <Sidebar />
      <TopBar onOpenScanner={() => { setScannedBarcode(''); setIsScannerOpen(true); }} />
      <main className="ml-[260px] mt-16 p-8 bg-[#F8FAFC] dark:bg-[#090a10] min-h-[calc(100vh-64px)] max-w-[calc(100vw-260px)] transition-colors duration-150">
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Global Hardware Barcode Scanner Interface */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        initialBarcode={scannedBarcode}
        onClose={() => {
          setIsScannerOpen(false);
          setScannedBarcode('');
        }}
      />
    </div>
  );
}

