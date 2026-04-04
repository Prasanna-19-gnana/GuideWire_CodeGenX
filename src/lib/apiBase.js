const LOCAL_API_BASE = 'http://localhost:3001/api';

function normalizeBase(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

export function getApiBaseUrl() {
  const configured = normalizeBase(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL);
  if (configured) {
    return configured;
  }

  if (typeof window === 'undefined') {
    return LOCAL_API_BASE;
  }

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return LOCAL_API_BASE;
  }

  return `${window.location.origin}/api`;
}