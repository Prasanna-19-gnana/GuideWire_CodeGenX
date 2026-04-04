const API_BASE = 'http://localhost:3001/api';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload;
}

export function calculatePayout({ weeklyIncome = 0, workingHours = 0, lostHours = 3, plan = 'Basic' } = {}) {
  const income = Number(weeklyIncome || 0);
  const hours = Math.max(1, Number(workingHours || 0));
  const lost = Math.max(1, Number(lostHours || 0));
  const planFactor = plan === 'Premium' ? 1.2 : plan === 'Standard' ? 1.0 : 0.8;
  const hourlyIncome = income / hours;
  const payout = hourlyIncome * lost * planFactor;

  return Number(Math.max(0, payout).toFixed(2));
}

export async function postFraudCheck({ email, gps }) {
  const payload = await fetchJson(`${API_BASE}/fraud-check`, {
    method: 'POST',
    body: JSON.stringify({ email, gps }),
  });

  const fraud = payload?.fraud || payload || {};
  const rawStatus = String(fraud?.status || fraud?.action || '').toLowerCase();
  const normalizedStatus = rawStatus === 'approved' || rawStatus === 'stored'
    ? 'approved'
    : rawStatus === 'rejected'
      ? 'rejected'
      : 'flagged';

  const riskScore = Number(fraud?.riskScore ?? fraud?.score ?? 0);
  const reasons = Array.isArray(fraud?.reasons) && fraud.reasons.length
    ? fraud.reasons
    : normalizedStatus === 'approved'
      ? ['Risk within threshold']
      : normalizedStatus === 'rejected'
        ? ['Fraud risk exceeded threshold']
        : ['Potential fraud signal detected'];

  return {
    riskScore,
    status: normalizedStatus,
    reasons,
    raw: payload,
  };
}

export async function fetchDisruptionZone({ lat, lng, city = '', state = '', subarea = '' }) {
  const query = new URLSearchParams();
  if (Number.isFinite(lat)) query.set('lat', String(lat));
  if (Number.isFinite(lng)) query.set('lng', String(lng));
  if (city) query.set('city', String(city).trim());
  if (state) query.set('state', String(state).trim());
  if (subarea) query.set('subarea', String(subarea).trim());

  return fetchJson(`${API_BASE}/social-disruption/active?${query.toString()}`);
}

export async function postClaimPayoutTransaction({ email, amount, description, metadata = null }) {
  return fetchJson(`${API_BASE}/transactions`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      type: 'claim_payout',
      status: 'approved',
      amount: Number(amount || 0),
      description,
      metadata,
    }),
  });
}
