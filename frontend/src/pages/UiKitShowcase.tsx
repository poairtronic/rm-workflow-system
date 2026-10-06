import { useState } from 'react';
import { 
  PageHeader, DataTable, StatusBadge, EmptyState, ErrorState, 
  LoadingState, SkeletonBlock, ConfirmDialog, Modal, SlideOver,
  FormField, TextInput, NumberInput, Select, Textarea, Checkbox, DateInput,
  SearchSelect, type ColumnDef
} from '../components/ui';

const sampleData = [
  { id: 1, name: 'Widget A', price: 12.5, status: 'OPEN' },
  { id: 2, name: 'Widget B', price: 45.0, status: 'DISPATCHED' },
  { id: 3, name: 'Widget C', price: 9.99, status: 'RETURNED' },
];

const sampleColumns: ColumnDef<typeof sampleData[0]>[] = [
  { key: 'id', header: 'ID', sortable: true },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'price', header: 'Price', isNumeric: true, sortable: true, render: (row) => `$${row.price.toFixed(2)}` },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

const sampleOptions = [
  { id: '1', primary: 'Option 1', secondary: 'Details about option 1' },
  { id: '2', primary: 'Option 2', secondary: 'Details about option 2' },
  { id: '3', primary: 'Option 3', secondary: 'Details about option 3' },
];

export function UiKitShowcase() {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isConfirmReasonOpen, setConfirmReasonOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSlideOverOpen, setSlideOverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState<string>();

  return (
    <div className="p-6 space-y-12">
      <PageHeader 
        title="UI Kit Showcase" 
        subtitle="A collection of shared UI components for the RM Workflow System"
        breadcrumbs={<span>Dev / UI Kit</span>}
        actionSlot={<button className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-secondary">Action Button</button>}
      />

      <section>
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Status Badges</h2>
        <div className="flex flex-wrap gap-4">
          <StatusBadge status="ISSUED" />
          <StatusBadge status="DRAFT" />
          <StatusBadge status="STORES_PENDING" />
          <StatusBadge status="REJECTED" />
          <StatusBadge status="PARTIALLY_RETURNED" />
          <StatusBadge status="UNKNOWN_STATUS" />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Data Table</h2>
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium mb-2">Populated & Searchable</h3>
            <DataTable 
              data={sampleData} 
              columns={sampleColumns} 
              searchable 
              pagination 
              defaultPageSize={2}
            />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Loading State</h3>
            <DataTable data={[]} columns={sampleColumns} isLoading />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Empty State</h3>
            <DataTable data={[]} columns={sampleColumns} />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Error State</h3>
            <DataTable data={[]} columns={sampleColumns} isError errorMsg="Failed to load widgets" onRetry={() => alert('retrying')} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Empty, Error, and Loading States</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border rounded p-4">
            <EmptyState />
          </div>
          <div className="border rounded p-4">
            <ErrorState message="Something went wrong" />
          </div>
          <div className="border rounded p-4 space-y-4">
            <LoadingState />
            <SkeletonBlock className="h-8 w-full" />
            <SkeletonBlock className="h-4 w-3/4" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Modals & Dialogs</h2>
        <div className="flex gap-4">
          <button onClick={() => setConfirmOpen(true)} className="px-4 py-2 border rounded shadow-sm bg-white hover:bg-gray-50 text-sm font-medium">
            Basic Confirm
          </button>
          <button onClick={() => setConfirmReasonOpen(true)} className="px-4 py-2 border border-red-300 text-red-700 rounded shadow-sm bg-red-50 hover:bg-red-100 text-sm font-medium">
            Danger Confirm (with reason)
          </button>
          <button onClick={() => setModalOpen(true)} className="px-4 py-2 border rounded shadow-sm bg-white hover:bg-gray-50 text-sm font-medium">
            Open Modal
          </button>
          <button onClick={() => setSlideOverOpen(true)} className="px-4 py-2 border rounded shadow-sm bg-white hover:bg-gray-50 text-sm font-medium">
            Open SlideOver
          </button>
        </div>

        <ConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Approve Request"
          message="Are you sure you want to approve this request?"
        />

        <ConfirmDialog
          isOpen={isConfirmReasonOpen}
          onClose={() => setConfirmReasonOpen(false)}
          onConfirm={(reason) => {
            alert(`Rejected with reason: ${reason}`);
            setConfirmReasonOpen(false);
          }}
          title="Reject Request"
          message="This action cannot be undone. Please provide a reason."
          isDanger
          requireReason
        />

        <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Sample Modal">
          <p className="text-gray-600 mb-4">This is a sample modal with focus trap enabled.</p>
          <TextInput placeholder="Focus should cycle here..." />
        </Modal>

        <SlideOver isOpen={isSlideOverOpen} onClose={() => setSlideOverOpen(false)} title="Sample SlideOver">
          <p className="text-gray-600 mb-4">This is a slideover pane, typically used for forms or details.</p>
          <TextInput placeholder="Try focusing me..." />
        </SlideOver>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Form Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Valid State</h3>
            <FormField label="Text Input" id="text-input" required>
              <TextInput id="text-input" placeholder="Enter text" />
            </FormField>
            
            <FormField label="Number Input" id="number-input">
              <NumberInput id="number-input" placeholder="0.00" unit="KG" />
            </FormField>

            <FormField label="Select" id="select-input">
              <Select id="select-input">
                <option>Option 1</option>
                <option>Option 2</option>
              </Select>
            </FormField>

            <FormField label="Search Select (Combobox)" id="search-select">
              <SearchSelect 
                options={sampleOptions}
                value={searchValue}
                onChange={setSearchValue}
                placeholder="Search..."
              />
            </FormField>

            <FormField label="Textarea" id="textarea-input" hint="Brief description.">
              <Textarea id="textarea-input" placeholder="Type here..." />
            </FormField>

            <FormField label="Date" id="date-input">
              <DateInput id="date-input" />
            </FormField>

            <Checkbox id="checkbox-input" label="I agree to the terms" description="This is a supplementary description." />
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Error State</h3>
            <FormField label="Text Input" id="text-input-err" error="This field is required.">
              <TextInput id="text-input-err" error />
            </FormField>
            
            <FormField label="Number Input" id="number-input-err" error="Must be > 0.">
              <NumberInput id="number-input-err" unit="KG" error />
            </FormField>

            <FormField label="Select" id="select-input-err" error="Please select an option.">
              <Select id="select-input-err" error>
                <option>Option 1</option>
                <option>Option 2</option>
              </Select>
            </FormField>

            <FormField label="Search Select" id="search-select-err" error="Required.">
              <SearchSelect 
                options={sampleOptions}
                onChange={() => {}}
                placeholder="Search..."
                error
              />
            </FormField>

            <FormField label="Textarea" id="textarea-input-err" error="Too short.">
              <Textarea id="textarea-input-err" error />
            </FormField>
            
            <FormField label="Date" id="date-input-err" error="Invalid date.">
              <DateInput id="date-input-err" error />
            </FormField>

            <Checkbox id="checkbox-input-err" label="I agree to the terms" error />
          </div>
        </div>
      </section>
    </div>
  );
}
