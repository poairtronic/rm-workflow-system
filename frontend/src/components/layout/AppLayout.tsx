import { useState, useCallback, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RouteLoadingSkeleton } from '../common/RouteLoadingSkeleton';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from './ErrorBoundary';
import { BarcodeScannerModal } from '../inventory/BarcodeScannerModal';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

export function AppLayout() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#090a10] text-slate-900 dark:text-slate-100 overflow-x-hidden flex flex-col">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <TopBar
        onOpenScanner={() => { setScannedBarcode(''); setIsScannerOpen(true); }}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
      />
      <main className="md:ml-[260px] ml-0 mt-16 p-3 sm:p-5 md:p-8 pb-20 md:pb-8 bg-[#F8FAFC] dark:bg-[#090a10] min-h-[calc(100dvh-64px)] max-w-full md:max-w-[calc(100vw-260px)] flex-1 overflow-x-hidden">
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar for top 4 core modules */}
      <BottomNav />

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

