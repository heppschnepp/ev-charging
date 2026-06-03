import { Heart, Clock, MapPin, Trash2 } from 'lucide-react';
import type { FavoriteStation, SearchHistoryEntry } from '@/types';
import { formatDistance } from '@/lib/utils';

interface Props {
  favorites: FavoriteStation[];
  history: SearchHistoryEntry[];
  onRemoveFavorite: (id: number) => void;
  onSelectHistory: (entry: SearchHistoryEntry) => void;
  onClearFavorites?: () => void;
  onClearHistory?: () => void;
}

export function Sidebar({ favorites, history, onRemoveFavorite, onSelectHistory, onClearFavorites, onClearHistory }: Props) {
  return (
    <div className="space-y-6">
      {/* Favourites */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Heart size={15} className="text-red-400" />
          <h2 className="text-sm font-semibold text-gray-700">Favourites</h2>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {favorites.length}
            </span>
            {favorites.length > 0 && onClearFavorites && (
              <button
                onClick={onClearFavorites}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap"
                title="Clear all favourites"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        {favorites.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-1">No favourites yet. Tap the heart on any station.</p>
        ) : (
          <div className="space-y-2">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="flex items-start gap-2 bg-white rounded-xl border border-gray-200 p-3 group"
              >
                <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Heart size={13} className="text-red-400" fill="currentColor" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{fav.station_name}</p>
                  {fav.address && (
                    <p className="text-xs text-gray-400 truncate">{fav.address}</p>
                  )}
                </div>
                <button
                  onClick={() => onRemoveFavorite(fav.station_id)}
                  className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

       {/* Search history */}
       <div>
         <div className="flex items-center gap-2 mb-3">
           <Clock size={15} className="text-gray-400" />
           <h2 className="text-sm font-semibold text-gray-700">Recent searches</h2>
           <div className="ml-auto flex items-center gap-2">
             {history.length > 0 && onClearHistory && (
               <button
                 onClick={onClearHistory}
                 className="text-xs text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap"
                 title="Clear all recent searches"
               >
                 Clear all
               </button>
             )}
           </div>
         </div>
        {history.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-1">No recent searches.</p>
        ) : (
          <div className="space-y-1.5">
             {history.slice(0, 8).map((h, i) => (
               <button
                 key={i}
                 onClick={() => onSelectHistory(h)}
                 className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 text-left transition-colors group"
               >
                 <MapPin size={13} className="text-gray-400 shrink-0" />
                 <div className="flex-1 min-w-0">
                   <p className="text-xs font-medium text-gray-700 truncate">{h.city}</p>
                   <p className="text-xs text-gray-400">{h.results} stations · {h.distance} km</p>
                 </div>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
