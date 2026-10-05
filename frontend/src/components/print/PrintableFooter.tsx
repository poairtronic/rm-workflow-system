export function PrintableFooter() {
  return (
    <div className="mt-8 break-inside-avoid">
      {/* Legal Boilerplate */}
      <div className="mb-8 border border-black p-3 text-[10px] text-black">
        <h4 className="font-bold uppercase mb-1">Terms & Conditions:</h4>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Goods once dispatched are at the risk of the carrier.</li>
          <li>Discrepancies, if any, must be reported within 24 hours of receipt.</li>
          <li>For returnable challans, materials must be returned within the stipulated SLA timeframe.</li>
          <li>This is a computer-generated document and is valid for physical transit when signed by an authorized signatory.</li>
        </ol>
      </div>

      {/* Signature Blocks */}
      <div className="flex justify-between items-end mt-16 px-4">
        <div className="text-center w-48">
          <div className="border-b border-black mb-1"></div>
          <p className="text-[10px] font-bold uppercase text-black">Prepared By</p>
          <p className="text-[9px] text-black">(Storekeeper)</p>
        </div>

        <div className="text-center w-48">
          <div className="border-b border-black mb-1"></div>
          <p className="text-[10px] font-bold uppercase text-black">Authorized Signatory</p>
          <p className="text-[9px] text-black">(Manager)</p>
        </div>

        <div className="text-center w-48">
          <div className="border-b border-black mb-1"></div>
          <p className="text-[10px] font-bold uppercase text-black">Receiver's Signature</p>
          <p className="text-[9px] text-black">(& Company Seal)</p>
        </div>
      </div>
    </div>
  );
}
