import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertCircle, Send, CheckCircle2, FileText, Layers, Box } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { masterDataService } from '../services/masterDataService';
import type { Product } from '../services/masterDataService';
import { workflowService } from '../services/workflowService';
import type { SC } from '../services/workflowService';
import { api, unwrapList } from '../services/api';

type CreationMode = 'BY_PO' | 'BY_SC' | 'STANDALONE';

interface RMItemForm {
  id: string; // internal ui id
  productId: string;
  partName: string;
  partNumber: string;
  spec: string;
  quantity: number;
  remarks: string;
}

interface SCCardForm {
  id: string; // internal ui id
  scNumber: string;
  productName: string;
  targetQuantity: number;
  items: RMItemForm[];
  error?: string;
}

const getNextPartNumber = (cards: SCCardForm[], extraOffset = 0): string => {
  let maxNum = 0;
  for (const c of cards) {
    for (const it of c.items) {
      if (it.partNumber) {
        const match = it.partNumber.match(/PRD\s*0*(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
  }
  const nextVal = maxNum + 1 + extraOffset;
  return `PRD ${String(nextVal).padStart(3, '0')}`;
};

const createDefaultItem = (existingCards: SCCardForm[] = [], extraOffset = 0): RMItemForm => ({
  id: crypto.randomUUID(),
  productId: '',
  partName: '',
  partNumber: getNextPartNumber(existingCards, extraOffset),
  spec: '',
  quantity: 1,
  remarks: '',
});

export function RmCreationWorkspace() {
  const searchParams = new URLSearchParams(window.location.search);
  const existingPoId = searchParams.get('poId');

  const [mode, setMode] = useState<CreationMode>('BY_PO');
  const [poNumber, setPoNumber] = useState('');
  const [scCards, setScCards] = useState<SCCardForm[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [availableScs, setAvailableScs] = useState<SC[]>([]);
  const [selectedScId, setSelectedScId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectionNotice, setRejectionNotice] = useState<string | null>(null);

  const [productBalances, setProductBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    loadProducts();
    loadScList();
    if (existingPoId) {
      loadExistingDraft(existingPoId);
    } else {
      // Initialize with one default SC card
      handleAddScCard();
    }
  }, [existingPoId]);

  const loadProducts = async () => {
    try {
      const res = await masterDataService.getProducts({ isActive: true, pageSize: 1000 });
      const list = unwrapList(res);
      setProducts(list.length > 0 ? list : (res?.data || []));
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const loadScList = async () => {
    try {
      const res = await workflowService.getScList();
      const list = unwrapList(res);
      setAvailableScs(list || []);
    } catch (err) {
      console.error('Failed to load SC list', err);
    }
  };

  const loadBalances = async (productId: string) => {
    if (!productId || productBalances[productId] !== undefined) return;
    try {
      const res = await api.get<any[]>(`/api/inventory/balances?productId=${productId}`);
      const list = unwrapList(res);
      const total = list.reduce((sum: number, b: any) => sum + Number(b.currentQuantity || 0), 0);
      setProductBalances((prev) => ({ ...prev, [productId]: total }));
    } catch (err) {
      console.error('Failed to load balance for product', productId, err);
    }
  };

  const loadExistingDraft = async (poId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await workflowService.getDraftRmByPo(poId);
      const data = (res as any)?.data ?? res;
      
      if (data && data.poNumber) {
        setPoNumber(data.poNumber);
        
        // Check for rejection notices
        const rejectedSc = data.scs?.find((s: any) => s.status === 'REJECTED' && s.remarks);
        if (rejectedSc) {
          setRejectionNotice(rejectedSc.remarks);
        }

        const loadedCards = (data.scs || []).map((sc: any) => ({
          id: sc.scId || crypto.randomUUID(),
          scNumber: sc.scNumber || '',
          productName: sc.productName || '',
          targetQuantity: Number(sc.targetQuantity) || 1,
          items: (sc.items || []).map((item: any, iIdx: number) => ({
            id: item.id || crypto.randomUUID(),
            productId: item.productId || '',
            partNumber: item.partNumber || `PRD ${String(iIdx + 1).padStart(3, '0')}`,
            partName: item.partName || item.remarks || '',
            spec: item.spec || '',
            quantity: Number(item.quantity) || 1,
            remarks: item.remarks || item.partName || '',
          })),
        }));
        
        if (loadedCards.length > 0) {
          setScCards(loadedCards);
          loadedCards.forEach((c: any) => {
            c.items.forEach((it: any) => {
              if (it.productId) loadBalances(it.productId);
            });
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load existing draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: CreationMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);

    if (newMode === 'STANDALONE') {
      const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const standPo = `REQ-SHOP-${timestamp}-${randomSuffix}`;
      setPoNumber(standPo);
      setScCards([
        {
          id: crypto.randomUUID(),
          scNumber: `SHOP-JOB-${randomSuffix}`,
          productName: 'Ad-Hoc Shopfloor Fabrication / Repair',
          targetQuantity: 1,
          items: [createDefaultItem([])],
        },
      ]);
    } else if (newMode === 'BY_SC') {
      setSelectedScId('');
      setPoNumber('');
      setScCards([]);
    } else {
      // BY_PO
      if (!existingPoId) {
        setPoNumber('');
        setScCards([
          {
            id: crypto.randomUUID(),
            scNumber: '',
            productName: '',
            targetQuantity: 1,
            items: [createDefaultItem([])],
          },
        ]);
      }
    }
  };

  const handleSelectSc = (scId: string) => {
    setSelectedScId(scId);
    const foundSc = availableScs.find((s) => s.id === scId);
    if (foundSc) {
      const poNum = foundSc.purchaseOrder?.poNumber || `PO-AUTO-${foundSc.scNumber}`;
      setPoNumber(poNum);
      setScCards([
        {
          id: foundSc.id,
          scNumber: foundSc.scNumber,
          productName: foundSc.productName,
          targetQuantity: foundSc.targetQuantity || 1,
          items: [createDefaultItem([])],
        },
      ]);
    }
  };

  const handleAddScCard = () => {
    setScCards([
      ...scCards,
      {
        id: crypto.randomUUID(),
        scNumber: '',
        productName: '',
        targetQuantity: 1,
        items: [createDefaultItem(scCards)],
      },
    ]);
  };

  const handleRemoveScCard = (id: string) => {
    if (scCards.length <= 1) {
      setError('At least one Style Code card is required.');
      return;
    }
    setScCards(scCards.filter((card) => card.id !== id));
  };

  const handleUpdateScCard = (id: string, field: keyof SCCardForm, value: any) => {
    setScCards(
      scCards.map((card) => {
        if (card.id === id) {
          return { ...card, [field]: value };
        }
        return card;
      })
    );
  };

  const handleAddItemToSc = (scId: string) => {
    setScCards(
      scCards.map((card) => {
        if (card.id === scId) {
          return {
            ...card,
            items: [...card.items, createDefaultItem(scCards)],
          };
        }
        return card;
      })
    );
  };

  const handleRemoveItemFromSc = (scId: string, itemId: string) => {
    setScCards(
      scCards.map((card) => {
        if (card.id === scId) {
          return {
            ...card,
            items: card.items.filter((item) => item.id !== itemId),
          };
        }
        return card;
      })
    );
  };

  const handleUpdateItem = (scId: string, itemId: string, field: keyof RMItemForm, value: any) => {
    if (field === 'productId' && value) {
      loadBalances(value);
    }
    setScCards(
      scCards.map((card) => {
        if (card.id === scId) {
          return {
            ...card,
            items: card.items.map((item) => {
              if (item.id === itemId) {
                const updated = { ...item, [field]: value };
                if (field === 'partName') {
                  updated.remarks = value;
                  if (!updated.partNumber?.trim()) {
                    updated.partNumber = getNextPartNumber(scCards);
                  }
                }
                return updated;
              }
              return item;
            }),
          };
        }
        return card;
      })
    );
  };

  const validateForm = () => {
    if (!poNumber.trim()) {
      setError('PO / Requisition Number is required.');
      return false;
    }
    if (scCards.length === 0) {
      setError('At least one Style Code / Job Card is required.');
      return false;
    }

    let isValid = true;
    const validatedCards = scCards.map((card) => {
      let cardError = undefined;
      if (!card.scNumber.trim()) cardError = 'SC Number / Job Code is required.';
      else if (!card.productName.trim()) cardError = 'Product Name being manufactured is required.';
      else if (card.items.length === 0) cardError = 'At least one RM item is required.';
      else {
        const productIds = new Set();
        for (const item of card.items) {
          if (!item.productId) {
            cardError = 'All items must have a selected RM product from master catalog.';
            break;
          }
          if (item.quantity <= 0) {
            cardError = 'All items must have a quantity greater than 0.';
            break;
          }
          if (!item.spec.trim()) {
            cardError = 'All items must have a spec/grade specification.';
            break;
          }
          if (!item.partName?.trim() && !item.remarks?.trim()) {
            cardError = 'All items must have a Part Name specified.';
            break;
          }
          if (productIds.has(item.productId)) {
            cardError = 'Duplicate RM products are not allowed in the same SC.';
            break;
          }
          productIds.add(item.productId);
        }
      }

      if (cardError) isValid = false;
      return { ...card, error: cardError };
    });

    setScCards(validatedCards as SCCardForm[]);
    if (!isValid) setError('Please resolve highlighted errors in the form before proceeding.');
    return isValid;
  };

  const performSaveDraft = async (): Promise<{ success: boolean; poId?: string }> => {
    setError(null);
    setSuccess(null);
    if (!validateForm()) return { success: false };

    setLoading(true);
    try {
      const payload = {
        poNumber: poNumber.trim(),
        scs: scCards.map((card) => ({
          scNumber: card.scNumber.trim(),
          productName: card.productName.trim(),
          targetQuantity: Number(card.targetQuantity) || 1,
          items: card.items.map((item, itemIdx) => ({
            productId: item.productId,
            partNumber: item.partNumber?.trim() || `PRD ${String(itemIdx + 1).padStart(3, '0')}`,
            partName: item.partName?.trim() || item.remarks?.trim() || undefined,
            spec: item.spec.trim(),
            quantity: Number(item.quantity),
            remarks: item.remarks?.trim() || item.partName?.trim() || undefined,
          })),
        })),
      };

      if (existingPoId) {
        const res = await workflowService.updateDraftRm(existingPoId, payload);
        const data = (res as any).data ?? res;
        return { success: true, poId: data?.poId || existingPoId };
      } else {
        const res = await workflowService.createDraftRm(payload);
        const data = (res as any).data ?? res;
        return { success: true, poId: data?.poId };
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save draft RM requisition.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    const res = await performSaveDraft();
    if (res.success) {
      setSuccess('Draft saved successfully! You can view and manage it in My Requisitions.');
    }
  };

  const handleSubmitRequisition = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const saveRes = await performSaveDraft();
      if (!saveRes.success || !saveRes.poId) {
        setSubmitting(false);
        setShowSubmitConfirm(false);
        return;
      }

      await workflowService.submitDraftRmByPo(saveRes.poId);
      setSuccess('RM Requisition successfully submitted to Stores! Stores queue has been updated for RM Issue.');
      setShowSubmitConfirm(false);
      setTimeout(() => {
        window.location.href = '/design/my-requisitions';
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit requisition to Stores.');
    } finally {
      setSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="RM Creation"
        subtitle="Request raw material according to Purchase Order, Style Code, or as a standalone request."
        actionSlot={
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSaveDraft}
              disabled={loading || submitting}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-xs"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>{loading ? 'Saving...' : 'Save Draft'}</span>
            </button>
            <button
              onClick={() => {
                if (validateForm()) {
                  setShowSubmitConfirm(true);
                }
              }}
              disabled={loading || submitting}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Submit to Stores</span>
            </button>
          </div>
        }
      />

      {/* Mode Selector */}
      {!existingPoId && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3">Request Mode:</span>
          <button
            type="button"
            onClick={() => handleModeChange('BY_PO')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'BY_PO'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. According to Purchase Order (PO)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('BY_SC')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'BY_SC'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. According to Style Code (SC)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('STANDALONE')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'STANDALONE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>3. Separately (Standalone Request)</span>
          </button>
        </div>
      )}

      {/* Rejection Notice Banner */}
      {rejectionNotice && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start space-x-3 text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-red-900">Rejection Notice from Stores</h4>
            <p className="text-sm mt-0.5">{rejectionNotice}</p>
            <p className="text-xs text-red-600 mt-2 font-medium">
              Please adjust the material specifications or quantities below and click <strong>Submit to Stores</strong> to re-submit this requisition.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-[16px] font-bold text-slate-900">Confirm Requisition Submission to Stores</h4>
              <p className="text-sm text-slate-600 mt-0.5">
                You are about to submit RM requisitions for Reference <strong>{poNumber}</strong> with {scCards.length} Style Code / Component card{scCards.length !== 1 ? 's' : ''}. Stores department will immediately receive this in their RM Issue queue.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRequisition}
                disabled={submitting}
                className="flex items-center space-x-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Yes, Confirm & Send to Stores'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      {/* Header Form Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-4">
        {mode === 'BY_SC' && !existingPoId && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Select Active Style Code (SC) *
            </label>
            <select
              value={selectedScId}
              onChange={(e) => handleSelectSc(e.target.value)}
              className="w-full max-w-xl px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
            >
              <option value="">-- Choose an existing Style Code from database --</option>
              {availableScs.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.scNumber} - {sc.productName} ({sc.purchaseOrder?.poNumber || 'No PO'})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Selecting an existing SC automatically loads the linked PO number and component details.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              {mode === 'STANDALONE' ? 'Job / Standalone Reference *' : 'Purchase Order (PO) Number *'}
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder={mode === 'STANDALONE' ? 'e.g. REQ-SHOP-2026-01' : 'e.g. PO-2026-001'}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Workflow Target</label>
            <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span>Destination: Stores RM Issue Queue</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            </div>
          </div>
        </div>
      </div>

      {/* Style Code Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'STANDALONE' ? 'Internal Job / Part Specification' : 'Style Codes (SCs)'}
            </h2>
            <p className="text-xs text-slate-500">
              Define the manufactured component and the exact raw material items required from Stores.
            </p>
          </div>
          {mode === 'BY_PO' && (
            <button
              onClick={handleAddScCard}
              className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Add Another SC Card</span>
            </button>
          )}
        </div>

        {scCards.length === 0 && (
          <div className="text-center py-12 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
            <p className="text-slate-500 mb-4">No Style Codes selected or added yet.</p>
            <button
              onClick={handleAddScCard}
              className="inline-flex items-center space-x-2 px-4 py-2 text-indigo-600 font-semibold hover:bg-indigo-50 rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Style Code</span>
            </button>
          </div>
        )}

        {scCards.map((card, idx) => (
          <div key={card.id} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    {mode === 'STANDALONE' ? 'Job Code / Part Tag *' : `SC Number #${idx + 1} *`}
                  </label>
                  <input
                    type="text"
                    value={card.scNumber}
                    onChange={(e) => handleUpdateScCard(card.id, 'scNumber', e.target.value)}
                    placeholder="e.g. SC-101"
                    className="w-full px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Manufactured Product Name *
                  </label>
                  <input
                    type="text"
                    value={card.productName}
                    onChange={(e) => handleUpdateScCard(card.id, 'productName', e.target.value)}
                    placeholder="e.g. Precision Bush / Rotor Shaft"
                    className="w-full px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Target Qty *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={card.targetQuantity}
                    onChange={(e) => handleUpdateScCard(card.id, 'targetQuantity', Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>
              {scCards.length > 1 && (
                <button
                  onClick={() => handleRemoveScCard(card.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end md:self-center"
                  title="Remove SC Card"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {card.error && (
              <div className="px-6 py-2 bg-red-50 text-red-600 text-xs font-semibold border-b border-red-100 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{card.error}</span>
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Required Raw Material Items
                </h3>
                <span className="text-xs text-slate-400">
                  Select from master product catalog & specify requirements
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wide">
                      <th className="pb-3 font-semibold">RM Product Master *</th>
                      <th className="pb-3 font-semibold">Part Name *</th>
                      <th className="pb-3 font-semibold w-44">Part Number (Auto) *</th>
                      <th className="pb-3 font-semibold">Spec / Grade *</th>
                      <th className="pb-3 font-semibold w-40">Required Qty *</th>
                      <th className="pb-3 font-semibold w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {card.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4">
                          <select
                            value={item.productId}
                            onChange={(e) => handleUpdateItem(card.id, item.id, 'productId', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                          >
                            <option value="">-- Select RM Material --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code ? `[${p.code}] ` : ''}{p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            value={item.partName ?? item.remarks ?? ''}
                            onChange={(e) => handleUpdateItem(card.id, item.id, 'partName', e.target.value)}
                            placeholder="e.g. APG DIA 14"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                          />
                        </td>
                        <td className="py-3 pr-4 w-44">
                          <input
                            type="text"
                            value={item.partNumber || ''}
                            onChange={(e) => handleUpdateItem(card.id, item.id, 'partNumber', e.target.value)}
                            placeholder="e.g. PRD 001"
                            className="w-full px-3 py-1.5 border border-indigo-200 bg-indigo-50/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono font-bold text-indigo-950 placeholder:text-indigo-300"
                            title="Auto-generated sequential Part Number (editable)"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            value={item.spec}
                            onChange={(e) => handleUpdateItem(card.id, item.id, 'spec', e.target.value)}
                            placeholder="e.g. EN8 / SS316 / DIA 25mm"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          {(() => {
                            const p = products.find((prod) => prod.id === item.productId);
                            const uom = p?.uom?.toUpperCase() || 'NOS';
                            const avail = item.productId ? (productBalances[item.productId] ?? null) : null;
                            return (
                              <div>
                                <input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(card.id, item.id, 'quantity', Number(e.target.value))}
                                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums text-sm font-semibold"
                                />
                                {item.productId && (
                                  <div className="flex items-center space-x-1 mt-1 text-[11px] font-semibold text-slate-500">
                                    <span>In Warehouse:</span>
                                    <span className={avail !== null && avail > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                                      {avail !== null ? avail : 'Checking...'} {uom}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleRemoveItemFromSc(card.id, item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                            disabled={card.items.length === 1}
                            title="Remove Material Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <button
                onClick={() => handleAddItemToSc(card.id)}
                className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Material Row</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
