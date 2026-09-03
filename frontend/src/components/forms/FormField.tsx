import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  children,
}) => {
  return (
    <div className="form-field">
      <label className="form-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="form-control-wrapper">{children}</div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
};
