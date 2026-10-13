import { useEffect, useRef, useCallback } from 'react';

/**
 * Strips ASCII control characters (STX, ETX, NUL, CR, LF, etc.) and excess whitespace
 * often prepended or appended by physical laser barcode scanners.
 */
export function sanitizeBarcode(raw: string): string {
  if (!raw) return '';
  // Remove control characters (0x00-0x1F and 0x7F-0x9F)
  return raw.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().toUpperCase();
}

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  onHotkey?: () => void;
  maxInterKeyTime?: number; // Maximum ms between characters for a hardware scanner burst (default: 45ms)
  minBarcodeLength?: number; // Minimum barcode character length (default: 3)
  debounceMs?: number; // Ignore identical scan bursts within this window (default: 400ms)
  enabled?: boolean;
}

/**
 * Global Keyboard Wedge timing hook for USB and Bluetooth handheld barcode scanners.
 * 
 * Hardware scanners send characters rapidly (< 35ms per character) followed by an Enter key.
 * Human typists take > 80ms per character.
 * This hook captures scanner bursts anywhere on the page and handles them automatically.
 */
export function useBarcodeScanner({
  onScan,
  onHotkey,
  maxInterKeyTime = 50,
  minBarcodeLength = 3,
  debounceMs = 400,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const firstKeyTimeRef = useRef<number>(0);
  const lastScanEventRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // 1. Hotkey detection (F2 or Ctrl+B / Cmd+B)
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        onHotkey?.();
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // 2. Terminator detection: Enter key concludes the scanner burst
      if (e.key === 'Enter') {
        const candidate = sanitizeBarcode(bufferRef.current);
        bufferRef.current = '';

        // If characters were entered rapidly and meet minimum length
        const totalDuration = now - firstKeyTimeRef.current;
        const avgSpeed = candidate.length > 0 ? totalDuration / candidate.length : 999;

        if (
          candidate.length >= minBarcodeLength &&
          (timeDiff <= maxInterKeyTime * 2 || avgSpeed <= maxInterKeyTime)
        ) {
          e.preventDefault();
          e.stopPropagation();

          // Laser bounce / duplicate debounce check
          if (
            candidate === lastScanEventRef.current.code &&
            now - lastScanEventRef.current.time < debounceMs
          ) {
            console.debug('Hardware scanner duplicate burst debounced:', candidate);
            return;
          }

          lastScanEventRef.current = { code: candidate, time: now };
          onScan(candidate);
        }
        return;
      }

      // Ignore non-printable modifier keys (Shift, Ctrl, Alt, CapsLock, Tab, etc.)
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // 3. Timing check: If pause was too long (> 50ms), reset buffer to current character
      if (timeDiff > maxInterKeyTime) {
        bufferRef.current = e.key;
        firstKeyTimeRef.current = now;
      } else {
        bufferRef.current += e.key;
      }
    },
    [enabled, onScan, onHotkey, maxInterKeyTime, minBarcodeLength, debounceMs],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Programmatically trigger opening the barcode scanner dialog with an optional initial barcode.
 */
export function triggerBarcodeScanner(barcode?: string) {
  window.dispatchEvent(new CustomEvent('open-barcode-scanner', { detail: { barcode } }));
}
