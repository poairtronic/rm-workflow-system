import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { vendorMasterApi, productionProcessApi } from '../../services/api';
import type { CreateVendorSlaDto } from '../../types/vendor-sla.dto';

export function SlaDefinitionForm() {
  const { register, formState: { errors } } = useFormContext<CreateVendorSlaDto>();

  const { data: vendors = [], isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors-list-for-sla'],
    queryFn: () => vendorMasterApi.getAll(),
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery({
    queryKey: ['processes-list-for-sla'],
    queryFn: () => productionProcessApi.getAll(),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <h2 className="text-[15px] font-semibold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-100 pb-4">
        SLA Definition Parameters
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Manufacturing Vendor *
          </label>
          <select
            {...register('vendorId', { required: 'Please select a vendor' })}
            className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{isLoadingVendors ? 'Loading vendors...' : 'Select Vendor...'}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {v.code ? `(${v.code})` : ''}
              </option>
            ))}
          </select>
          {errors.vendorId && (
            <p className="mt-1 text-xs text-red-500">{errors.vendorId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Production Process *
          </label>
          <select
            {...register('processId', { required: 'Please select a process' })}
            className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{isLoadingProcesses ? 'Loading processes...' : 'Select Process...'}</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nomenclature} {p.internalCode ? `[${p.internalCode}]` : ''}
              </option>
            ))}
          </select>
          {errors.processId && (
            <p className="mt-1 text-xs text-red-500">{errors.processId.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Standard TAT (Days) *
          </label>
          <input
            type="number"
            {...register('standardTatDays', { 
              required: 'Standard TAT is required',
              valueAsNumber: true,
              min: { value: 1, message: 'Must be at least 1 day' }
            })}
            className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent tabular-nums"
            placeholder="e.g. 5"
          />
          {errors.standardTatDays && (
            <p className="mt-1 text-xs text-red-500">{errors.standardTatDays.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Lead Time Multiplier
          </label>
          <input
            type="number"
            step="0.05"
            {...register('leadTimeMultiplier', { 
              valueAsNumber: true,
              min: { value: 0.5, message: 'Minimum 0.5' } 
            })}
            className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent tabular-nums"
            placeholder="e.g. 1.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tolerance Buffer (Days)
          </label>
          <input
            type="number"
            {...register('toleranceBufferDays', { 
              valueAsNumber: true,
              min: { value: 0, message: 'Cannot be negative' } 
            })}
            className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent tabular-nums"
            placeholder="e.g. 1"
          />
        </div>
      </div>
    </div>
  );
}
