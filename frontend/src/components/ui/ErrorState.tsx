import { RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message = 'An error occurred while fetching data.', onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center text-red-600 bg-red-50 rounded-lg", className)}>
      <AlertCircle className="w-10 h-10 mb-3 text-red-500" />
      <h3 className="text-sm font-medium mb-1">Error Loading Data</h3>
      <p className="text-sm text-red-500/80 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      )}
    </div>
  );
}
