import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, BadgeAlert, CloudRain, Loader2, RefreshCw, ShieldAlert, Siren, Trash2, TriangleAlert } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const TRIGGER_PRESETS = [
  {
    key: 'curfew',
    label: 'Curfew',
    confidence: 0.98,
    reason: 'Curfew / Section 144 / zone closure',
    icon: Siren,
  },
  {
    key: 'strike',
    label: 'Strike',
    confidence: 0.84,
    reason: 'Strike / bandh / civic shutdown',
    icon: BadgeAlert,
  },
  {
    key: 'zone-closure',
    label: 'Zone Closure',
    confidence: 0.92,
    reason: 'Restricted zone closure notice',
    icon: ShieldAlert,
  },
  {
    key: 'weather',
    label: 'Weather Support',
    confidence: 0.9,
    reason: 'Weather-linked disruption / heavy rain alert',
    icon: CloudRain,
  },
];

const defaultForm = {
  location: 'Chennai',
  subarea: 'T Nagar',
  reason: 'Curfew / Section 144 / zone closure',
  startTime: '',
  endTime: '',
  confidence: 0.98,
  createdBy: 'admin',
  notes: 'Manual simulation trigger',
  token: '563f0543bc92003e4c6c4e89e177ae71',
  preset: 'curfew',
};

const defaultPolicyForm = {
  email: 'worker@example.com',
  plan: 'Basic',
  weeklyIncome: 4800,
  coverageHours: 12,
  city: 'Chennai',
  state: 'Tamil Nadu',
  safeZoneDiscount: 0,
  notes: 'Manual policy created from admin panel',
};

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

function formatTime(value) {
  if (!value) return 'Auto';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function App() {
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState({ type: 'idle', message: 'Ready to add a manual trigger.' });
  const [submitting, setSubmitting] = useState(false);
  const [mockTrigger, setMockTrigger] = useState(null);
  const [monitorQuery, setMonitorQuery] = useState({ city: 'Chennai', state: 'Tamil Nadu', subarea: 'T Nagar' });
  const [monitor, setMonitor] = useState({ loading: false, data: null, error: '' });
  const [policyForm, setPolicyForm] = useState(defaultPolicyForm);
  const [policyStatus, setPolicyStatus] = useState({ type: 'idle', message: 'Ready to manage policies.' });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policies, setPolicies] = useState([]);

  useEffect(() => {
    const preset = TRIGGER_PRESETS.find((item) => item.key === form.preset) || TRIGGER_PRESETS[0];
    setForm((prev) => ({
      ...prev,
      reason: preset.reason,
      confidence: preset.confidence,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.preset]);

  const presetMeta = useMemo(() => TRIGGER_PRESETS.find((item) => item.key === form.preset) || TRIGGER_PRESETS[0], [form.preset]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePresetSelect = (preset) => {
    setForm((prev) => ({
      ...prev,
      preset: preset.key,
      reason: preset.reason,
      confidence: preset.confidence,
    }));
  };

  const createManualTrigger = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: 'loading', message: 'Creating disruption trigger...' });

    try {
      const payload = {
        location: form.location.trim(),
        subarea: form.subarea.trim(),
        reason: form.reason.trim(),
        confidence: Number(form.confidence || 0.95),
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        createdBy: form.createdBy.trim() || 'admin',
        notes: form.notes.trim(),
      };

      const headers = {};
      if (form.token.trim()) {
        headers['x-admin-token'] = form.token.trim();
      }

      const result = await fetchJson(`${API_BASE}/social-disruption/admin`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      setStatus({
        type: 'success',
        message: `Trigger saved for ${result?.disruption?.location || payload.location}.`,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to create trigger.' });
    } finally {
      setSubmitting(false);
    }
  };

  const mockBrowserTrigger = () => {
    const mockPayload = {
      id: `mock-${Date.now()}`,
      location: form.location.trim(),
      subarea: form.subarea.trim(),
      reason: form.reason.trim(),
      confidence: Number(form.confidence || 0.95),
      createdBy: form.createdBy.trim() || 'admin',
      notes: `${form.notes.trim() || 'Manual simulation trigger'} - browser DOM mock`,
      preset: form.preset,
      injectedAt: new Date().toISOString(),
    };

    setMockTrigger(mockPayload);
    setStatus({
      type: 'success',
      message: `Mock trigger injected into the browser DOM for ${mockPayload.location}.`,
    });

    if (typeof document !== 'undefined') {
      document.body.dataset.zyrosafeMockTrigger = mockPayload.preset;
    }
  };

  const refreshMonitor = async () => {
    setMonitor((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const query = new URLSearchParams();
      if (monitorQuery.city.trim()) query.set('city', monitorQuery.city.trim());
      if (monitorQuery.state.trim()) query.set('state', monitorQuery.state.trim());
      if (monitorQuery.subarea.trim()) query.set('subarea', monitorQuery.subarea.trim());

      const data = await fetchJson(`${API_BASE}/social-disruption/active?${query.toString()}`);
      setMonitor({ loading: false, data, error: '' });
    } catch (error) {
      setMonitor({ loading: false, data: null, error: error.message || 'Unable to load active signals' });
    }
  };

  const refreshPolicies = async (email = policyForm.email) => {
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail) return;

    setPolicyLoading(true);
    try {
      const data = await fetchJson(`${API_BASE}/policies?email=${encodeURIComponent(normalizedEmail)}`);
      setPolicies(Array.isArray(data?.policies) ? data.policies : []);
      setPolicyStatus({ type: 'idle', message: `Loaded policies for ${normalizedEmail}.` });
    } catch (error) {
      setPolicyStatus({ type: 'error', message: error.message || 'Unable to load policies.' });
    } finally {
      setPolicyLoading(false);
    }
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    setPolicyStatus({ type: 'loading', message: 'Saving policy...' });

    try {
      const payload = {
        email: policyForm.email.trim(),
        plan: policyForm.plan,
        weeklyIncome: Number(policyForm.weeklyIncome || 0),
        coverageHours: Number(policyForm.coverageHours || 0),
        city: policyForm.city.trim(),
        state: policyForm.state.trim(),
        safeZoneDiscount: Number(policyForm.safeZoneDiscount || 0),
        notes: policyForm.notes.trim(),
      };

      const result = await fetchJson(`${API_BASE}/policies`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setPolicyStatus({ type: 'success', message: `Saved policy ${result?.policy?.policyNumber || ''} for ${payload.email}.` });
      await refreshPolicies(payload.email);
    } catch (error) {
      setPolicyStatus({ type: 'error', message: error.message || 'Unable to save policy.' });
    }
  };

  const deletePolicy = async (policyId) => {
    try {
      await fetchJson(`${API_BASE}/policies/${encodeURIComponent(policyId)}`, { method: 'DELETE' });
      setPolicies(prev => prev.filter(item => item.id !== policyId));
      setPolicyStatus({ type: 'success', message: 'Policy removed.' });
    } catch (error) {
      setPolicyStatus({ type: 'error', message: error.message || 'Unable to delete policy.' });
    }
  };

  useEffect(() => {
    refreshPolicies(policyForm.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshMonitor();
    const timer = setInterval(refreshMonitor, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSignals = monitor.data?.signals || [];
  const activeScore = monitor.data?.social_disruption_score ?? 0;

  return (
    <div className="admin-shell min-h-screen text-slate-900 bg-[#f5f5f5]">
      <div className="absolute inset-0 pointer-events-none admin-grid" />

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col gap-6">
          <section className="glass-card rounded-[28px] p-5 sm:p-6 lg:p-8 border border-gray-300">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-gray-500">Standalone Admin Host</p>
                <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">ZyroSafe Control Center</h1>
                <p className="mt-3 max-w-2xl text-sm sm:text-base text-gray-600">
                  This page runs on its own localhost URL and is used only for manual disruption triggers such as curfew, strike, and zone closure simulation.
                </p>
              </div>

              <div className="glass-card-soft rounded-2xl px-4 py-3 border border-gray-300 min-w-[220px]">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Backend connection</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">Connected to /api/social-disruption/*</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[1.02fr_0.98fr] gap-6 items-start">
            <div className="space-y-6">
            <section className="glass-card rounded-[28px] p-5 sm:p-6 border border-gray-300">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-500">Manual trigger</p>
                  <h2 className="mt-1 text-xl font-bold">Declare social disruption</h2>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <TriangleAlert size={14} className="text-gray-700" />
                    No link to main dashboard
                  </div>
                  <button
                    type="submit"
                    form="manual-trigger-form"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 bg-black text-white font-semibold shadow-sm disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                    {submitting ? 'Creating trigger...' : 'Trigger now'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                {TRIGGER_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const active = form.preset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`rounded-2xl p-4 text-left border transition-all ${active ? 'border-gray-900 bg-gray-200' : 'border-gray-300 bg-white hover:bg-gray-100'}`}
                    >
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black text-white shadow-sm">
                        <Icon size={18} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="font-semibold">{preset.label}</span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{Math.round(preset.confidence * 100)}%</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600 leading-relaxed">{preset.reason}</p>
                    </button>
                  );
                })}
              </div>

              <form id="manual-trigger-form" onSubmit={createManualTrigger} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Location</span>
                    <input
                      value={form.location}
                      onChange={(event) => updateField('location', event.target.value)}
                      className="admin-input"
                      placeholder="City or district"
                      required
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Subarea</span>
                    <input
                      value={form.subarea}
                      onChange={(event) => updateField('subarea', event.target.value)}
                      className="admin-input"
                      placeholder="Neighborhood / zone"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Reason</span>
                  <textarea
                    value={form.reason}
                    onChange={(event) => updateField('reason', event.target.value)}
                    className="admin-input min-h-[96px] resize-none"
                    placeholder="Reason for trigger"
                    required
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Start time</span>
                    <input
                      type="datetime-local"
                      value={form.startTime}
                      onChange={(event) => updateField('startTime', event.target.value)}
                      className="admin-input"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">End time</span>
                    <input
                      type="datetime-local"
                      value={form.endTime}
                      onChange={(event) => updateField('endTime', event.target.value)}
                      className="admin-input"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Confidence</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={form.confidence}
                      onChange={(event) => updateField('confidence', event.target.value)}
                      className="admin-input"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Created by</span>
                    <input
                      value={form.createdBy}
                      onChange={(event) => updateField('createdBy', event.target.value)}
                      className="admin-input"
                      placeholder="admin"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Admin token</span>
                    <input
                      value={form.token}
                      onChange={(event) => updateField('token', event.target.value)}
                      className="admin-input"
                      placeholder="Optional when token is enabled later"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField('notes', event.target.value)}
                    className="admin-input min-h-[88px] resize-none"
                    placeholder="Internal notes"
                  />
                </label>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sticky bottom-0 pt-2 bg-[rgba(245,245,245,0.95)] backdrop-blur-sm rounded-2xl">
                  <div className="text-sm text-gray-700 flex-1">
                    <p>
                      Selected preset: <span className="text-gray-900 font-semibold">{presetMeta.label}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Confidence: {Math.round(Number(form.confidence || 0) * 100)}% · Start: {formatTime(form.startTime)} · End: {formatTime(form.endTime)}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={mockBrowserTrigger}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 bg-white border border-gray-300 text-gray-900 font-semibold shadow-sm hover:bg-gray-100"
                    >
                      <BadgeAlert size={16} />
                      Mock browser DOM trigger
                    </button>
                    <button
                      type="submit"
                      form="manual-trigger-form"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 bg-black text-white font-semibold shadow-sm disabled:opacity-60"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                      {submitting ? 'Creating trigger...' : 'Create manual trigger'}
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl px-4 py-3 text-sm border ${status.type === 'success' || status.type === 'error' ? 'border-gray-300 bg-gray-100 text-gray-900' : 'border-gray-300 bg-white text-gray-700'}`}>
                  {status.message}
                </div>

                {mockTrigger ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-mock-trigger={mockTrigger.preset}
                    className="rounded-2xl border border-dashed border-gray-400 bg-white px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">Browser DOM mock</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{mockTrigger.reason}</p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 border border-gray-300 text-gray-900">
                        {Math.round(mockTrigger.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      {mockTrigger.location || 'Unknown location'} {mockTrigger.subarea ? `- ${mockTrigger.subarea}` : ''}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Injected at {formatTime(mockTrigger.injectedAt)}
                    </p>
                  </motion.div>
                ) : null}
              </form>
            </section>

            <section className="glass-card rounded-[28px] p-5 sm:p-6 border border-gray-300">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-500">Policy management</p>
                  <h2 className="mt-1 text-xl font-bold">Insurance policy controls</h2>
                </div>
                <button
                  type="button"
                  onClick={() => refreshPolicies(policyForm.email)}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-black text-white font-semibold shadow-sm disabled:opacity-60"
                  disabled={policyLoading}
                >
                  {policyLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Refresh policies
                </button>
              </div>

              <form onSubmit={savePolicy} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Email</span>
                    <input className="admin-input" value={policyForm.email} onChange={(event) => setPolicyForm(prev => ({ ...prev, email: event.target.value }))} />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Plan</span>
                    <select className="admin-input" value={policyForm.plan} onChange={(event) => setPolicyForm(prev => ({ ...prev, plan: event.target.value }))}>
                      <option value="Basic">Basic</option>
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Weekly income</span>
                    <input type="number" className="admin-input" value={policyForm.weeklyIncome} onChange={(event) => setPolicyForm(prev => ({ ...prev, weeklyIncome: event.target.value }))} />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Coverage hours</span>
                    <input type="number" className="admin-input" value={policyForm.coverageHours} onChange={(event) => setPolicyForm(prev => ({ ...prev, coverageHours: event.target.value }))} />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Safe-zone discount</span>
                    <input type="number" step="0.01" className="admin-input" value={policyForm.safeZoneDiscount} onChange={(event) => setPolicyForm(prev => ({ ...prev, safeZoneDiscount: event.target.value }))} />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">City</span>
                    <input className="admin-input" value={policyForm.city} onChange={(event) => setPolicyForm(prev => ({ ...prev, city: event.target.value }))} />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">State</span>
                    <input className="admin-input" value={policyForm.state} onChange={(event) => setPolicyForm(prev => ({ ...prev, state: event.target.value }))} />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Notes</span>
                  <textarea className="admin-input min-h-[80px] resize-none" value={policyForm.notes} onChange={(event) => setPolicyForm(prev => ({ ...prev, notes: event.target.value }))} />
                </label>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 bg-black text-white font-semibold shadow-sm">
                    Save policy
                  </button>
                  <p className="text-xs text-gray-500">This creates a policy record the premium estimator can read later.</p>
                </div>

                <div className={`rounded-2xl px-4 py-3 text-sm border ${policyStatus.type === 'success' || policyStatus.type === 'error' ? 'border-gray-300 bg-gray-100 text-gray-900' : 'border-gray-300 bg-white text-gray-700'}`}>
                  {policyStatus.message}
                </div>
              </form>

              <div className="mt-5 space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {policies.length ? policies.map((policy) => (
                  <div key={policy.id} className="rounded-2xl border border-gray-300 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{policy.policyNumber || policy.id}</p>
                        <p className="text-xs text-gray-500 mt-1">{policy.email} · {policy.plan} · {policy.city || 'No city'}{policy.state ? `, ${policy.state}` : ''}</p>
                        <p className="text-xs text-gray-600 mt-1">₹{Number(policy.weeklyIncome || 0).toLocaleString('en-IN')} / wk · {policy.coverageHours || 12} coverage hours · discount {Number(policy.safeZoneDiscount || 0).toFixed(2)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deletePolicy(policy.id)}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-gray-100 border border-gray-300 text-gray-900 hover:bg-gray-200"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-600">
                    No policies found for this email yet.
                  </div>
                )}
              </div>
            </section>
            </div>

            <section className="space-y-6">
              <div className="glass-card rounded-[28px] p-5 sm:p-6 border border-gray-300">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-gray-500">Disruption monitor</p>
                    <h2 className="mt-1 text-xl font-bold">Active signals</h2>
                  </div>
                  <button
                    type="button"
                    onClick={refreshMonitor}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white border border-gray-300 text-sm hover:bg-gray-100"
                  >
                    {monitor.loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">City</span>
                    <input value={monitorQuery.city} onChange={(event) => setMonitorQuery((prev) => ({ ...prev, city: event.target.value }))} className="admin-input" />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">State</span>
                    <input value={monitorQuery.state} onChange={(event) => setMonitorQuery((prev) => ({ ...prev, state: event.target.value }))} className="admin-input" />
                  </label>
                  <label className="block space-y-2">
                    <span className="block text-xs uppercase tracking-[0.24em] text-gray-500">Subarea</span>
                    <input value={monitorQuery.subarea} onChange={(event) => setMonitorQuery((prev) => ({ ...prev, subarea: event.target.value }))} className="admin-input" />
                  </label>
                </div>

                {monitor.error ? (
                  <div className="rounded-2xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-900">
                    {monitor.error}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-2xl bg-white border border-gray-300 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">Status</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{monitor.data?.active ? 'Active disruption' : 'No strong signal'}</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-300 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">Score</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{Math.round((activeScore || 0) * 100)}%</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-300 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">Signals</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{activeSignals.length}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {activeSignals.length ? activeSignals.map((signal, index) => (
                    <motion.div
                      key={`${signal.source}-${signal.location}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-gray-300 bg-white p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{signal.reason}</p>
                          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 mt-1">{signal.source}</p>
                        </div>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 border border-gray-300 text-gray-900">
                          {Math.round(Number(signal.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{signal.location || 'Unknown location'}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {formatTime(signal.startTime)} → {formatTime(signal.endTime)}
                      </p>
                    </motion.div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-600">
                      No active disruption signals for the current query.
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card rounded-[28px] p-5 sm:p-6 border border-gray-300">
                <p className="text-[10px] uppercase tracking-[0.28em] text-gray-500">Example payload</p>
                <pre className="mt-3 overflow-x-auto text-[12px] leading-relaxed text-gray-800 whitespace-pre-wrap">{JSON.stringify({
  location: form.location,
  subarea: form.subarea,
  reason: form.reason,
  startTime: form.startTime || 'auto',
  endTime: form.endTime || 'auto',
  confidence: Number(form.confidence || 0.95),
  createdBy: form.createdBy,
}, null, 2)}</pre>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;