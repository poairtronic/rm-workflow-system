import React from 'react';
import { WORKFLOW_STATUS_CONFIG } from '../../constants/status';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = WORKFLOW_STATUS_CONFIG[status] || {
    label: status,
    symbol: '●',
    badgeClass: 'badge-draft',
  };

  return (
    <span className={`badge ${config.badgeClass} badge-${size}`}>
      <span className="badge-symbol">{config.symbol}</span> {config.label}
    </span>
  );
};
