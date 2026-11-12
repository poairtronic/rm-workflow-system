
import type { ProductionProcessDto } from '../../types/process-master.dto';
import { Edit2, Trash2 } from 'lucide-react';

interface ProcessDirectoryGridProps {
  data: ProductionProcessDto[];
  isLoading: boolean;
  onEdit: (process: ProductionProcessDto) => void;
  onDelete?: (process: ProductionProcessDto) => void;
  isDeleting?: boolean;
}

const StatusBadge = ({ isActive }: { isActive: boolean }) => {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 gap-1.5 whitespace-nowrap">
        <span className="h-[6px] w-[6px] rounded-full bg-green-500"></span>
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 gap-1.5 whitespace-nowrap">
      <span className="h-[6px] w-[6px] rounded-full bg-slate-400"></span>
      Legacy
    </span>
  );
};

export function ProcessDirectoryGrid({ data, isLoading, onEdit, onDelete, isDeleting }: ProcessDirectoryGridProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-2">Seq ID</th>
                <th className="px-6 py-2">Process Nomenclature</th>
                <th className="px-6 py-2">Base UOM</th>
                <th className="px-6 py-2">Active Status</th>
                <th className="px-6 py-2">Linked Vendors</th>
                <th className="px-6 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="h-14 animate-pulse">
                  <td className="px-6 py-2"><div className="h-4 bg-slate-200 rounded w-10"></div></td>
                  <td className="px-6 py-2">
                    <div className="h-4 bg-slate-200 rounded w-48 mb-1"></div>
                    <div className="h-3 bg-slate-200 rounded w-24"></div>
                  </td>
                  <td className="px-6 py-2"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
                  <td className="px-6 py-2"><div className="h-5 bg-slate-200 rounded-full w-20"></div></td>
                  <td className="px-6 py-2"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  <td className="px-6 py-2 text-right"><div className="h-8 bg-slate-200 rounded-md w-28 ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-32 flex items-center justify-center">
        <p className="text-slate-500 text-sm">No production processes defined.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-2">Seq ID</th>
              <th className="px-6 py-2">Process Nomenclature</th>
              <th className="px-6 py-2">Base UOM</th>
              <th className="px-6 py-2">Active Status</th>
              <th className="px-6 py-2">Linked Vendors</th>
              <th className="px-6 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item) => (
              <tr key={item.id} className="h-14 hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-2 tabular-nums text-slate-600 font-medium">
                  {item.sequenceId}
                </td>
                <td className="px-6 py-2">
                  <div className="font-medium text-slate-900">{item.nomenclature}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{item.internalCode}</div>
                </td>
                <td className="px-6 py-2 text-slate-600">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                    {item.baseUom}
                  </span>
                </td>
                <td className="px-6 py-2">
                  <StatusBadge isActive={item.isActive} />
                </td>
                <td className="px-6 py-2">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="tabular-nums font-medium">{item.linkedVendorIds.length}</span>
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Vendors</span>
                  </div>
                </td>
                <td className="px-6 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors shadow-2xs"
                      title="Edit Process"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      Edit
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(item)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium rounded-lg hover:bg-rose-100 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-200 transition-colors shadow-2xs disabled:opacity-50"
                        title="Delete Process"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
