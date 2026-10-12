import { PageHeader } from '../components/ui';
import { DcMovementsWorkspaceView } from '../components/dispatch/DcMovementsWorkspaceView';

export function DcMovementsWorkspace() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Delivery Challan Movements Ledger"
        subtitle="Comprehensive inward & outward movement ledger tracking material across Type 1 (Process) and Type 2 (Stock Conversion)"
        breadcrumbs={<span>Delivery Challan / DC Movements</span>}
      />
      <DcMovementsWorkspaceView />
    </div>
  );
}
