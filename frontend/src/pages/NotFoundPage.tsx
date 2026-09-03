import React from 'react';
import { EmptyState } from '../components/feedback/EmptyState';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC<{ onGoHome?: () => void }> = ({ onGoHome }) => {
  return (
    <div className="page-container not-found-page">
      <EmptyState
        icon="🔍"
        title="Page Not Found"
        description="The requested manufacturing workflow screen does not exist."
        action={
          onGoHome && (
            <Button onClick={onGoHome} variant="primary">
              Return to Overview
            </Button>
          )
        }
      />
    </div>
  );
};
