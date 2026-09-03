import React from 'react';

interface StatusAlertProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message: string;
  hint?: string;
}

export const StatusAlert: React.FC<StatusAlertProps> = ({
  type = 'info',
  title,
  message,
  hint,
}) => {
  return (
    <div className={`alert alert-${type}`}>
      {title && <strong className="alert-title">{title}: </strong>}
      <span>{message}</span>
      {hint && <p className="alert-hint">{hint}</p>}
    </div>
  );
};
