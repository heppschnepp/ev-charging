import { haversineDistance } from '@/utils/routingUtils';
import type { Connection, ChargingStation } from '@/types';
import { getStationStatus, getMaxPower } from '@/lib/utils';

export const DEFAULT_CHARGE_10_80_MIN = 45;
export const DEFAULT_CHARGE_10_100_MIN = 55;
/** Minimum SoC we allow planning to arrive at a charger, in % */
export const PLAN_FLOOR_SOC_PCT = 5;

/**
 * Count of connectors/cables reported as available at a station, summed from
 * connection `quantity` where the OCM status title mentions "available".
 */
export function availableConnectors(connections: Connection[]): number {
  return connections.reduce(
    (sum, c) =>
      sum + (c.statusTitle?.toLowerCase().includes('available') ? (c.quantity ?? 1) : 0),
    0,
  );
}

/**
 * Minutes to charge from `socPct` up to `chargeTargetPct` using a piecewise
 * linear rate: the 10→80 reference covers the ≤80% part, the 10→100 reference
 * the >80% part. Missing references fall back to the defaults.
 */
export function chargeMinutesToTarget(
  socPct: number,
  chargeTargetPct: number,
  chargeTime10To80Min: number | null,
  chargeTime10To100Min: number | null,
): number {
  if (socPct >= chargeTargetPct) return 0;
  const time80 = chargeTime10To80Min ?? DEFAULT_CHARGE_10_80_MIN;
  const time100 = chargeTime10To100Min ?? DEFAULT_CHARGE_10_100_MIN;
  const rateTo80 = time80 / 70;
  const rateBeyond80 = time100 / 90;
  if (chargeTargetPct === 80) {
    return (80 - socPct) * rateTo80;
  }
  if (socPct >= 80) return (100 - socPct) * rateBeyond80;
  return (80 - socPct) * rateTo80 + 20 * rateBeyond80;
}

function matchesOperator(station: ChargingStation, operator: string): boolean {
  const q = operator.trim();
  if (!q) return false;
  return Boolean(station.operator?.title?.toLowerCase().includes(q.toLowerCase()));
}

/** Rank stations for display: preferred operator first, then operational, then max power. */
export function rankStations(stations: ChargingStation[], preferredOperator: string): ChargingStation[] {
  if (stations.length <= 1) return [...stations];
  return [...stations].sort((a, b) => {
    const pa = matchesOperator(a, preferredOperator) ? 1 : 0;
    const pb = matchesOperator(b, preferredOperator) ? 1 : 0;
    if (pb !== pa) return pb - pa;
    const oa = getStationStatus(a) === 'operational' ? 1 : 0;
    const ob = getStationStatus(b) === 'operational' ? 1 : 0;
    if (ob !== oa) return ob - oa;
    return getMaxPower(b) - getMaxPower(a);
  });
}

export interface ChargePlanInput {
  /** Total driving distance of the route in km */
  totalDistanceKm: number;
  /** WLTP range of the car in km (for 100% SoC) */
  rangeKm: number;
  /** Battery state at route start in % */
  startSocPct: number;
  /** Charge when SoC drops to this level, in % (e.g. 10 or 20) */
  minSocPct: number;
  /** Charge back up to this level, in % (80 or 100) */
  chargeTargetPct: 80 | 100;
  /** Minutes to charge 10% → 80% (null → estimate) */
  chargeTime10To80Min: number | null;
  /** Minutes to charge 10% → 100% (null → estimate) */
  chargeTime10To100Min: number | null;
}

export interface ChargeStop {
  /** Distance from route start where charging happens, in km */
  distanceKm: number;
  /** SoC upon arriving at the stop, in % */
  socOnArrivalPct: number;
  /** SoC when leaving the stop, in % */
  socOnDeparturePct: number;
  /** Time spent charging at this stop, in minutes */
  chargeMinutes: number;
}

export interface ChargePlanResult {
  stops: ChargeStop[];
  totalChargeMinutes: number;
  /** SoC at destination, in % */
  arrivalSocPct: number;
  /** True when the car can cover the whole route without an intermediate charge */
  reachableWithoutCharge: boolean;
  /** True when any charge-time estimate was used because the car had no stored values */
  usesEstimates: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeChargePlan(input: ChargePlanInput): ChargePlanResult {
  const {
    totalDistanceKm,
    rangeKm,
    startSocPct,
    minSocPct,
    chargeTargetPct,
    chargeTime10To80Min,
    chargeTime10To100Min,
  } = input;

  const usesEstimates =
    chargeTime10To80Min === null || chargeTime10To100Min === null;

  if (rangeKm <= 0) {
    return {
      stops: [],
      totalChargeMinutes: 0,
      arrivalSocPct: startSocPct,
      reachableWithoutCharge: false,
      usesEstimates,
    };
  }

  const kmPerPct = rangeKm / 100;
  const stops: ChargeStop[] = [];
  const maxIterations = 100;

  let traveledKm = 0;
  let socPct = Math.min(startSocPct, 100);

  if (socPct < minSocPct) {
    stops.push({
      distanceKm: 0,
      socOnArrivalPct: round1(socPct),
      socOnDeparturePct: chargeTargetPct,
      chargeMinutes: Math.round(
        chargeMinutesToTarget(socPct, chargeTargetPct, chargeTime10To80Min, chargeTime10To100Min),
      ),
    });
    socPct = chargeTargetPct;
  }

  let arrivalSocPct = minSocPct;
  for (let i = 0; i < maxIterations; i++) {
    const remainingKm = totalDistanceKm - traveledKm;
    const ableKm = (socPct - minSocPct) * kmPerPct;

    if (ableKm >= remainingKm) {
      arrivalSocPct = socPct - remainingKm / kmPerPct;
      break;
    }

    const stopKm = traveledKm + ableKm;
    stops.push({
      distanceKm: round1(stopKm),
      socOnArrivalPct: minSocPct,
      socOnDeparturePct: chargeTargetPct,
      chargeMinutes: Math.round(
        chargeMinutesToTarget(minSocPct, chargeTargetPct, chargeTime10To80Min, chargeTime10To100Min),
      ),
    });
    traveledKm = stopKm;
    socPct = chargeTargetPct;
  }

  // Cope with a route too short to move the SoC at all (division by tiny kmPerPct)
  const totalChargeMinutes = stops.reduce((sum, s) => sum + s.chargeMinutes, 0);

  return {
    stops,
    totalChargeMinutes,
    arrivalSocPct: round1(arrivalSocPct),
    reachableWithoutCharge:
      stops.length === 0 && socPct >= minSocPct,
    usesEstimates,
  };
}

/**
 * Return the point on a polyline that lies `distanceMeters` along it from the
 * start. Returns the last point if the distance exceeds the polyline length.
 */
export function pointAtDistance(
  coords: [number, number][],
  distanceMeters: number,
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];

  let accumulated = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lat1, lon1] = coords[i - 1];
    const [lat2, lon2] = coords[i];
    const segLen = haversineDistance(lat1, lon1, lat2, lon2);
    if (segLen === 0) continue;

    if (accumulated + segLen >= distanceMeters) {
      const t = (distanceMeters - accumulated) / segLen;
      return [lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t];
    }
    accumulated += segLen;
  }
  return coords[coords.length - 1];
}

/**
 * Project a point onto the closest point of a polyline and return its distance
 * along the polyline (meters from the start) plus the projected point itself.
 */
export function projectOntoRoute(
  coords: [number, number][],
  lat: number,
  lon: number,
): { routeMeters: number; point: [number, number] } {
  if (coords.length === 0) return { routeMeters: 0, point: [lat, lon] };
  if (coords.length === 1) return { routeMeters: 0, point: coords[0] };

  let best = { dist: Infinity, routeMeters: 0, point: coords[0] };
  let cumulative = 0;

  for (let i = 1; i < coords.length; i++) {
    const [lat1, lon1] = coords[i - 1];
    const [lat2, lon2] = coords[i];
    const segLen = haversineDistance(lat1, lon1, lat2, lon2);

    let t = 0;
    const dx = lon2 - lon1;
    const dy = lat2 - lat1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq > 0) {
      t = ((lon - lon1) * dx + (lat - lat1) * dy) / lenSq;
    }
    t = Math.max(0, Math.min(1, t));
    const footLat = lat1 + t * dy;
    const footLon = lon1 + t * dx;
    const dist = haversineDistance(lat, lon, footLat, footLon);
    const routeMeters = cumulative + t * segLen;

    if (dist < best.dist) {
      best = { dist, routeMeters, point: [footLat, footLon] };
    }
    cumulative += segLen;
  }
  return { routeMeters: best.routeMeters, point: best.point };
}

export interface AnchoredStop {
  /** Ideal stop distance from the range-only plan, in km */
  idealDistanceKm: number;
  /** Anchored position along the route (station's projection), in km */
  routeDistanceKm: number;
  socOnArrivalPct: number;
  socOnDeparturePct: number;
  chargeMinutes: number;
  /** The real charger this stop is anchored to (null → not serviced) */
  station: ChargingStation | null;
  infeasible: boolean;
}

export interface AnchoredPlanResult {
  stops: AnchoredStop[];
  totalChargeMinutes: number;
  arrivalSocPct: number;
  /** True when at least one stop could not be anchored to a reachable station */
  infeasible: boolean;
  /** Per-stop explanations when infeasible */
  reasons: string[];
  usesEstimates: boolean;
}

export interface AnchorPlanArgs {
  routeCoords: [number, number][];
  totalDistanceKm: number;
  rangeKm: number;
  startSocPct: number;
  chargeTargetPct: 80 | 100;
  /** Ideal stops from `computeChargePlan` */
  baseStops: ChargeStop[];
  /** SoC at destination from the base plan (used for the infeasible fallback) */
  baseArrivalSocPct: number;
  /** Nearby stations per stop index (aligned with `baseStops`) */
  stopsNearby: ChargingStation[][];
  preferredOperator: string;
  /** User-confirmed picks per stop index; respected when still present */
  forced: Record<number, number>;
  chargeTime10To80Min: number | null;
  chargeTime10To100Min: number | null;
}

/**
 * Anchors the range-based plan to real charging stations. For every stop the
 * nearest reachable station is chosen (preferred operator first, then any
 * operational station of any operator, then the closest option); legs, arrival
 * SoC and charge minutes are recomputed from the anchored positions. Stops that
 * have no reachable station make the plan `infeasible` (with per-stop reasons)
 * and fall back to the range-based positions so the gap is visible.
 */
export function anchorPlanToStations(args: AnchorPlanArgs): AnchoredPlanResult {
  const {
    routeCoords,
    totalDistanceKm,
    rangeKm,
    startSocPct,
    chargeTargetPct,
    baseStops,
    baseArrivalSocPct,
    stopsNearby,
    preferredOperator,
    forced,
    chargeTime10To80Min,
    chargeTime10To100Min,
  } = args;

  const usesEstimates = chargeTime10To80Min === null || chargeTime10To100Min === null;
  const kmPerPct = rangeKm / 100;
  const totalMeters = totalDistanceKm * 1000;
  const floor = PLAN_FLOOR_SOC_PCT;
  const usableMeters = Math.max(0, (chargeTargetPct - floor) * kmPerPct * 1000);

  // Polyline coordinates are shorter than the real road distance — rescale so
  // every station position is expressed in the same (road) meters as the rest.
  const polylineTotal = routeCoords.reduce((sum, [lat, lon], i) =>
    i === 0 ? sum : sum + haversineDistance(routeCoords[i - 1][0], routeCoords[i - 1][1], lat, lon), 0);
  const scale = polylineTotal > 0 ? totalMeters / polylineTotal : 1;

  interface RouteCandidate {
    station: ChargingStation;
    roadMeters: number;
    idealMeters: number;
  }

  const arrivalAt = (roadMeters: number, prevRoad: number, departureSocPct: number): number =>
    departureSocPct - (roadMeters - prevRoad) / 1000 / kmPerPct;

  // Candidate stations per stop with their rescaled position along the route.
  // Anything beyond the destination is unusable, as are stations "behind" the start.
  const candidatesByStop = baseStops.map((base, i) =>
    (stopsNearby[i] ?? [])
      .map((station) => {
        const { routeMeters } = projectOntoRoute(
          routeCoords,
          station.addressInfo.lat,
          station.addressInfo.lon,
        );
        return {
          station,
          roadMeters: routeMeters * scale,
          idealMeters: base.distanceKm * 1000,
        };
      })
      .filter((c) => c.roadMeters >= 0 && c.roadMeters < totalMeters - 1)
      .sort((a, b) => {
        const pa = matchesOperator(a.station, preferredOperator) ? 1 : 0;
        const pb = matchesOperator(b.station, preferredOperator) ? 1 : 0;
        if (pb !== pa) return pb - pa;
        const oa = getStationStatus(a.station) === 'operational' ? 1 : 0;
        const ob = getStationStatus(b.station) === 'operational' ? 1 : 0;
        if (ob !== oa) return ob - oa;
        const paPower = getMaxPower(a.station);
        const pbPower = getMaxPower(b.station);
        if (pbPower !== paPower) return pbPower - paPower;
        return Math.abs(a.roadMeters - a.idealMeters) - Math.abs(b.roadMeters - b.idealMeters);
      }),
  );

  const reasons: string[] = [];
  let infeasible = false;
  const picked: (RouteCandidate | null)[] = [];
  let prevRoadMeters = 0;

  // Forward pass: preferred operator first, keeping every arrival above the floor.
  baseStops.forEach((_base, i) => {
    const forcedId = forced[i];
    const departure = i === 0 ? startSocPct : chargeTargetPct;
    const reachable = (c: RouteCandidate): boolean =>
      c.roadMeters > prevRoadMeters + 1 && arrivalAt(c.roadMeters, prevRoadMeters, departure) >= floor;

    let chosen: RouteCandidate | null = null;

    if (forcedId != null) {
      const fl = candidatesByStop[i].find((c) => c.station.id === forcedId);
      if (fl && reachable(fl)) {
        chosen = fl;
      } else if (fl) {
        reasons.push(
          `Stop ${i + 1}: your chosen point (${fl.station.addressInfo.title}) is out of reach${
            fl.roadMeters <= prevRoadMeters + 1 ? ' (behind the previous stop)' : ` (it would push the next leg below ${floor}%)`
          } — falling back.`,
        );
      } else {
        reasons.push(`Stop ${i + 1}: your chosen point is no longer among the nearby options — falling back.`);
      }
    }

    if (!chosen) chosen = candidatesByStop[i].find(reachable) ?? null;

    if (!chosen) {
      const prefLabel = preferredOperator.trim() ? ` from "${preferredOperator.trim()}"` : '';
      reasons.push(
        `Stop ${i + 1}: no usable charging point${prefLabel} within reach — widen the radius or pick one manually.`,
      );
    } else {
      prevRoadMeters = chosen.roadMeters;
    }
    picked.push(chosen);
  });

  // The final leg is only validated once all stops are placed: the last stop may
  // land too early to leave enough range for the home stretch. Push it as far
  // along the route as the station options allow.
  let arrivalSocPct = baseArrivalSocPct;
  const lastIndex = picked.length - 1;
  const last = lastIndex >= 0 ? picked[lastIndex] : null;

  if (last) {
    const wasForced = forced[lastIndex] != null;
    const forcedTitle = wasForced && last.station ? last.station.addressInfo.title : null;
    arrivalSocPct = chargeTargetPct - (totalMeters - last.roadMeters) / 1000 / kmPerPct;
    if (arrivalSocPct < floor) {
      const prevRoad = lastIndex > 0 && picked[lastIndex - 1] ? picked[lastIndex - 1]!.roadMeters : 0;
      const departure = lastIndex === 0 ? startSocPct : chargeTargetPct;
      const fixable = candidatesByStop[lastIndex]
        .filter(
          (c) =>
            c.roadMeters > prevRoad + 1 &&
            arrivalAt(c.roadMeters, prevRoad, departure) >= floor &&
            totalMeters - c.roadMeters <= usableMeters,
        )
        .sort((a, b) => {
          const pa = matchesOperator(a.station, preferredOperator) ? 1 : 0;
          const pb = matchesOperator(b.station, preferredOperator) ? 1 : 0;
          if (pb !== pa) return pb - pa;
          const oa = getStationStatus(a.station) === 'operational' ? 1 : 0;
          const ob = getStationStatus(b.station) === 'operational' ? 1 : 0;
          if (ob !== oa) return ob - oa;
          return b.roadMeters - a.roadMeters;
        });
      const fixed = fixable[0] ?? null;
      if (fixed) {
        if (wasForced || (fixable.length > 0 && fixed.station.id !== last.station.id)) {
          reasons.push(
            `Stop ${lastIndex + 1}: ${forcedTitle ? `your chosen point (${forcedTitle}) ` : ''}would leave the final stretch below ${floor}% — moved to ${fixed.station.addressInfo.title} (${preferredOperator.trim() ? `${preferredOperator.trim()} · ` : ''}${getMaxPower(fixed.station)} kW) to keep the destination reachable.`,
          );
        }
        picked[lastIndex] = fixed;
        arrivalSocPct = chargeTargetPct - (totalMeters - fixed.roadMeters) / 1000 / kmPerPct;
      } else {
        infeasible = true;
        reasons.push(
          `Stop ${lastIndex + 1}: after charging there the final stretch to your destination exceeds the battery range — no usable charging point further along the route.`,
        );
        arrivalSocPct = baseArrivalSocPct;
      }
    }
  }

  // Materialise the anchored stops and recompute legs from the (possibly fixed) picks.
  const anchored: AnchoredStop[] = [];
  let runRoad = 0;
  picked.forEach((pick, i) => {
    const base = baseStops[i];
    if (!pick) {
      infeasible = true;
      // Keep the range-based position as a visible gap
      anchored.push({
        idealDistanceKm: base.distanceKm,
        routeDistanceKm: base.distanceKm,
        socOnArrivalPct: base.socOnArrivalPct,
        socOnDeparturePct: base.socOnDeparturePct,
        chargeMinutes: 0,
        station: null,
        infeasible: true,
      });
      runRoad = base.distanceKm * 1000;
      return;
    }
    const arrival = i === 0 ? startSocPct - pick.roadMeters / 1000 / kmPerPct : chargeTargetPct - (pick.roadMeters - runRoad) / 1000 / kmPerPct;
    const departure = Math.max(arrival, chargeTargetPct);
    const chargeMinutes = Math.round(
      chargeMinutesToTarget(arrival, chargeTargetPct, chargeTime10To80Min, chargeTime10To100Min),
    );
    anchored.push({
      idealDistanceKm: round1(pick.idealMeters / 1000),
      routeDistanceKm: round1(pick.roadMeters / 1000),
      socOnArrivalPct: round1(arrival),
      socOnDeparturePct: departure,
      chargeMinutes,
      station: pick.station,
      infeasible: false,
    });
    runRoad = pick.roadMeters;
  });

  const totalChargeMinutes = anchored.reduce((sum, s) => sum + s.chargeMinutes, 0);
  arrivalSocPct = round1(arrivalSocPct);

  return {
    stops: anchored,
    totalChargeMinutes,
    arrivalSocPct,
    infeasible,
    reasons,
    usesEstimates,
  };
}