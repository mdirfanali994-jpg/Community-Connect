import { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';


const NotificationBell = ({
  targetRoleLabel = 'Admin',
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onOpenChange
}) => {
  const [open, setOpen] = useState(false);

  const newestFirst = useMemo(() => {
    return [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [notifications]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  };

  const handleMarkAll = async () => {
    await onMarkAllRead?.();
  };

  const handleMarkOne = async (id) => {
    await onMarkRead?.(id);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label={`Notifications for ${targetRoleLabel}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center border border-white/40">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] sm:w-[420px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-[100] overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{unreadCount} unread</div>
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          {newestFirst.length === 0 ? (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300">No notifications yet.</div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {newestFirst.map((n) => {
                const createdAt = n.createdAt ? new Date(n.createdAt) : null;
                const displayTime = createdAt ? createdAt.toLocaleString() : '';

                return (
                  <div
                    key={n._id || n.id}
                    className={`px-4 py-3 border-b border-gray-100 dark:border-gray-800/60 transition-colors ${
                      n.read ? 'bg-transparent' : 'bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.read ? (
                            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                          )}
                          <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {n.residentName || 'Resident'} • Flat {n.flatNumber || '-'}
                          </div>
                        </div>

                        <div className="mt-1 text-sm text-gray-700 dark:text-gray-200 font-medium truncate" title={n.complaintText || n.message}>
                          {n.complaintText || n.message || 'Complaint'}
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            {n.complaintStatus || n.status || 'Submitted'}
                          </span>
                          <span>•</span>
                          <span>{displayTime}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => handleMarkOne(n._id || n.id)}
                            className="text-xs px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                          >
                            Mark as read
                          </button>
                        )}
                        {n.read && (
                          <span className="text-[10px] font-semibold text-gray-400">Read</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenChange?.(false);
              }}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

