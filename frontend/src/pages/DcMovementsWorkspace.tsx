import { PageHeader } from '../components/ui';
import { DcMovementsWorkspaceView } from '../components/dispatch/DcMovementsWorkspaceView';

export function DcMovementsWorkspace() {
  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Delivery Challan Movements Ledger"
        subtitle="Comprehensive inward & outward movement ledger tracking material across Type 1 (Process) and Type 2 (Stock Conversion)"
        breadcrumbs={<span>Delivery Challan / DC Movements</span>}
      />
      <DcMovementsWorkspaceView />
    </div>
  );
}
