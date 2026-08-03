import { getCategoryInfo, formatMoney } from './financeCategories';

/**
 * DonutChart — pure SVG donut for category breakdown.
 */
export const DonutChart = ({ data = [], currency = '₹', size = 220, thickness = 30 }) => {
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = data.reduce((acc, d) => {
    const fraction = total > 0 ? (d.value || 0) / total : 0;
    const dash = fraction * circumference;
    const offset = acc.reduce((s, seg) => s + seg.dash, 0);
    acc.push({ ...d, dash, offset });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            className="stroke-gray-100 dark:stroke-gray-800"
          />
          {segments.map((seg, idx) => (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="butt"
              className="transition-all duration-700"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(total, currency)}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</span>
        </div>
      </div>

      <div className="mt-4 w-full space-y-1.5">
        {segments.length === 0 && (
          <p className="text-center text-sm text-gray-500">No expenses recorded yet.</p>
        )}
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: seg.color }} />
              {seg.label}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatMoney(seg.value, currency)}
              {total > 0 && (
                <span className="ml-1 text-xs text-gray-400">({Math.round((seg.value / total) * 100)}%)</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * BarChart — pure CSS bar chart for monthly trend.
 */
export const MonthlyBarChart = ({ data = [], currency = '₹', height = 160 }) => {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500 w-full text-center">No collection data yet.</p>
        ) : (
          data.map((d, idx) => {
            const h = max > 0 ? Math.max((d.value / max) * (height - 30), 4) : 4;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatMoney(d.value, currency)}
                </span>
                <div
                  className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-primary/70 to-primary transition-all duration-700 group-hover:from-primary group-hover:to-cyan-400"
                  style={{ height: h }}
                />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{d.label}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/**
 * CategoryBreakdownList — simple horizontal progress rows per category.
 */
export const CategoryBreakdownList = ({ breakdown = {}, currency = '₹', total = 0 }) => {
  const rows = Object.entries(breakdown)
    .map(([key, val]) => ({
      key,
      label: getCategoryInfo(key).label,
      color: getCategoryInfo(key).color,
      value: typeof val === 'number' ? val : val?.total || 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No expense breakdown yet.</p>
      )}
      {rows.map((row) => {
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        return (
          <div key={row.key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                {row.label}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatMoney(row.value, currency)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: row.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DonutChart;

