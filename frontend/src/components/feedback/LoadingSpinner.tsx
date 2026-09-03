import React from 'react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  size = 'md',
}) => {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div className="spinner" />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
};
