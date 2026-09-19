import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  BatteryCharging,
  Car as CarIcon,
  Zap,
  Clock,
  Route,
  AlertTriangle,
  ChevronDown,
  Plug,
  Building2,
} from 'lucide-react';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import { StationCardSummary } from '@/components/StationCardSummary';
import { StationConnectorList } from '@/components/StationConnectorList';
import { FullscreenMap, MapResizeOnFullscreen } from '@/components/FullscreenMap';
import { useCars } from '@/hooks/useCars';
import { api } from '@/lib/api';
import {
  geocodeCity,
  fetchRoute,
  formatRouteDuration,
  formatRouteDistance,
} from '@/utils/routingUtils';
import {
  computeChargePlan,
  anchorPlanToStations,
  pointAtDistance,
  availableConnectors,
  rankStations,
  DEFAULT_CHARGE_10_80_MIN,
  type ChargeStop,
  type ChargePlanResult,
  type AnchoredPlanResult,
} from '@/utils/chargePlan';
import { getStationStatus, getTotalConnectors, formatDistance, cn } from '@/lib/utils';
import { useTheme, MAP_TILE_URLS, MAP_TILE_ATTRIBUTIONS } from '@/hooks/useTheme';
import type { GeoLocation, Car, ChargingStation } from '@/types';

/** The reserve levels we always compare: charge when SoC drops below each. */
const RESERVE_LEVELS = [20, 10] as const;
type ReserveLevel = (typeof RESERVE_LEVELS)[number];

function FitBounds({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.length) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}

const stopIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

const getStationIcon = (status: string, fast: boolean) => {
  let color = 'green';
  if (!status || status !== 'operational') color = 'red';
  else if (fast) color = 'orange';

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
  });
};

function formatChargeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function CarSelector({
  cars,
  value,
  onChange,
}: {
  cars: Car[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Car{' '}
        <span className="text-gray-400 dark:text-gray-500 font-normal">
          (from Settings → Electric cars)
        </span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-ev-400"
      >
        {cars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.brand} {c.model} · {c.range_km} km · 10→80%{' '}
            {c.charge_time_10_80_min ?? DEFAULT_CHARGE_10_80_MIN} min
          </option>
        ))}
      </select>
    </div>
  );
}

export function ChargePlanView() {
  const { cars, isLoading } = useCars();
  const { resolvedTheme } = useTheme();

  const [carId, setCarId] = useState('');
  const [startSocPct, setStartSocPct] = useState(20);
  const [chargeTargetPct, setChargeTargetPct] = useState<80 | 100>(80);
  const [stationRadiusKm, setStationRadiusKm] = useState(10);
  const [preferredOperator, setPreferredOperator] = useState('');
  const [minPowerKw, setMinPowerKw] = useState('22');
  const [activeReserve, setActiveReserve] = useState<ReserveLevel>(20);

  const powerKw = Number(minPowerKw) > 0 ? Number(minPowerKw) : undefined;

  const [sourceCity, setSourceCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [sourceLoc, setSourceLoc] = useState<GeoLocation | null>(null);
  const [destLoc, setDestLoc] = useState<GeoLocation | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeSummary, setRouteSummary] = useState<{
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);

  const [scenarioPlans, setScenarioPlans] = useState<Record<ReserveLevel, ChargePlanResult | null>>(
    { 20: null, 10: null },
  );
  const [stopNearbyByLevel, setStopNearbyByLevel] = useState<
    Record<ReserveLevel, Record<number, ChargingStation[]>>
  >({ 20: {}, 10: {} });
  const [manualByLevel, setManualByLevel] = useState<Record<ReserveLevel, Record<number, number>>>({
    20: {},
    10: {},
  });
  const [stationLoadingByLevel, setStationLoadingByLevel] = useState<
    Record<ReserveLevel, Record<number, boolean>>
  >({ 20: {}, 10: {} });
  const [expandedStopsByLevel, setExpandedStopsByLevel] = useState<
    Record<ReserveLevel, Record<number, boolean>>
  >({ 20: {}, 10: {} });

  const abortRef = useRef<AbortController | null>(null);
  const stationAbortRef = useRef<AbortController | null>(null);
  const hasPlanRef = useRef(false);

  const selectedCar = cars.find((c) => c.id === Number(carId));

  useEffect(() => {
    if (!carId && cars.length > 0) setCarId(String(cars[0].id));
  }, [cars, carId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stationAbortRef.current?.abort();
    };
  }, []);

  const setManualFor = (level: ReserveLevel, stopIndex: number, stationId: number) => {
    setManualByLevel((prev) => ({ ...prev, [level]: { ...prev[level], [stopIndex]: stationId } }));
  };

  const toggleExpanded = (level: ReserveLevel, stopIndex: number) => {
    setExpandedStopsByLevel((prev) => ({
      ...prev,
      [level]: { ...prev[level], [stopIndex]: !prev[level][stopIndex] },
    }));
  };

  const loadStationsNearStops = async (
    level: ReserveLevel,
    coords: [number, number][],
    stopList: ChargeStop[],
    radiusKm: number,
    minPower: number | undefined,
    signal: AbortSignal,
  ) => {
    const loading: Record<number, boolean> = {};
    stopList.forEach((_, i) => {
      loading[i] = true;
    });
    setStationLoadingByLevel((prev) => ({ ...prev, [level]: { ...prev[level], ...loading } }));

    const results = await Promise.allSettled(
      stopList.map((s) => {
        const [lat, lon] = pointAtDistance(coords, s.distanceKm * 1000);
        return api.stations
          .search(undefined, lat, lon, radiusKm, 10, undefined, minPower, signal)
          .then((d) => d.stations);
      }),
    );

    const nearby: Record<number, ChargingStation[]> = {};
    const doneLoading: Record<number, boolean> = {};
    let aborted = false;

    results.forEach((res, i) => {
      doneLoading[i] = false;
      if (res.status === 'fulfilled') {
        nearby[i] = res.value;
      } else {
        if ((res.reason as Error)?.name === 'AbortError') {
          aborted = true;
          return;
        }
        console.warn('Station fetch failed for a stop:', res.reason);
        nearby[i] = [];
      }
    });

    if (aborted) return;

    // Keep only manual picks whose station still exists in the new result set
    setManualByLevel((prev) => {
      const pruned: Record<number, number> = {};
      for (const [k, stationId] of Object.entries(prev[level])) {
        const idx = Number(k);
        if (nearby[idx]?.some((st) => st.id === stationId)) pruned[idx] = stationId;
      }
      return { ...prev, [level]: pruned };
    });

    setStopNearbyByLevel((prev) => ({ ...prev, [level]: { ...prev[level], ...nearby } }));
    setStationLoadingByLevel((prev) => ({ ...prev, [level]: { ...prev[level], ...doneLoading } }));
  };

  const plan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCar) return;
    abortRef.current?.abort();
    stationAbortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setIsCalculating(true);
    setError(null);
    setRouteCoords(null);
    setRouteSummary(null);
    setScenarioPlans({ 20: null, 10: null });
    setStopNearbyByLevel({ 20: {}, 10: {} });
    setManualByLevel({ 20: {}, 10: {} });
    setStationLoadingByLevel({ 20: {}, 10: {} });
    setExpandedStopsByLevel({ 20: {}, 10: {} });
    setActiveReserve(20);
    hasPlanRef.current = false;

    try {
      const start = sourceLoc ?? (await geocodeCity(sourceCity, signal));
      const dest = destLoc ?? (await geocodeCity(destinationCity, signal));

      if (!start) throw new Error(`Could not find "${sourceCity}". Try a more specific name.`);
      if (!dest) throw new Error(`Could not find "${destinationCity}". Try a more specific name.`);

      const { coords, summary } = await fetchRoute(start, dest, signal);
      setRouteCoords(coords);
      setRouteSummary(summary);

      const computeFor = (level: ReserveLevel) =>
        computeChargePlan({
          totalDistanceKm: summary.distanceMeters / 1000,
          rangeKm: selectedCar.range_km,
          startSocPct,
          minSocPct: level,
          chargeTargetPct,
          chargeTime10To80Min: selectedCar.charge_time_10_80_min,
          chargeTime10To100Min: selectedCar.charge_time_10_100_min,
        });
      const plans: Record<ReserveLevel, ChargePlanResult> = {
        20: computeFor(20),
        10: computeFor(10),
      };
      setScenarioPlans(plans);
      hasPlanRef.current = true;

      await Promise.all(
        RESERVE_LEVELS.map((level) =>
          plans[level].stops.length > 0
            ? loadStationsNearStops(
                level,
                coords,
                plans[level].stops,
                stationRadiusKm,
                powerKw,
                signal,
              )
            : Promise.resolve(),
        ),
      );
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      if (abortRef.current === controller) setIsCalculating(false);
    }
  };

  // Re-fetch nearby stations when search radius or min power changes (after a plan exists)
  useEffect(() => {
    if (!hasPlanRef.current || !routeCoords) return;
    const withStops = RESERVE_LEVELS.filter(
      (level) => (scenarioPlans[level]?.stops.length ?? 0) > 0,
    );
    if (withStops.length === 0) return;
    stationAbortRef.current?.abort();
    const controller = new AbortController();
    stationAbortRef.current = controller;
    withStops.forEach((level) => {
      const base = scenarioPlans[level];
      if (base)
        loadStationsNearStops(
          level,
          routeCoords,
          base.stops,
          stationRadiusKm,
          powerKw,
          controller.signal,
        );
    });
  }, [stationRadiusKm, minPowerKw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Station-anchored plans: snap each scenario's stops to real chargers and recompute the legs
  const anchoredByLevel = useMemo<Record<ReserveLevel, AnchoredPlanResult | null>>(() => {
    const out: Record<ReserveLevel, AnchoredPlanResult | null> = { 20: null, 10: null };
    if (!routeCoords || !selectedCar || !routeSummary) return out;
    for (const level of RESERVE_LEVELS) {
      const base = scenarioPlans[level];
      if (!base || base.stops.length === 0) continue;
      out[level] = anchorPlanToStations({
        routeCoords,
        totalDistanceKm: routeSummary.distanceMeters / 1000,
        rangeKm: selectedCar.range_km,
        startSocPct,
        chargeTargetPct,
        baseStops: base.stops,
        baseArrivalSocPct: base.arrivalSocPct,
        stopsNearby: base.stops.map((_, i) => stopNearbyByLevel[level][i] ?? []),
        preferredOperator,
        forced: manualByLevel[level],
        chargeTime10To80Min: selectedCar.charge_time_10_80_min,
        chargeTime10To100Min: selectedCar.charge_time_10_100_min,
      });
    }
    return out;
  }, [
    routeCoords,
    scenarioPlans,
    stopNearbyByLevel,
    manualByLevel,
    preferredOperator,
    selectedCar,
    routeSummary,
    startSocPct,
    chargeTargetPct,
  ]);

  const activeBase = scenarioPlans[activeReserve];
  const activeAnchored = anchoredByLevel[activeReserve];
  const activeStopNearby = stopNearbyByLevel[activeReserve];
  const activeManual = manualByLevel[activeReserve];
  const activeStationLoading = stationLoadingByLevel[activeReserve];
  const activeExpandedStops = expandedStopsByLevel[activeReserve];

  const usesEstimates = scenarioPlans[20]?.usesEstimates ?? false;

  const displayArrival = activeAnchored
    ? activeAnchored.arrivalSocPct
    : (activeBase?.arrivalSocPct ?? null);
  const displayStops = activeAnchored
    ? activeAnchored.stops
    : (activeBase?.stops ?? []).map((s) => ({
        idealDistanceKm: s.distanceKm,
        routeDistanceKm: s.distanceKm,
        socOnArrivalPct: s.socOnArrivalPct,
        socOnDeparturePct: s.socOnDeparturePct,
        chargeMinutes: s.chargeMinutes,
        station: null,
        infeasible: false,
      }));

  // Stop markers: anchored to the chosen station when available, else route point
  const stopMarkers = useMemo(() => {
    if (!routeCoords) return [];
    const source = activeAnchored
      ? activeAnchored.stops.map((a, i) => ({ ...a, stopIndex: i }))
      : (activeBase?.stops ?? []).map((s, i) => ({
          idealDistanceKm: s.distanceKm,
          routeDistanceKm: s.distanceKm,
          socOnArrivalPct: s.socOnArrivalPct,
          socOnDeparturePct: s.socOnDeparturePct,
          chargeMinutes: s.chargeMinutes,
          station: null,
          infeasible: false,
          stopIndex: i,
        }));
    return source.map((mk) => ({
      ...mk,
      pos: mk.station
        ? ([mk.station.addressInfo.lat, mk.station.addressInfo.lon] as [number, number])
        : pointAtDistance(routeCoords, mk.routeDistanceKm * 1000),
    }));
  }, [activeAnchored, activeBase, routeCoords]);

  const scenarioTotals = (level: ReserveLevel) => {
    const anchoredPlan = anchoredByLevel[level];
    const base = scenarioPlans[level];
    return {
      chargeMinutes: anchoredPlan
        ? anchoredPlan.totalChargeMinutes
        : (base?.totalChargeMinutes ?? 0),
      stopsCount: (anchoredPlan ?? base)?.stops.length ?? 0,
      arrival: anchoredPlan ? anchoredPlan.arrivalSocPct : (base?.arrivalSocPct ?? null),
      infeasible: anchoredPlan?.infeasible ?? false,
    };
  };

  const anchoredStationFor = (stopIndex: number): ChargingStation | null | undefined =>
    activeAnchored?.stops[stopIndex]?.station;

  if (isLoading) {
    return <div className="text-sm text-gray-400 dark:text-gray-500">Loading car inventory…</div>;
  }

  if (cars.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center space-y-3">
        <BatteryCharging size={40} className="mx-auto text-gray-300 dark:text-gray-600" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          EV Charging Trip Planner
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          No cars in your inventory yet. Add an EV in{' '}
          <span className="font-medium">Settings → Electric cars</span> to plan charging stops for a
          trip.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <form
        onSubmit={plan}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BatteryCharging className="text-ev-600 dark:text-ev-400" size={20} /> EV Charging Trip
          Planner
        </h2>

        <CarSelector cars={cars} value={carId || ''} onChange={setCarId} />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
              <span>Start charge</span>
              <span className="text-ev-700 dark:text-ev-400 font-semibold">{startSocPct}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={startSocPct}
              onChange={(e) => setStartSocPct(Number(e.target.value))}
              className="w-full accent-ev-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Charge up to
            </label>
            <select
              value={chargeTargetPct}
              onChange={(e) => setChargeTargetPct(Number(e.target.value) as 80 | 100)}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
            >
              <option value={80}>80%</option>
              <option value={100}>100%</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
              <span>Stations within</span>
              <span className="text-ev-700 dark:text-ev-400 font-semibold">
                {stationRadiusKm} km
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={stationRadiusKm}
              onChange={(e) => setStationRadiusKm(Number(e.target.value))}
              className="w-full accent-ev-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
              <span>Min charging power</span>
              <span className="text-ev-700 dark:text-ev-400 font-semibold">
                {powerKw ? `≥ ${powerKw} kW` : 'any'}
              </span>
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={minPowerKw}
              onChange={(e) => setMinPowerKw(e.target.value)}
              placeholder="e.g. 22"
              title="Only keep nearby stations with a connection of at least this power. Empty = any."
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-ev-400"
            />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Preferred operator{' '}
              <span className="text-gray-400 dark:text-gray-500 font-normal">
                (optional — ranked, never blocks the trip)
              </span>
            </label>
            <input
              type="text"
              value={preferredOperator}
              onChange={(e) => setPreferredOperator(e.target.value)}
              placeholder="e.g. EnBW"
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-ev-400"
            />
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Every plan is compared for charging when below{' '}
          <span className="font-semibold text-gray-600 dark:text-gray-300">20%</span> and{' '}
          <span className="font-semibold text-gray-600 dark:text-gray-300">10%</span>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Source City
            </label>
            <CityAutocomplete
              value={sourceCity}
              onChange={setSourceCity}
              onSelect={(loc, label) => {
                setSourceCity(label);
                setSourceLoc(loc);
              }}
              placeholder="Enter source city"
              disabled={isCalculating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Destination City
            </label>
            <CityAutocomplete
              value={destinationCity}
              onChange={setDestinationCity}
              onSelect={(loc, label) => {
                setDestinationCity(label);
                setDestLoc(loc);
              }}
              placeholder="Enter destination city"
              disabled={isCalculating}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isCalculating || !sourceCity || !destinationCity || !selectedCar}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 bg-ev-600 text-white rounded-md hover:bg-ev-700 transition-colors disabled:opacity-50',
            isCalculating && 'animate-pulse',
          )}
        >
          {isCalculating ? 'Planning…' : 'Plan charges'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-md text-red-700 dark:text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}
      </form>

      {/* Summary: route basics + reserve comparison + toggle */}
      {routeSummary && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Route size={12} /> Distance
                </p>
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {formatRouteDistance(routeSummary.distanceMeters)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Clock size={12} /> Driving
                </p>
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {formatRouteDuration(routeSummary.durationSeconds)}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">Show on map</span>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  {RESERVE_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setActiveReserve(level)}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-semibold transition-colors',
                        activeReserve === level
                          ? 'bg-white dark:bg-gray-900 text-ev-700 dark:text-ev-400 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
                      )}
                    >
                      {level}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RESERVE_LEVELS.map((level) => {
                const t = scenarioTotals(level);
                const active = activeReserve === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setActiveReserve(level)}
                    className={cn(
                      'text-left rounded-lg border p-3 transition-colors',
                      active
                        ? 'border-ev-400 dark:border-ev-700 bg-ev-50/60 dark:bg-ev-900/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Charge when below {level}%
                      </p>
                      {active && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ev-700 dark:text-ev-400">
                          On map
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Stops</span>
                      <span className="text-right font-semibold text-gray-900 dark:text-gray-100">
                        {t.stopsCount === 0 ? 'None' : t.stopsCount}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">Charging</span>
                      <span className="text-right font-semibold text-ev-700 dark:text-ev-400">
                        {formatChargeMinutes(t.chargeMinutes)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">Trip total</span>
                      <span className="text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatChargeMinutes(
                          Math.round((routeSummary.durationSeconds ?? 0) / 60 + t.chargeMinutes),
                        )}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">Arrival SoC</span>
                      <span
                        className={cn(
                          'text-right font-semibold',
                          t.arrival !== null && t.arrival < level
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400',
                        )}
                      >
                        {t.arrival === null ? '–' : `${Math.round(t.arrival)}%`}
                      </span>
                    </div>
                    {t.infeasible && (
                      <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 mt-2">
                        <AlertTriangle size={11} /> May not reach the destination
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {usesEstimates && (
              <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle size={12} /> Some charge times are estimates (no data stored for this
                car — edit in Settings).
              </p>
            )}
          </div>

          {activeAnchored?.infeasible && activeAnchored.reasons.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} /> Charge when below {activeReserve}% may not take you to
                the destination:
              </p>
              {activeAnchored.reasons.map((r, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">
                  {r}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map */}
      {routeCoords && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Charging plan · reserve {activeReserve}% ·{' '}
            {displayStops.length === 0
              ? 'no stops needed'
              : `${displayStops.length} stop${displayStops.length > 1 ? 's' : ''}`}
          </h3>
          <FullscreenMap className="h-[400px] w-full overflow-hidden rounded-lg">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <MapResizeOnFullscreen />
              <FitBounds coords={routeCoords} />
              <TileLayer
                attribution={MAP_TILE_ATTRIBUTIONS[resolvedTheme]}
                url={MAP_TILE_URLS[resolvedTheme]}
              />
              {routeCoords.length > 0 && (
                <Polyline positions={routeCoords} color="blue" weight={5} opacity={0.7}>
                  <Popup>Route</Popup>
                </Polyline>
              )}
              {Object.entries(activeStopNearby).flatMap(([stopIndexKey, stations]) => {
                const stopIndex = Number(stopIndexKey);
                const anchoredSelected = anchoredStationFor(stopIndex);
                return stations
                  .filter((st) => anchoredSelected?.id !== st.id)
                  .map((st) => {
                    const status = getStationStatus(st);
                    const fast = getMaxPowerFor(st) >= 50;
                    return (
                      <Marker
                        key={st.id}
                        position={[st.addressInfo.lat, st.addressInfo.lon]}
                        icon={getStationIcon(status, fast)}
                      >
                        <Tooltip direction="top" offset={[0, -10]} sticky>
                          <StationCardSummary station={st} />
                        </Tooltip>
                        <Popup maxWidth={300} autoPan={false}>
                          <StationCardSummary station={st} />
                          <StationConnectorList station={st} />
                          <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                            <button
                              onClick={() => setManualFor(activeReserve, stopIndex, st.id)}
                              className="w-full text-left text-ev-600 dark:text-ev-400 hover:text-ev-700 dark:hover:text-ev-300 underline"
                            >
                              Use this station for stop {stopIndex + 1}
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  });
              })}
              {stopMarkers.map((mk) => (
                <Marker key={mk.stopIndex} position={mk.pos} icon={stopIcon}>
                  <Tooltip direction="top" offset={[0, -10]} sticky>
                    <div className="text-xs">
                      <p className="font-semibold">Charge stop {mk.stopIndex + 1}</p>
                      <p>
                        km {mk.routeDistanceKm.toFixed(1)} · {mk.chargeMinutes} min
                      </p>
                    </div>
                  </Tooltip>
                  <Popup maxWidth={260} autoPan={false}>
                    <div className="text-sm space-y-0.5">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        Charge stop {mk.stopIndex + 1} — km {mk.routeDistanceKm.toFixed(1)}
                      </p>
                      {mk.station && (
                        <p className="text-ev-700 dark:text-ev-400 font-medium">
                          {mk.station.operator?.title ?? 'Unknown operator'} ·{' '}
                          {mk.station.addressInfo.title}
                        </p>
                      )}
                      <p className="text-gray-600 dark:text-gray-400">
                        Arrive at {Math.round(mk.socOnArrivalPct)}% · depart at{' '}
                        {Math.round(mk.socOnDeparturePct)}%
                      </p>
                      <p className="text-ev-700 dark:text-ev-400 font-medium">
                        Charging: {formatChargeMinutes(mk.chargeMinutes)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </FullscreenMap>
        </div>
      )}

      {/* Stop list */}
      {displayStops.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Where to charge · reserve {activeReserve}%
          </h3>
          {displayStops.map((s, i) => {
            const nearby = rankStations(activeStopNearby[i] ?? [], preferredOperator);
            const loading = activeStationLoading[i] === true;
            const selected = s.infeasible
              ? undefined
              : (s.station ??
                (activeManual[i] != null
                  ? (activeStopNearby[i] ?? []).find((st) => st.id === activeManual[i])
                  : undefined));
            const expanded = activeExpandedStops[i] === true;
            const reason = activeAnchored?.reasons.find((r) => r.startsWith(`Stop ${i + 1}:`));

            return (
              <div
                key={i}
                className={cn(
                  'border rounded-lg',
                  s.infeasible
                    ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20'
                    : 'border-gray-100 dark:border-gray-800',
                )}
              >
                <div
                  className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                  onClick={() => toggleExpanded(activeReserve, i)}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      s.infeasible ? 'bg-red-50 dark:bg-red-900/30' : 'bg-ev-50 dark:bg-ev-900/30',
                    )}
                  >
                    <CarIcon
                      size={16}
                      className={s.infeasible ? 'text-red-500' : 'text-ev-600 dark:text-ev-400'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Stop {i + 1} · after {s.routeDistanceKm.toFixed(1)} km
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Arrive {Math.round(s.socOnArrivalPct)}% → depart{' '}
                      {Math.round(s.socOnDeparturePct)}%
                    </p>
                    {selected && (
                      <p className="text-xs text-ev-700 dark:text-ev-400 truncate">
                        {selected.operator?.title ?? 'Unknown operator'} ·{' '}
                        {selected.addressInfo.title}
                      </p>
                    )}
                    {!selected && !loading && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        No usable charging point in reach
                      </p>
                    )}
                    {!selected && loading && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Looking for charging points…
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ev-700 dark:text-ev-400">
                      {formatChargeMinutes(s.chargeMinutes)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">charging</p>
                  </div>
                  <ChevronDown
                    size={15}
                    className={cn(
                      'text-gray-400 dark:text-gray-500 transition-transform shrink-0',
                      expanded && 'rotate-180',
                    )}
                  />
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Nearby charging points within {stationRadiusKm} km
                      {powerKw ? ` · ≥ ${powerKw} kW` : ''}
                      {preferredOperator.trim() ? ` · preferring ${preferredOperator.trim()}` : ''}
                      {loading ? ' …' : ` (${nearby.length})`}
                    </p>
                    {loading && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">
                        Fetching nearby stations…
                      </p>
                    )}
                    {!loading && nearby.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        No stations within {stationRadiusKm} km of this stop.
                      </p>
                    )}
                    {s.infeasible && reason && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle size={11} /> {reason}
                      </p>
                    )}
                    {!loading &&
                      nearby.map((st) => {
                        const total = getTotalConnectors(st);
                        const avail = availableConnectors(st.connections);
                        const hasAvailability = st.connections.some((c) => c.statusTitle);
                        const isSelected = selected?.id === st.id;
                        const isPreferred =
                          (preferredOperator.trim() &&
                            st.operator?.title
                              ?.toLowerCase()
                              .includes(preferredOperator.trim().toLowerCase())) ||
                          false;
                        return (
                          <div
                            key={st.id}
                            className={cn(
                              'flex items-start gap-2 rounded-lg border px-3 py-2',
                              isSelected
                                ? 'border-ev-300 dark:border-ev-700 bg-ev-50 dark:bg-ev-900/30'
                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {st.addressInfo.title}
                                </p>
                                {isPreferred && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-ev-100 dark:bg-ev-900/40 text-ev-700 dark:text-ev-400">
                                    preferred
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    'px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                                    getStationStatus(st) === 'operational'
                                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                                  )}
                                >
                                  {getStationStatus(st) === 'operational'
                                    ? 'Operational'
                                    : 'Not operational'}
                                </span>
                              </div>
                              {st.operator && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Building2 size={11} /> {st.operator.title}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-600 dark:text-gray-400">
                                <span className="inline-flex items-center gap-1">
                                  <Zap size={11} className="text-ev-700 dark:text-ev-400" />{' '}
                                  {getMaxPowerFor(st)} kW max
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Plug size={11} /> {total} connector{total !== 1 ? 's' : ''}
                                </span>
                                {hasAvailability && (
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 font-medium',
                                      avail > 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-500 dark:text-red-400',
                                    )}
                                  >
                                    {avail} free
                                  </span>
                                )}
                              </div>
                              {st.addressInfo.distance != null && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                  {formatDistance(st.addressInfo.distance)} from route point
                                </p>
                              )}
                            </div>
                            {isSelected ? (
                              <span className="text-xs font-semibold text-ev-700 dark:text-ev-400 shrink-0">
                                Selected
                              </span>
                            ) : (
                              <button
                                onClick={() => setManualFor(activeReserve, i, st.id)}
                                className="text-xs font-medium text-ev-700 dark:text-ev-400 hover:text-ev-800 dark:hover:text-ev-300 hover:underline shrink-0"
                              >
                                Use this station
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
          {displayArrival !== null && (
            <p className="text-sm text-gray-600 dark:text-gray-400 pt-1">
              Arrive at destination with{' '}
              <span className="font-semibold">{Math.round(displayArrival)}%</span> battery.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getMaxPowerFor(station: ChargingStation): number {
  return Math.max(0, ...station.connections.map((c) => c.powerKW ?? 0));
}
