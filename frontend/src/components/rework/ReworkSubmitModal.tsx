import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import type { ReworkScItem } from '../../services/workflowService';

const ECR_BASE_URL = 'https://error-correction-application.onrender.com';

const PROCESS_TEMPLATES: Record<string, string[]> = {
  "APG_ less than 6 dia": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","OP150_SG_JET_RECESS","OP170_VA"],
  "APG_Vertical Bench mount _ Super Drill": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","SUPER_DRILL","OP150_SG_JET_RECESS","OP170_VA"],
  "APG_Vertical Bench mount _ Jet press": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","OP150_SG_JET_RECESS","OP170_VA"],
  "SRG_less than 6 dia": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_HN","OP90_QC_FINAL"],
  "SRG_honing finish": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_HN","OP90_QC_FINAL"],
  "SRG_above 60 direct finish": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_QC_FINAL"],
  "SRG_less than 6 dia (DC)": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_HN","OP90_QC_FINAL"],
  "SRG_honing finish(DC)": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_HN","OP90_QC_FINAL"],
  "SRG_above 60 direct finish(DC)": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_QC_FINAL"],
  "SRG_20-60 direct finish": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_QC_FINAL"],
  "SRG_20-60 direct finish (DC)": ["DESIGN_SRG","RM_SRG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_SZ","OP70_BLK","OP80_QC_FINAL"],
  "APG_DIA 6-10": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","OP150_SG_JET_RECESS","OP170_VA"],
  "APG _Jet Press": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","OP150_SG_JET_RECESS","OP170_VA"],
  "APG _SD": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","SUPER_DRILL","OP150_SG_JET_RECESS","OP170_VA"],
  "APG_Vertical Bench mount_Carbide": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","OP150_SG_JET_RECESS","OP170_VA"],
  "APG_Carbide": ["DESIGN_APG","RM_APG","OP10_TURNING","OP20_IC","OP40_50_CH","OP60_QC","OP80_HT","OP90_SZ","OP100_BLK","OP140_CG","OP150_SG_JET_RECESS","OP170_VA"],
  "ARG_jet press": ["DESIGN_ARG","RM_ARG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_BLK","OP70_JET_PRESS","OP80_QC_FINAL"],
  "ARG_above 60_jet press": ["DESIGN_ARG","RM_ARG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_BLK","OP70_JET_PRESS","OP80_QC_FINAL"],
  "ARG_super drill": ["DESIGN_ARG","RM_ARG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_BLK","SUPER_DRILL","OP80_QC_FINAL"],
  "ARG_above 60_Super drill": ["DESIGN_ARG","RM_ARG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_BLK","SUPER_DRILL","OP80_QC_FINAL"],
  "ARG_Carbide": ["DESIGN_ARG","RM_ARG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_BLK","OP70_JET_PRESS","OP80_QC_FINAL"],
  "SPG": ["DESIGN_SPG","RM_SPG","OP10_TURNING","OP20_IC","OP30_CH","OP40_QC","OP50_HT","OP60_BLK","OP70_GRIND","OP80_QC_FINAL"]
};

function getActiveStages(template: string, failedStage: string): string[] {
  const stages = PROCESS_TEMPLATES[template] || [];
  const idx = stages.indexOf(failedStage);
  return idx !== -1 ? stages.slice(0, idx + 1) : [];
}

function sumStageCosts(activeStages: string[], costs: Record<string, number>): number {
  return Math.round(activeStages.reduce((sum, st) => sum + (Number(costs?.[st]) || 0), 0));
}

export interface MasterDataItem {
  id: string;
  name: string;
}

export interface ReworkSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  sc: ReworkScItem | null;
  type: 'REWORK' | 'REJECTION';
  onSuccess: (reportNumber: string) => void;
}

export function ReworkSubmitModal({
  isOpen,
  onClose,
  sc,
  type,
  onSuccess,
}: ReworkSubmitModalProps) {
  // Master Data state from ECR
  const [componentsList, setComponentsList] = useState<MasterDataItem[]>([]);
  const [errorTypesList, setErrorTypesList] = useState<MasterDataItem[]>([]);
  const [operatorsList, setOperatorsList] = useState<MasterDataItem[]>([]);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(false);

  // Common & Rework Form State
  const [component, setComponent] = useState('');
  const [errorType, setErrorType] = useState('');
  const [stageOfFailure, setStageOfFailure] = useState('In-Process');
  const [quantityAffected, setQuantityAffected] = useState<number>(1);
  const [defectDescription, setDefectDescription] = useState('');
  const [responsibleParty, setResponsibleParty] = useState('OPERATOR');
  const [operatorName, setOperatorName] = useState('');
  const [reworkDescription, setReworkDescription] = useState('');
  const [costEstimation, setCostEstimation] = useState<number | ''>('');
  const [lossEstimation, setLossEstimation] = useState<number | ''>('');
  const [alternativeNotes, setAlternativeNotes] = useState('');

  // Rejection Specific State
  const [rejectionProcessTemplate, setRejectionProcessTemplate] = useState('');
  const [rejectionFailedStage, setRejectionFailedStage] = useState('');
  const [rejectionStageCosts, setRejectionStageCosts] = useState<Record<string, number>>({});
  const [rejectionDescription, setRejectionDescription] = useState('');

  // Fetch Master Data on Modal Open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingMasterData(true);

    const fetchMasterData = async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const rmToken = localStorage.getItem('rm_access_token');
      if (rmToken) {
        headers['Authorization'] = `Bearer ${rmToken}`;
      }

      const endpoints = [
        { key: 'components', url: `${ECR_BASE_URL}/api/master-data/components` },
        { key: 'errorTypes', url: `${ECR_BASE_URL}/api/master-data/error-types` },
        { key: 'operators', url: `${ECR_BASE_URL}/api/master-data/operators` },
      ];

      try {
        const results = await Promise.allSettled(
          endpoints.map(async ({ url }) => {
            const res = await fetch(url, { headers });
            if (!res.ok) {
              // Try without auth header if cross-token mismatch occurs
              const fallback = await fetch(url);
              if (!fallback.ok) return [];
              const json = await fallback.json();
              return Array.isArray(json) ? json : json.data || [];
            }
            const json = await res.json();
            return Array.isArray(json) ? json : json.data || [];
          })
        );

        if (!isMounted) return;

        if (results[0].status === 'fulfilled') {
          setComponentsList(results[0].value as MasterDataItem[]);
        }
        if (results[1].status === 'fulfilled') {
          setErrorTypesList(results[1].value as MasterDataItem[]);
        }
        if (results[2].status === 'fulfilled') {
          setOperatorsList(results[2].value as MasterDataItem[]);
        }
      } catch (err) {
        console.warn('[ReworkSubmitModal] Master data fetch fallback notice:', err);
      } finally {
        if (isMounted) {
          setIsLoadingMasterData(false);
        }
      }
    };

    fetchMasterData();
  }, [isOpen]);

  // Reset form when modal opens or SC changes
  useEffect(() => {
    if (isOpen && sc) {
      setComponent(sc.productName || '');
      setErrorType('');
      setStageOfFailure(type === 'REWORK' ? 'In-Process' : 'Final Inspection');
      setQuantityAffected(Number(sc.targetQuantity) || 1);
      setDefectDescription('');
      setResponsibleParty('OPERATOR');
      setOperatorName('');
      setReworkDescription('');
      setRejectionDescription('');
      setRejectionProcessTemplate('');
      setRejectionFailedStage('');
      setRejectionStageCosts({});
      setCostEstimation('');
      setLossEstimation('');
      setAlternativeNotes('');
    }
  }, [isOpen, sc, type]);

  const handleTemplateChange = (tmpl: string) => {
    setRejectionProcessTemplate(tmpl);
    setRejectionFailedStage('');
    setRejectionStageCosts({});
    setCostEstimation('');
  };

  const handleFailedStageChange = (stage: string) => {
    setRejectionFailedStage(stage);
    if (rejectionProcessTemplate && stage) {
      const active = getActiveStages(rejectionProcessTemplate, stage);
      setCostEstimation(sumStageCosts(active, rejectionStageCosts));
    }
  };

  const handleStageCostChange = (st: string, costStr: string) => {
    const val = Number(costStr) || 0;
    const updated = { ...rejectionStageCosts, [st]: val };
    setRejectionStageCosts(updated);
    const active = getActiveStages(rejectionProcessTemplate, rejectionFailedStage);
    setCostEstimation(sumStageCosts(active, updated));
  };

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/api/rework/submit', data),
    onSuccess: (res: any) => {
      const repNum = res?.reportNumber || res?.data?.reportNumber || 'Report';
      toast.success(`Report ${repNum} created in Quality Hub`);
      onSuccess(repNum);
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to submit report';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sc) return;

    // VALIDATION
    if (type === 'REWORK') {
      if (!stageOfFailure) {
        toast.error('Stage of Failure is required');
        return;
      }
      if (!defectDescription.trim()) {
        toast.error('Defect Description is required');
        return;
      }
      if (!reworkDescription.trim()) {
        toast.error('Rework Description is required');
        return;
      }
      if (costEstimation === '' || costEstimation === undefined || isNaN(Number(costEstimation))) {
        toast.error('Cost Estimation is required');
        return;
      }
    } else {
      // REJECTION
      if (!rejectionProcessTemplate) {
        toast.error('Process Template is required');
        return;
      }
      if (!rejectionFailedStage) {
        toast.error('Failed Stage is required');
        return;
      }
      if (!defectDescription.trim()) {
        toast.error('Defect Description is required');
        return;
      }
      if (!rejectionDescription.trim()) {
        toast.error('Rejection Description is required');
        return;
      }
    }

    if (responsibleParty.toUpperCase() === 'OPERATOR' && !operatorName.trim()) {
      toast.error('Operator Name is required when Responsible Party is OPERATOR');
      return;
    }

    // BUILD PAYLOAD
    let payload: any;
    if (type === 'REWORK') {
      payload = {
        scId: sc.id,
        type: 'REWORK',
        component: component.trim() || sc.productName,
        errorType: errorType.trim() || undefined,
        stageOfFailure,
        quantityAffected: Number(quantityAffected) || 1,
        defectDescription: defectDescription.trim(),
        responsibleParty: responsibleParty.toUpperCase(),
        operatorName: responsibleParty.toUpperCase() === 'OPERATOR' ? operatorName.trim() : undefined,
        reworkDescription: reworkDescription.trim(),
        costEstimation: Number(costEstimation) || 0,
        lossEstimation: lossEstimation !== '' ? Number(lossEstimation) : undefined,
        alternativeNotes: alternativeNotes.trim() || undefined,
      };
    } else {
      payload = {
        scId: sc.id,
        type: 'REJECTION',
        component: component.trim() || sc.productName,
        errorType: errorType.trim() || undefined,
        rejectionProcessTemplate,
        rejectionFailedStage,
        rejectionStageCosts,
        quantityAffected: Number(quantityAffected) || 1,
        defectDescription: defectDescription.trim(),
        responsibleParty: responsibleParty.toUpperCase(),
        operatorName: responsibleParty.toUpperCase() === 'OPERATOR' ? operatorName.trim() : undefined,
        rejectionDescription: rejectionDescription.trim(),
        costEstimation: Number(costEstimation) || 0,
        lossEstimation: lossEstimation !== '' ? Number(lossEstimation) : undefined,
        alternativeNotes: alternativeNotes.trim() || undefined,
      };
    }

    mutation.mutate(payload);
  };

  const activeStages =
    type === 'REJECTION' && rejectionProcessTemplate && rejectionFailedStage
      ? getActiveStages(rejectionProcessTemplate, rejectionFailedStage)
      : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'REWORK' ? 'New Rework Report' : 'New Rejection Report'}
      className="max-w-3xl"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={type === 'REWORK' ? 'primary' : 'danger'}
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Submitting to Quality Hub...' : 'Submit Report'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 py-1">
        {/* SECTION 1: Pre-filled Info */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Section 1 — Order & Component Context
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-slate-400 dark:text-slate-400">
                SC Number
              </span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {sc?.scNumber || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-400 dark:text-slate-400">
                PO Number
              </span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {sc?.poNumber || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-400 dark:text-slate-400">
                Component (SC Original)
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                {sc?.productName || '—'}
              </span>
            </div>
            <div>
              <label
                htmlFor="qty-affected-input"
                className="block text-xs font-medium text-slate-400 dark:text-slate-400 mb-1"
              >
                Quantity Affected <span className="text-red-500">*</span>
              </label>
              <input
                id="qty-affected-input"
                type="number"
                min="1"
                step="1"
                required
                className="w-full px-2.5 py-1 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={quantityAffected}
                onChange={(e) => setQuantityAffected(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Defect Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Section 2 — Defect Details
            </h4>
            {isLoadingMasterData && (
              <span className="text-xs text-primary animate-pulse">
                Loading ECR Master Data...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Component Datalist */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Component Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="ecr-components-list"
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Select or enter component name"
                value={component}
                onChange={(e) => setComponent(e.target.value)}
              />
              <datalist id="ecr-components-list">
                {componentsList.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            {/* Error Type Datalist */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Error Type <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                list="ecr-errortypes-list"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. OD Undersize, Hardness"
                value={errorType}
                onChange={(e) => setErrorType(e.target.value)}
              />
              <datalist id="ecr-errortypes-list">
                {errorTypesList.map((et) => (
                  <option key={et.id} value={et.name} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Conditional Fields based on Type */}
          {type === 'REWORK' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Stage of Failure <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={stageOfFailure}
                onChange={(e) => setStageOfFailure(e.target.value)}
              >
                <option value="Inward Inspection">Inward Inspection</option>
                <option value="In-Process">In-Process</option>
                <option value="Final Inspection">Final Inspection</option>
                <option value="Customer Return">Customer Return</option>
              </select>
            </div>
          ) : (
            /* REJECTION: Process Template & Failed Stage */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Process Template <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={rejectionProcessTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">— Select Process Template —</option>
                  {Object.keys(PROCESS_TEMPLATES).map((tmpl) => (
                    <option key={tmpl} value={tmpl}>
                      {tmpl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Failed Stage <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={!rejectionProcessTemplate}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  value={rejectionFailedStage}
                  onChange={(e) => handleFailedStageChange(e.target.value)}
                >
                  <option value="">
                    {rejectionProcessTemplate
                      ? '— Select Failed Stage —'
                      : '— Select Template First —'}
                  </option>
                  {(PROCESS_TEMPLATES[rejectionProcessTemplate] || []).map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Defect Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Defect Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Describe the failure and defects identified..."
              value={defectDescription}
              onChange={(e) => setDefectDescription(e.target.value)}
            />
          </div>
        </div>

        {/* SECTION 3: Inspection Details */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
            Section 3 — Inspection & Action Plan
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Responsible Party <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={responsibleParty}
                onChange={(e) => setResponsibleParty(e.target.value)}
              >
                <option value="OPERATOR">OPERATOR</option>
                <option value="VENDOR">VENDOR</option>
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="MATERIAL">MATERIAL</option>
              </select>
            </div>

            {responsibleParty === 'OPERATOR' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Operator Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="ecr-operators-list"
                  required
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Select or enter operator name"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                />
                <datalist id="ecr-operators-list">
                  {operatorsList.map((op) => (
                    <option key={op.id} value={op.name} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          {/* Conditional Description: Rework vs Rejection */}
          {type === 'REWORK' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rework Action Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Detail the rework procedures, re-machining instructions..."
                value={reworkDescription}
                onChange={(e) => setReworkDescription(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rejection Reason & Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Explain justification for scrapping/rejecting this component..."
                value={rejectionDescription}
                onChange={(e) => setRejectionDescription(e.target.value)}
              />
            </div>
          )}

          {/* REJECTION: Process Flow Costs Table */}
          {type === 'REJECTION' && activeStages.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Process Flow Costs (Active Stages up to Failure)
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {activeStages.length} stages active
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {activeStages.map((st) => (
                  <div
                    key={st}
                    className="flex flex-col p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/60"
                  >
                    <span className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 truncate mb-1" title={st}>
                      {st}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        value={rejectionStageCosts[st] ?? ''}
                        onChange={(e) => handleStageCostChange(st, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financials: Cost Estimation, Loss Estimation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cost Estimation (₹) <span className="text-red-500">*</span>
                {type === 'REJECTION' && (
                  <span className="text-[11px] text-primary ml-1 font-normal">
                    (Auto-calculated from stage costs)
                  </span>
                )}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0"
                value={costEstimation}
                onChange={(e) => setCostEstimation(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Loss Estimation (₹){' '}
                <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0"
                value={lossEstimation}
                onChange={(e) => setLossEstimation(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          {/* Alternative Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Alternative Notes <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Any additional observations or corrective actions..."
              value={alternativeNotes}
              onChange={(e) => setAlternativeNotes(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default ReworkSubmitModal;
