export const EVENT_LABELS = {
  curfew: 'Curfew',
  rain: 'Heavy Rain',
  heat: 'Heatwave',
};

export const EVENT_SEVERITY_STYLES = {
  low: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    ring: 'rgba(16,185,129,0.28)',
  },
  medium: {
    badge: 'bg-amber-500/15 text-amber-200 border-amber-400/20',
    ring: 'rgba(245,158,11,0.28)',
  },
  high: {
    badge: 'bg-red-500/15 text-red-200 border-red-400/20',
    ring: 'rgba(239,68,68,0.28)',
  },
};

export const PLAN_FACTORS = {
  Basic: 0.8,
  Standard: 1,
  Premium: 1.2,
};

export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function formatEventType(type) {
  return EVENT_LABELS[normalizeText(type)] || 'Disruption';
}

export function getEventTheme(event = {}) {
  return EVENT_SEVERITY_STYLES[normalizeText(event.severity)] || EVENT_SEVERITY_STYLES.medium;
}

export function getPlanFactor(plan) {
  return PLAN_FACTORS[String(plan || 'Basic')] ?? PLAN_FACTORS.Basic;
}

export function calculateEventPayout({ hourlyIncome = 0, lostHours = 0, plan = 'Basic' } = {}) {
  const amount = Math.max(0, Number(hourlyIncome || 0)) * Math.max(0, Number(lostHours || 0)) * getPlanFactor(plan);
  return Number(amount.toFixed(2));
}

export function buildEventSignature(event = {}) {
  return [
    normalizeText(event.id),
    normalizeText(event.type),
    normalizeText(event.location?.city),
    String(event.location?.lat ?? ''),
    String(event.location?.lng ?? ''),
    String(event.radius ?? ''),
    String(event.duration ?? ''),
    normalizeText(event.severity),
  ].join('|');
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;

  const earthRadiusKm = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export function isUserInsideEvent(lat, lng, event = {}) {
  const eventLat = Number(event.location?.lat);
  const eventLng = Number(event.location?.lng);
  const radius = Math.max(0, Number(event.radius || 0));

  if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(eventLat) && Number.isFinite(eventLng)) {
    return distanceKm(lat, lng, eventLat, eventLng) <= radius;
  }

  return normalizeText(event.location?.city) !== '';
}
