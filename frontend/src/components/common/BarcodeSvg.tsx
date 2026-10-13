import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export interface BarcodeSvgProps {
  value: string;
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  className?: string;
  lineColor?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  format = 'CODE128',
  width = 1.6,
  height = 42,
  displayValue = true,
  fontSize = 13,
  margin = 6,
  className = '',
  lineColor = '#000000',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value && value.trim()) {
      try {
        JsBarcode(svgRef.current, value.trim(), {
          format,
          width,
          height,
          displayValue,
          fontSize,
          margin,
          font: 'monospace',
          textMargin: 3,
          background: 'transparent',
          lineColor,
          valid: (valid) => {
            if (!valid) {
              console.warn(`[BarcodeSvg] Barcode "${value}" is invalid for format ${format}`);
            }
          },
        });
      } catch (err) {
        console.error(`[BarcodeSvg] Failed to render barcode for "${value}":`, err);
      }
    }
  }, [value, format, width, height, displayValue, fontSize, margin, lineColor]);

  if (!value || !value.trim()) {
    return (
      <div className={`text-xs text-slate-400 italic ${className}`}>
        No barcode
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={`max-w-full select-none ${className}`}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
};

