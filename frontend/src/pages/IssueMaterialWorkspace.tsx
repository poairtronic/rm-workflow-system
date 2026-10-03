import { useState } from 'react';
import toast from 'react-hot-toast';
import { RequisitionQueueGrid } from '../components/grid/RequisitionQueueGrid';
import { SourceBinSelector } from '../components/telemetry/SourceBinSelector';
import { StockTelemetryPanel } from '../components/telemetry/StockTelemetryPanel';
import { TechnicalParameterForm } from '../components/forms/TechnicalParameterForm';
import type { TechnicalFormData } from '../components/forms/TechnicalParameterForm';
import { GovernanceConfirmationModal } from '../components/modals/GovernanceConfirmationModal';
import { api } from '../services/api';
import type { CreateGeneralIssueDto } from '../types/general-issue.dto';

const INITIAL_FORM_DATA: TechnicalFormData = {
  heatNumber: '',
  mtcReference: '',
  grossWeight: '',
  kerfAllowance: '',
};

export function IssueMaterialWorkspace() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBinId, setSelectedBinId] = useState('BIN-B2-01');
  const [formData, setFormData] = useState<TechnicalFormData>(INITIAL_FORM_DATA);
  const [selectedScId] = useState('SC-001'); // Assume SC-001 is selected from grid

  const handleSubmit = async () => {
    try {
      const payload: CreateGeneralIssueDto = {
        scId: selectedScId,
        binId: selectedBinId,
        quantity: parseFloat(formData.grossWeight) || 0,
        heatNumber: formData.heatNumber,
        mtcReference: formData.mtcReference,
        kerfAllowance: parseFloat(formData.kerfAllowance) || 0,
      };

      await api.post('/api/general-issue', payload);
      
      toast.success('Requisition submitted and cryptographically locked.', {
        style: { background: '#DCFCE7', color: '#15803D' }
      });
      setFormData(INITIAL_FORM_DATA); // Reset form

    } catch (error: any) {
      const message = error.message || 'An error occurred';

      if (message.includes('400')) {
        toast.error(`Validation Error: ${message}`, {
          style: { background: '#FEE2E2', color: '#B91C1C' }
        });
      } else if (message.includes('403')) {
        toast.error(`Unauthorized: You lack clearance to issue this material.`, {
          style: { background: '#FEE2E2', color: '#B91C1C' }
        });
      } else {
        toast.error(`Error: ${message}`, {
          style: { background: '#FEE2E2', color: '#B91C1C' }
        });
      }
      throw error; // Let the modal catch it to reset loading state if needed
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">General Material Issue</h1>
        <p className="text-slate-500 mt-1 text-sm">Review and fulfill active raw material requisitions for shop floor CNC jobs.</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <SourceBinSelector selectedBinId={selectedBinId} onSelectBinId={setSelectedBinId} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <StockTelemetryPanel selectedBinId={selectedBinId} />
        </div>
      </div>
      
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <TechnicalParameterForm 
            formData={formData} 
            onChange={setFormData} 
            availableBalance={330.0} 
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <RequisitionQueueGrid />
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Submit Requisition
        </button>
      </div>

      <GovernanceConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        scId={selectedScId}
      />
    </div>
  );
}
