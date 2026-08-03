import { X, Printer, CheckCircle } from 'lucide-react';
import { formatMoney, formatDate, getMonthLabel, PAYMENT_METHOD_LABEL } from './financeCategories';

/**
 * ReceiptView — printable HTML receipt modal.
 */
const ReceiptView = ({ open, onClose, receipt = null, currency = '₹' }) => {
  if (!open || !receipt) return null;

  const { bill, payment, community, resident, generatedAt } = receipt;
  const cur = currency || community?.currency || '₹';

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=700,height=800');
    if (!w) {
      alert('Please allow pop-ups to print the receipt.');
      return;
    }
    const rows = [
      ['Receipt Number', bill?.receiptNumber || '—'],
      ['Billing Month', getMonthLabel(bill?.month)],
      ['Resident', resident?.name || bill?.residentName],
      ['Flat', `${resident?.block ? `Block ${resident.block} · ` : ''}${resident?.flatNumber || bill?.flatNumber}`],
      ['Amount', formatMoney(bill?.totalDue ?? bill?.amount, cur)],
      ['Payment Method', PAYMENT_METHOD_LABEL[payment?.paymentMethod] || payment?.paymentMethod || '—'],
      ['Reference', payment?.referenceNumber || '—'],
      ['Paid On', formatDate(payment?.createdAt || bill?.paidAt)],
      ['Generated', formatDate(generatedAt)],
    ];

    w.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Maintenance Receipt</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 40px; }
  .receipt { max-width: 480px; margin: auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-top: 6px solid #06b6d4; }
  .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }
  .logo { width: 52px; height: 52px; border-radius: 12px; background: #06b6d4; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; margin-bottom: 10px; }
  h1 { font-size: 20px; color: #111827; margin: 4px 0; }
  .sub { color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 10px 6px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
  td:first-child { color: #6b7280; width: 40%; }
  td:last-child { color: #111827; font-weight: 600; text-align: right; }
  .amount { font-size: 26px; font-weight: 800; color: #06b6d4; text-align: center; padding: 12px 0; }
  .paid-badge { display: inline-block; background: #d1fae5; color: #059669; padding: 6px 16px; border-radius: 999px; font-weight: 700; font-size: 13px; }
  .footer { text-align: center; color: #9ca3af; font-size: 11px; margin-top: 20px; border-top: 1px solid #f3f4f6; padding-top: 14px; }
  .actions { text-align: center; margin-top: 24px; }
  @media print { body { background: #fff; padding: 0; } .receipt { box-shadow: none; border-radius: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">CC</div>
      <h1>${community?.name || 'Community Connect'}</h1>
      <div class="sub">${community?.address || ''} ${community?.city ? `, ${community.city}` : ''} ${community?.state ? `, ${community.state}` : ''}</div>
      <div class="sub">Maintenance Payment Receipt</div>
    </div>
    <div class="paid-badge"><span>✓</span> PAID</div>
    <div class="amount">${formatMoney(bill?.totalDue ?? bill?.amount, cur)}</div>
    <table>
      ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
    </table>
    <div class="footer">This is a computer-generated receipt and does not require a physical signature.<br/>Community Connect · Smart Society Management</div>
    <div class="actions no-print">
      <button onclick="window.print()" style="background:#06b6d4;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Print Receipt</button>
      <button onclick="window.close()" style="background:#f3f4f6;color:#374151;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-left:8px;">Close</button>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            Payment Receipt
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-200 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-5">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {community?.name || 'Community Connect'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {community?.address || ''} {community?.city || ''} {community?.state || ''}
            </div>
            <span className="inline-block mt-3 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full text-xs font-bold">
              ✓ PAID
            </span>
            <div className="text-3xl font-extrabold text-primary mt-3">
              {formatMoney(bill?.totalDue ?? bill?.amount, cur)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-950/50 rounded-2xl p-4 space-y-2 text-sm">
            {[
              ['Receipt No.', bill?.receiptNumber || '—'],
              ['Month', getMonthLabel(bill?.month)],
              ['Resident', resident?.name || bill?.residentName],
              ['Flat', `${resident?.block ? `Block ${resident.block} · ` : ''}${resident?.flatNumber || bill?.flatNumber}`],
              ['Method', PAYMENT_METHOD_LABEL[payment?.paymentMethod] || payment?.paymentMethod || '—'],
              ['Reference', payment?.referenceNumber || '—'],
              ['Paid On', formatDate(payment?.createdAt || bill?.paidAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{k}</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right">{v}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-4">
            This is a computer-generated receipt and does not require a physical signature.
          </p>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print / Download
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptView;

