import React from 'react';

const WORKFLOW_STEPS = [
  { id: 'design', label: 'Design RM' },
  { id: 'verification', label: 'Senior Verified' },
  { id: 'stores', label: 'Stores Issue' },
  { id: 'production', label: 'Production' },
  { id: 'completed', label: 'SC Completed' },
];

interface WorkflowProgressProps {
  currentStepIndex: number;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  currentStepIndex,
}) => {
  return (
    <div className="workflow-progress">
      {WORKFLOW_STEPS.map((step, idx) => {
        const isDone = idx < currentStepIndex;
        const isCurrent = idx === currentStepIndex;
        return (
          <div
            key={step.id}
            className={`workflow-step ${isDone ? 'step-done' : ''} ${isCurrent ? 'step-current' : ''}`}
          >
            <div className="step-bullet">{isDone ? '✓' : idx + 1}</div>
            <span className="step-label">{step.label}</span>
            {idx < WORKFLOW_STEPS.length - 1 && <div className="step-line" />}
          </div>
        );
      })}
    </div>
  );
};
