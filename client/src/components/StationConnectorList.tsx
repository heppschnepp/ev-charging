import type { ChargingStation } from '@/types';
import { cn, getConnectorBadgeColor, formatPower } from '@/lib/utils';

export function StationConnectorList({ station }: { station: ChargingStation }) {
  return (
    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Capacity · technology
      </p>
      {station.connections.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No connector data</p>
      ) : (
        station.connections.map((c, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate',
                getConnectorBadgeColor(c.connectionType?.title ?? ''),
              )}
            >
              {c.connectionType?.title ?? 'Unknown'}
            </span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 shrink-0">
              {formatPower(c.powerKW)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}