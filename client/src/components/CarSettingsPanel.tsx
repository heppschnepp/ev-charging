import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, ChevronDown, Plus, Check, Search, Trash2, Zap, Settings, Pencil, CheckCircle, Monitor, Sun, Moon } from 'lucide-react';
import { api } from '@/lib/api';
import { useCars } from '@/hooks/useCars';
import { useTheme, type ThemePreference } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { CarSearchResult } from '@/types';

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: typeof Monitor }[] = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

interface EditDraft {
  brand: string;
  model: string;
  variantName: string;
  modelYear: string;
  rangeKm: string;
  chargeTime10to80Min: string;
  chargeTime10to100Min: string;
}

export function CarSettingsPanel() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const {
    cars, addCar, isAdding, addError, isDuplicate, resetAddError, updateCar, isUpdating, removeCar,
  } = useCars();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualBrand, setManualBrand] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualRange, setManualRange] = useState('');
  const [manualCt80, setManualCt80] = useState('');
  const [manualCt100, setManualCt100] = useState('');
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    brand: '',
    model: '',
    variantName: '',
    modelYear: '',
    rangeKm: '',
    chargeTime10to80Min: '',
    chargeTime10to100Min: '',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!addedMsg) return;
    const t = setTimeout(() => setAddedMsg(null), 2000);
    return () => clearTimeout(t);
  }, [addedMsg]);

  const search = useQuery({
    queryKey: ['car-search', debouncedQuery],
    queryFn: () => api.cars.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60,
  });

  const addedExternalIds = new Set(cars.filter((c) => c.external_id !== null).map((c) => c.external_id));

  const handleAddFromSearch = (r: CarSearchResult) => {
    resetAddError();
    addCar({
      externalId: r.externalId,
      brand: r.brand,
      model: r.model,
      variantName: r.variantName ?? undefined,
      modelYear: r.modelYear ?? undefined,
      rangeKm: r.rangeKm as number,
    }).then(() => {
      setQuery('');
      setShowManual(false);
      setAddedMsg(`Added ${r.brand} ${r.model}`);
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const range = Number(manualRange);
    if (!manualBrand.trim() || !manualModel.trim() || !Number.isFinite(range) || range < 1) return;
    resetAddError();
    const ct80 = manualCt80.trim() ? Math.round(Number(manualCt80)) : undefined;
    const ct100 = manualCt100.trim() ? Math.round(Number(manualCt100)) : undefined;
    addCar({
      brand: manualBrand.trim(),
      model: manualModel.trim(),
      rangeKm: Math.round(range),
      chargeTime10to80Min: Number.isFinite(ct80) && ct80! > 0 ? ct80 : undefined,
      chargeTime10to100Min: Number.isFinite(ct100) && ct100! > 0 ? ct100 : undefined,
    }).then(() => {
      setManualBrand('');
      setManualModel('');
      setManualRange('');
      setManualCt80('');
      setManualCt100('');
      setShowManual(false);
      setAddedMsg(`Added ${manualBrand.trim()} ${manualModel.trim()}`);
    });
  };

  const startEdit = (id: number) => {
    const c = cars.find((x) => x.id === id);
    if (!c) return;
    setEditDraft({
      brand: c.brand,
      model: c.model,
      variantName: c.variant_name ?? '',
      modelYear: c.model_year == null ? '' : String(c.model_year),
      rangeKm: String(c.range_km),
      chargeTime10to80Min: c.charge_time_10_80_min == null ? '' : String(c.charge_time_10_80_min),
      chargeTime10to100Min: c.charge_time_10_100_min == null ? '' : String(c.charge_time_10_100_min),
    });
    setEditingId(id);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const brand = editDraft.brand.trim();
    const model = editDraft.model.trim();
    const range = Number(editDraft.rangeKm);
    if (!brand || !model || !Number.isFinite(range) || range < 1) return;
    const toIntOrNull = (v: string): number | null => {
      const n = Number(v);
      return v.trim() === '' || !Number.isFinite(n) || n < 1 ? null : Math.round(n);
    };
    await updateCar({
      id: editingId,
      body: {
        brand,
        model,
        variantName: editDraft.variantName.trim() || null,
        modelYear: toIntOrNull(editDraft.modelYear),
        rangeKm: Math.round(range),
        chargeTime10to80Min: toIntOrNull(editDraft.chargeTime10to80Min),
        chargeTime10to100Min: toIntOrNull(editDraft.chargeTime10to100Min),
      },
    });
    setEditingId(null);
    setAddedMsg('Car updated');
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-ev-50 dark:bg-ev-900/30 flex items-center justify-center shrink-0">
          <Settings size={14} className="text-ev-600 dark:text-ev-400" />
        </div>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">Settings</span>
        <ChevronDown
          size={15}
          className={cn('text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Appearance
            </p>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                    theme === id
                      ? 'bg-white dark:bg-gray-900 text-ev-700 dark:text-ev-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
                  )}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Electric cars
          </p>
          {addedMsg && (
            <p className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <Check size={12} /> {addedMsg}
            </p>
          )}

          {/* Search */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search brand or model…"
                className="w-full outline-none bg-transparent text-sm placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-500"
              />
            </div>

            {debouncedQuery.length >= 2 && search.isFetching && (
              <p className="text-xs text-gray-400 dark:text-gray-500 animate-pulse px-1">Searching…</p>
            )}

            {debouncedQuery.length >= 2 && !search.isFetching && search.data?.results.length === 0 && (
              <div className="px-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">No cars found in the catalogue.</p>
                <button
                  type="button"
                  onClick={() => setShowManual(true)}
                  className="flex items-center gap-1 text-xs font-medium text-ev-600 dark:text-ev-400 hover:underline mt-1"
                >
                  <Plus size={12} /> Add manually
                </button>
              </div>
            )}

            {debouncedQuery.length >= 2 && !search.isFetching && search.data && search.data.results.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
                {search.data.results.map((r) => {
                  const alreadyAdded = addedExternalIds.has(r.externalId);
                  const missingRange = r.rangeKm == null;
                  return (
                    <div key={r.externalId} className="flex items-center gap-2 px-2.5 py-2">
                      <Car size={14} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {r.brand} {r.model}
                          {r.variantName ? ` · ${r.variantName}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {r.modelYear ?? '–'} · {missingRange ? 'range n/a' : `${r.rangeKm} km WLTP`}
                        </p>
                      </div>
                      {alreadyAdded ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                          <Check size={12} /> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isAdding || missingRange}
                          onClick={() => handleAddFromSearch(r)}
                          className={cn(
                            'flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-md shrink-0',
                            missingRange
                              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              : 'text-ev-700 hover:bg-ev-50 dark:text-ev-400 dark:hover:bg-ev-900/30',
                          )}
                        >
                          <Plus size={12} /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual add */}
          {showManual && (
            <form onSubmit={handleManualSubmit} className="space-y-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-2.5">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Add car manually</p>
              <input
                type="text"
                value={manualBrand}
                onChange={(e) => setManualBrand(e.target.value)}
                placeholder="Brand (e.g. Tesla)"
                className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-500"
              />
              <input
                type="text"
                value={manualModel}
                onChange={(e) => setManualModel(e.target.value)}
                placeholder="Model (e.g. Model 3)"
                className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-500"
              />
              <input
                type="number"
                min={1}
                value={manualRange}
                onChange={(e) => setManualRange(e.target.value)}
                placeholder="Range in km"
                className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  value={manualCt80}
                  onChange={(e) => setManualCt80(e.target.value)}
                  placeholder="10→80% (min)"
                  title="Optional: minutes to charge 10% → 80%"
                  className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-500"
                />
                <input
                  type="number"
                  min={1}
                  value={manualCt100}
                  onChange={(e) => setManualCt100(e.target.value)}
                  placeholder="10→100% (min)"
                  title="Optional: minutes to charge 10% → 100%"
                  className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>
              <button
                type="submit"
                disabled={isAdding}
                className="w-full flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md bg-ev-600 text-white hover:bg-ev-700 disabled:opacity-50"
              >
                <Plus size={12} /> Add to inventory
              </button>
            </form>
          )}

          {addError && (
            <p className={cn('text-xs px-1', isDuplicate ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
              {isDuplicate ? 'This car is already in your inventory.' : addError.message}
            </p>
          )}

          {/* Inventory */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">My cars ({cars.length})</p>
            {cars.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic px-1">
                No cars yet. Search above or add one manually.
              </p>
            ) : (
              <div className="space-y-1.5">
                {cars.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-2 group">
                      <div className="w-7 h-7 rounded-lg bg-ev-50 dark:bg-ev-900/30 flex items-center justify-center shrink-0">
                        <Car size={13} className="text-ev-600 dark:text-ev-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {c.brand} {c.model}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                          <Zap size={10} /> {c.range_km} km · {c.variant_name ?? c.model_year ?? 'manual'}
                        </p>
                        <p className="text-[10px] text-gray-300 dark:text-gray-600">
                          {c.charge_time_10_80_min == null
                            ? 'charge times: n/a'
                            : `charge: 10→80% ${c.charge_time_10_80_min} min · 10→100% ${c.charge_time_10_100_min ?? 'n/a'} min`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(c.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-ev-600 dark:hover:text-ev-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                        title="Edit"
                        aria-label="Edit car"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCar(c.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                        title="Remove"
                        aria-label="Remove car"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {editingId === c.id && (
                      <div className="mt-1.5 border border-ev-200 dark:border-ev-800 rounded-lg p-2 space-y-1.5 bg-white dark:bg-gray-900">
                        <p className="text-[11px] font-medium text-ev-700 dark:text-ev-400">Edit {c.brand} {c.model}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Brand</span>
                            <input
                              type="text" value={editDraft.brand}
                              onChange={(e) => setEditDraft((d) => ({ ...d, brand: e.target.value }))}
                              className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm dark:text-gray-200"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Model</span>
                            <input
                              type="text" value={editDraft.model}
                              onChange={(e) => setEditDraft((d) => ({ ...d, model: e.target.value }))}
                              className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm dark:text-gray-200"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Variant (empty = none)</span>
                            <input
                              type="text" value={editDraft.variantName}
                              onChange={(e) => setEditDraft((d) => ({ ...d, variantName: e.target.value }))}
                              placeholder="e.g. Long Range AWD"
                              className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm dark:text-gray-200"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Model year (empty = none)</span>
                            <input
                              type="number" min={1990} max={2100}
                              value={editDraft.modelYear}
                              onChange={(e) => setEditDraft((d) => ({ ...d, modelYear: e.target.value }))}
                              className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm dark:text-gray-200"
                            />
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">Range (km)</span>
                          <input
                            type="number" min={1} value={editDraft.rangeKm}
                            onChange={(e) => setEditDraft((d) => ({ ...d, rangeKm: e.target.value }))}
                            className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm dark:text-gray-200"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">10→80% (min)</span>
                            <input
                              type="number" min={1} value={editDraft.chargeTime10to80Min}
                              onChange={(e) => setEditDraft((d) => ({ ...d, chargeTime10to80Min: e.target.value }))}
                              placeholder="empty = estimate"
                              className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm dark:text-gray-200"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">10→100% (min)</span>
                            <input
                              type="number" min={1} value={editDraft.chargeTime10to100Min}
                              onChange={(e) => setEditDraft((d) => ({ ...d, chargeTime10to100Min: e.target.value }))}
                              placeholder="empty = estimate"
                              className="w-full outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm dark:text-gray-200"
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={saveEdit}
                            className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md bg-ev-600 text-white hover:bg-ev-700 disabled:opacity-50"
                          >
                            <CheckCircle size={12} /> {isUpdating ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500">EV data: EVDB (CC BY-SA 4.0)</p>
        </div>
      )}
    </div>
  );
}