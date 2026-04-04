import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Loader2, LogOut, RefreshCw, ShieldAlert, Siren } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const PRESETS = [
  { key: 'curfew', label: 'Curfew', reason: 'Curfew / Section 144 / zone closure', confidence: 0.98 },
  { key: 'rain', label: 'Heavy Rain', reason: 'Heavy rain disruption', confidence: 0.9 },
  { key: 'heat', label: 'Heatwave', reason: 'Extreme heat impact', confidence: 0.86 },
];

function AdminConsole({ userProfile, onLogout }) {
  const [form, setForm] = useState({
    preset: 'curfew',
    location: 'Chennai',
    subarea: 'T Nagar',
    reason: 'Curfew / Section 144 / zone closure',
    confidence: 0.98,
    token: userProfile?.adminToken || '563f0543bc92003e4c6c4e89e177ae71',
  });
  const [status, setStatus] = useState({ type: 'idle', message: 'Ready to trigger alerts.' });
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState({ loading: false, data: null, error: '' });

  const selectedPreset = useMemo(() => PRESETS.find((item) => item.key === form.preset) || PRESETS[0], [form.preset]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      reason: selectedPreset.reason,
      confidence: selectedPreset.confidence,
    }));
  }, [selectedPreset.key]);

  const fetchActiveSignals = async () => {
    setActive((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const query = new URLSearchParams();
      if (form.location.trim()) query.set('city', form.location.trim());
      if (form.subarea.trim()) query.set('subarea', form.subarea.trim());

      const res = await fetch(`${API_BASE}/social-disruption/active?${query.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load active alerts');
      setActive({ loading: false, data, error: '' });
    } catch (err) {
      setActive({ loading: false, data: null, error: err.message || 'Unable to load active alerts' });
    }
  };

  useEffect(() => {
    fetchActiveSignals();
    const timerId = setInterval(fetchActiveSignals, 30000);
    return () => clearInterval(timerId);
  }, []);

  const triggerAlert = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: 'loading', message: 'Triggering alert...' });

    try {
      const payload = {
        location: form.location.trim(),
        subarea: form.subarea.trim(),
        reason: form.reason.trim(),
        confidence: Number(form.confidence || 0.9),
        createdBy: userProfile?.email || 'admin',
        notes: `Manual admin trigger (${selectedPreset.label})`,
      };

      const headers = {
        'Content-Type': 'application/json',
      };
      if (form.token.trim()) {
        headers['x-admin-token'] = form.token.trim();
      }

      const res = await fetch(`${API_BASE}/social-disruption/admin`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to trigger alert');
      }

      setStatus({ type: 'success', message: `Alert triggered for ${data?.disruption?.location || payload.location}.` });
      fetchActiveSignals();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Unable to trigger alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const activeSignals = active.data?.signals || [];

  return (
    <div className="h-full w-full overflow-y-auto bg-[#050810] text-white p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="glass rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-sky-300/70">Admin Console</p>
              <h1 className="mt-1 text-2xl font-bold">Manual Alerts and Triggers</h1>
              <p className="text-sm text-slate-300 mt-2">Logged in as {userProfile?.email || 'admin'}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <section className="glass rounded-2xl p-5 border border-white/10">
            <h2 className="text-lg font-semibold mb-4">Create Manual Trigger</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, preset: preset.key }))}
                  className={`rounded-xl px-3 py-2 text-sm border ${form.preset === preset.key ? 'bg-white text-black border-white' : 'bg-white/5 border-white/15 hover:bg-white/10'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <form onSubmit={triggerAlert} className="space-y-3">
              <input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm"
                placeholder="City"
              />
              <input
                value={form.subarea}
                onChange={(event) => setForm((prev) => ({ ...prev, subarea: event.target.value }))}
                className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm"
                placeholder="Subarea"
              />
              <textarea
                value={form.reason}
                onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm min-h-[90px]"
                placeholder="Reason"
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={form.confidence}
                onChange={(event) => setForm((prev) => ({ ...prev, confidence: event.target.value }))}
                className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm"
                placeholder="Confidence"
              />
              <input
                value={form.token}
                onChange={(event) => setForm((prev) => ({ ...prev, token: event.target.value }))}
                className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm"
                placeholder="Admin token"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 font-semibold disabled:opacity-60"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Siren size={15} />}
                {submitting ? 'Triggering...' : 'Send Manual Trigger'}
              </button>
            </form>

            <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${status.type === 'error' ? 'border-red-400/25 bg-red-500/10 text-red-200' : status.type === 'success' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>
              {status.message}
            </div>
          </section>

          <section className="glass rounded-2xl p-5 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold">Active Alerts</h2>
              <button
                type="button"
                onClick={fetchActiveSignals}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            {active.loading ? (
              <p className="text-sm text-slate-300">Loading alerts...</p>
            ) : active.error ? (
              <p className="text-sm text-red-300">{active.error}</p>
            ) : activeSignals.length ? (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {activeSignals.map((signal, index) => (
                  <motion.div
                    key={`${signal.source}-${signal.location}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{signal.reason || 'Active disruption signal'}</p>
                      <span className="text-[11px] px-2 py-1 rounded-full border border-white/20 bg-white/10">
                        {Math.round(Number(signal.confidence || 0) * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{signal.location || 'Unknown location'}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{signal.source || 'source'} • {new Date(signal.startTime || Date.now()).toLocaleString()}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                No active alerts found.
              </div>
            )}

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              <p className="inline-flex items-center gap-1"><ShieldAlert size={12} /> Alerts sent here immediately affect user-side disruption detection.</p>
              <p className="mt-1 inline-flex items-center gap-1"><AlertTriangle size={12} /> Use this only for controlled manual trigger scenarios.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminConsole;
