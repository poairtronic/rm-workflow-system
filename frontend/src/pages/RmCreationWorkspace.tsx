import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { masterDataService } from '../services/masterDataService';
import type { Product } from '../services/masterDataService';
import { workflowService } from '../services/workflowService';

interface RMItemForm {
  id: string; // internal ui id
  productId: string;
  spec: string;
  quantity: number;
}

interface SCCardForm {
  id: string; // internal ui id
  scNumber: string;
  productName: string;
  items: RMItemForm[];
  error?: string;
}

export function RmCreationWorkspace() {
  const searchParams = new URLSearchParams(window.location.search);
  const existingPoId = searchParams.get('poId');

  const [poNumber, setPoNumber] = useState('');
  const [scCards, setScCards] = useState<SCCardForm[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    if (existingPoId) {
      loadExistingDraft(existingPoId);
    }
  }, [existingPoId]);

  const loadExistingDraft = async (poId: string) => {
    setLoading(true);
    try {
      const res = await workflowService.getDraftRmByPo(poId);
      const data = (res as any).data ?? res;
      
      if (data && data.poNumber) {
        setPoNumber(data.poNumber);
        
        const loadedCards = data.scs.map((sc: any) => ({
          id: sc.scId,
          scNumber: sc.scNumber,
          productName: sc.productName,
          items: sc.items.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            productId: item.productId,
            spec: item.spec,
            quantity: item.quantity,
          })),
        }));
        
        setScCards(loadedCards);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load existing draft.');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      // Load active products that can be used as raw materials
      const res = await masterDataService.getProducts({ isActive: true, pageSize: 200 });
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const handleAddScCard = () => {
    setScCards([
      ...scCards,
      {
        id: crypto.randomUUID(),
        scNumber: '',
        productName: '',
        items: [{ id: crypto.randomUUID(), productId: '', spec: '', quantity: 1 }],
      },
    ]);
  };

  const handleRemoveScCard = (id: string) => {
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
            items: [...card.items, { id: crypto.randomUUID(), productId: '', spec: '', quantity: 1 }],
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
    setScCards(
      scCards.map((card) => {
        if (card.id === scId) {
          return {
            ...card,
            items: card.items.map((item) => {
              if (item.id === itemId) {
                return { ...item, [field]: value };
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
      setError('PO Number is required.');
      return false;
    }
    if (scCards.length === 0) {
      setError('At least one SC Card is required.');
      return false;
    }

    let isValid = true;
    const validatedCards = scCards.map((card) => {
      let cardError = undefined;
      if (!card.scNumber.trim()) cardError = 'SC Number is required.';
      else if (!card.productName.trim()) cardError = 'Product Name being manufactured is required.';
      else if (card.items.length === 0) cardError = 'At least one RM item is required.';
      else {
        const productIds = new Set();
        for (const item of card.items) {
          if (!item.productId) {
            cardError = 'All items must have a selected RM product.';
            break;
          }
          if (item.quantity <= 0) {
            cardError = 'All items must have a quantity greater than 0.';
            break;
          }
          if (!item.spec.trim()) {
            cardError = 'All items must have a spec/grade.';
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
    if (!isValid) setError('Please fix the errors in the SC cards before continuing.');
    return isValid;
  };

  const performSaveDraft = async () => {
    setError(null);
    setSuccess(null);
    if (!validateForm()) return false;

    setLoading(true);
    try {
      const payload = {
        poNumber: poNumber.trim(),
        scs: scCards.map((card) => ({
          scNumber: card.scNumber.trim(),
          productName: card.productName.trim(),
          items: card.items.map((item) => ({
            productId: item.productId,
            spec: item.spec.trim(),
            quantity: Number(item.quantity),
          })),
        })),
      };

      if (existingPoId) {
        await workflowService.updateDraftRm(existingPoId, payload);
        return true;
      } else {
        await workflowService.createDraftRm(payload);
        return true;
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save draft RM.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    const successSave = await performSaveDraft();
    if (successSave) {
      setSuccess('Draft saved successfully! You can view it in My Requisitions.');
    }
  };

  const handleSubmitRequisition = async () => {
    if (!existingPoId) {
       setError('Please Save Draft first before submitting.');
       setShowSubmitModal(false);
       return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const saveOk = await performSaveDraft();
      if (!saveOk) {
        setSubmitting(false);
        setShowSubmitModal(false);
        return;
      }

      await workflowService.submitDraftRmByPo(existingPoId);
      setSuccess('Requisition submitted to Stores successfully!');
      setTimeout(() => {
        window.location.href = '/design/my-requisitions';
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit requisition.');
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Create RM Requisition"
        subtitle="Draft Raw Material requests grouped by PO Number."
        actionSlot={
          <div className="flex space-x-3">
            <button
              onClick={handleSaveDraft}
              disabled={loading || submitting}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Draft'}</span>
            </button>
            {existingPoId && (
              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={loading || submitting}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <span>Submit to Stores</span>
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Purchase Order Details</h2>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-slate-700 mb-1">PO Number *</label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-2026-001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Style Codes (SCs)</h2>
          <button
            onClick={handleAddScCard}
            className="flex items-center space-x-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add SC Card</span>
          </button>
        </div>

        {scCards.length === 0 && (
          <div className="text-center py-12 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
            <p className="text-slate-500 mb-4">No Style Codes added yet.</p>
            <button
              onClick={handleAddScCard}
              className="inline-flex items-center space-x-2 px-4 py-2 text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Add First SC</span>
            </button>
          </div>
        )}

        {scCards.map((card) => (
          <div key={card.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SC Number *</label>
                  <input
                    type="text"
                    value={card.scNumber}
                    onChange={(e) => handleUpdateScCard(card.id, 'scNumber', e.target.value)}
                    placeholder="e.g. SC-123"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Manufactured *</label>
                  <input
                    type="text"
                    value={card.productName}
                    onChange={(e) => handleUpdateScCard(card.id, 'productName', e.target.value)}
                    placeholder="e.g. Finished Widget A"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <button
                onClick={() => handleRemoveScCard(card.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                title="Remove SC Card"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            {card.error && (
              <div className="px-6 py-2 bg-red-50 text-red-600 text-sm border-b border-red-100">
                {card.error}
              </div>
            )}

            <div className="p-6">
              <h3 className="text-sm font-medium text-slate-900 mb-4">Raw Material Requirements</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="pb-3 font-medium">RM Item (Product Master) *</th>
                      <th className="pb-3 font-medium">Spec / Grade *</th>
                      <th className="pb-3 font-medium w-32">Quantity *</th>
                      <th className="pb-3 font-medium w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {card.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-4">
                          <select
                            value={item.productId}
                            onChange={(e) => handleUpdateItem(card.id, item.id, 'productId', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            <option value="">Select an RM Product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code ? `${p.code} - ` : ''}{p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            value={item.spec}
                            onChange={(e) => handleUpdateItem(card.id, item.id, 'spec', e.target.value)}
                            placeholder="e.g. EN8"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(card.id, item.id, 'quantity', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleRemoveItemFromSc(card.id, item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                            disabled={card.items.length === 1}
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
                className="mt-4 flex items-center space-x-1 text-sm text-indigo-600 font-medium hover:text-indigo-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Material Row</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Submit Requisition</h3>
            <p className="text-slate-600 mb-6">
              You are about to submit RM requisitions for PO <strong>{poNumber}</strong> with {scCards.length} Style Codes.
              Once submitted, this draft will be locked and sent to Stores for review.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequisition}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
              >
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
