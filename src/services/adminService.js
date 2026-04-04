const API_BASE = 'http://localhost:3001/api';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload;
}

function buildAdminHeaders(token) {
  return token ? { 'x-admin-token': token } : {};
}

export async function triggerAdminEvent({ token, payload }) {
  return fetchJson(`${API_BASE}/admin/trigger-event`, {
    method: 'POST',
    headers: buildAdminHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminEvents({ token, includeInactive = true } = {}) {
  const query = new URLSearchParams();
  if (includeInactive) query.set('activeOnly', 'false');
  return fetchJson(`${API_BASE}/admin/events?${query.toString()}`, {
    headers: buildAdminHeaders(token),
  });
}

export async function fetchActiveEvents(query = {}) {
  const params = new URLSearchParams();
  if (query.city) params.set('city', query.city);
  if (query.state) params.set('state', query.state);
  if (Number.isFinite(query.lat)) params.set('lat', String(query.lat));
  if (Number.isFinite(query.lng)) params.set('lng', String(query.lng));
  return fetchJson(`${API_BASE}/events?${params.toString()}`);
}

export async function deactivateAdminEvent({ token, eventId }) {
  return fetchJson(`${API_BASE}/admin/events/${encodeURIComponent(eventId)}/deactivate`, {
    method: 'PATCH',
    headers: buildAdminHeaders(token),
  });
}

export async function fetchAdminStats({ token }) {
  return fetchJson(`${API_BASE}/admin/stats`, {
    headers: buildAdminHeaders(token),
  });
}
