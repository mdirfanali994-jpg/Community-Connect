import { useState } from 'react';
import {
  X, User, Phone, Home, MapPin, Clock, Calendar,
  Car, FileText, CheckCircle, XCircle, LogOut,
  Shield, AlertTriangle, Info, QrCode
} from 'lucide-react';
import { VISITOR_TYPES } from './visitorConstants';

const ScanConfirmModal = ({
  visitor,
  action,
  message,
  loading,
  onAllowEntry,
  onRejectEntry,
  onMarkExit,
  onClose,
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!visitor) return null;

  const visitorTypeLabel = VISITOR_TYPES.find(t => t.key === visitor.visitorType)?.label || visitor.visitorType || 'Unknown';
  const isEntry = action === 'entry';
  const isExit = action === 'exit';
  const isEmergency = action === 'entered_emergency';

  const formatDate = (d) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  const formatTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
  };

  const getStatusBadge = (status) => {
    const colors = {
      scheduled: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      arrived: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      entered: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
      exited: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
      cancelled: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
      rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    };
    const cls = colors[status] || 'bg-gray-50 text-gray-600';
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl my-4">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950/50">
          <div className="flex items-center gap-2">
            {isExit ? (
              <LogOut className="w-5 h-5 text-amber-500" />
            ) : isEmergency ? (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <QrCode className="w-5 h-5 text-green-500" />
            )}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {isExit ? 'Mark Exit' : isEmergency ? 'Emergency Entry' : 'Visitor Details'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`px-4 py-3 text-sm font-medium border-b ${
            isExit
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              : isEmergency
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center gap-2">
              {isExit ? <Info className="w-4 h-4" /> : isEmergency ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {message}
            </div>
          </div>
        )}

        {/* Visitor Details */}
        <div className="p-6 space-y-5">
          {/* Name & Status */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{visitor.visitorName}</h2>
                  <p className="text-xs text-gray-500 font-mono">ID: {visitor.visitorId}</p>
                </div>
              </div>
            </div>
            {getStatusBadge(visitor.status)}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Phone className="w-3 h-3 mr-1" />
                Phone
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{visitor.phoneNumber}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <MapPin className="w-3 h-3 mr-1" />
                Visitor Type
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{visitorTypeLabel}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Home className="w-3 h-3 mr-1" />
                Flat
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{visitor.block} - {visitor.flatNumber}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <User className="w-3 h-3 mr-1" />
                Resident
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{visitor.residentName}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Calendar className="w-3 h-3 mr-1" />
                Expected Date
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(visitor.expectedDate)}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Clock className="w-3 h-3 mr-1" />
                Expected Time
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{visitor.expectedTime || 'N/A'}</p>
            </div>
            {visitor.vehicleNumber && (
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center text-xs text-gray-500 mb-1">
                  <Car className="w-3 h-3 mr-1" />
                  Vehicle
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{visitor.vehicleNumber}</p>
              </div>
            )}
            {visitor.purpose && (
              <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center text-xs text-gray-500 mb-1">
                  <FileText className="w-3 h-3 mr-1" />
                  Purpose
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{visitor.purpose}</p>
              </div>
            )}
          </div>

          {/* OTP */}
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-xs text-primary/70">
                <Shield className="w-3 h-3 mr-1" />
                Visitor OTP
              </div>
              <span className="font-mono font-bold text-lg text-primary tracking-widest">{visitor.otp}</span>
            </div>
          </div>

          {/* Notes */}
          {visitor.notes && (
            <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <FileText className="w-3 h-3 mr-1" />
                Notes
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{visitor.notes}</p>
            </div>
          )}

          {/* Entry/Exit times for exit flow */}
          {isExit && visitor.enteredAt && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center text-xs text-blue-500 mb-1">
                <Clock className="w-3 h-3 mr-1" />
                Entry Time
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {formatDate(visitor.enteredAt)} at {formatTime(visitor.enteredAt)}
              </p>
              {visitor.securityVerifiedBy && (
                <p className="text-xs text-blue-500 mt-0.5">Verified by: {visitor.securityVerifiedBy}</p>
              )}
            </div>
          )}

          {/* Reject Reason Form */}
          {showRejectForm && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                className="w-full bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Optional: reason for rejection..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onRejectEntry(rejectReason)}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 space-y-2">
          {isEntry && !showRejectForm && (
            <div className="flex gap-3">
              <button
                onClick={onAllowEntry}
                disabled={loading}
                className="flex-1 flex items-center justify-center py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Allow Entry
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                className="flex-1 flex items-center justify-center py-3 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </button>
            </div>
          )}

          {isExit && !showRejectForm && (
            <div className="flex gap-3">
              <button
                onClick={onMarkExit}
                disabled={loading}
                className="flex-1 flex items-center justify-center py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Mark Exit
              </button>
              <button
                onClick={onClose}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          {isEmergency && !showRejectForm && (
            <div className="text-center">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-3">
                Entry granted automatically under emergency override
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-all"
              >
                Close
              </button>
            </div>
          )}

          {/* Already processed — no action buttons, just close */}
          {!isEntry && !isExit && !isEmergency && !showRejectForm && (
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanConfirmModal;
