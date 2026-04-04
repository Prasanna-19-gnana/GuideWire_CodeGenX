import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, Phone, ShieldCheck, ArrowRight, ArrowLeft,
  CheckCircle, Loader2, RefreshCw, KeyRound,
  Smartphone, Fingerprint, User, MapPin, Bike, Lock, LogIn, FileText, X
} from 'lucide-react';
import insuranceManagementPolicy from '../../insurance_management_policy.md?raw';

/* ═══════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════ */
const API_BASE = 'http://localhost:3001/api';
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 120;
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const DELIVERY_RADIUS_LABEL = '5 km radius';

const STEPS = {
  MODE: 'MODE',
  EMAIL: 'EMAIL',
  OTP_EMAIL: 'OTP_EMAIL',
  PROFILE: 'PROFILE',
  PASSWORD: 'PASSWORD',
  LOGIN: 'LOGIN',
};

const APP_OPTIONS = ['Swiggy', 'Zomato', 'Blinkit', 'Zepto', 'Dunzo', 'Uber Eats', 'Other'];
const DELIVERY_MODES = ['Bike', 'Scooter', 'Cycle', 'EV', 'Car', 'On Foot'];

/* ═══════════════════════════════════════════════════════════════
   API HELPERS
   ═══════════════════════════════════════════════════════════════ */
async function apiCall(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Login({ onLogin }) {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [policyConfirmed, setPolicyConfirmed] = useState(false);
  const [showInsurancePolicy, setShowInsurancePolicy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
  });
  const [profile, setProfile] = useState({
    fullName: '',
    phone: '',
    appPlatforms: [],
    appOtherName: '',
    city: '',
    state: '',
    pincode: '',
    area: '',
    deliveryAreas: '',
    deliveryMode: 'Bike',
    weeklyRevenue: '',
    hoursPerWeek: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stepIndex = Object.values(STEPS).indexOf(step);

  const resetFlow = () => {
    setError('');
    setEmail('');
    setEmailVerified(false);
    setProfile({
      fullName: '',
      phone: '',
      appPlatforms: [],
      appOtherName: '',
      city: '',
      state: '',
      pincode: '',
      area: '',
      deliveryAreas: '',
      deliveryMode: 'Bike',
      weeklyRevenue: '',
      hoursPerWeek: '',
    });
    setPasswordForm({ password: '', confirmPassword: '' });
    setLoginForm({ email: '', password: '' });
    setPolicyConfirmed(false);
    setShowInsurancePolicy(false);
    setLocationStatus('');
  };

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setStep(nextMode === 'signup' ? STEPS.EMAIL : STEPS.LOGIN);
    resetFlow();
  };

  const buildDeliveryAreaSuggestion = (location, nearbyAreas = []) => {
    if (Array.isArray(nearbyAreas) && nearbyAreas.length) {
      return nearbyAreas.join(', ');
    }

    const area = String(location?.area || '').trim();
    const city = String(location?.city || '').trim();
    const state = String(location?.state || '').trim();
    const displayName = String(location?.displayName || '').trim();

    const displayParts = displayName
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .filter((part, index, arr) => arr.findIndex(item => item.toLowerCase() === part.toLowerCase()) === index);

    if (displayParts.length) return displayParts.join(', ');

    const fallbackParts = [area, city, state]
      .filter(Boolean)
      .filter((part, index, arr) => arr.findIndex(item => item.toLowerCase() === part.toLowerCase()) === index);

    return fallbackParts.join(', ');
  };

  const fetchNearbyAreas = async (latitude, longitude) => {
    const sanitizeNearbyNames = (names) => names
      .map(name => String(name || '').trim())
      .filter(Boolean)
      .filter(name => !/(road|street|industrial|highway|nh\b)/i.test(name))
      .filter((name, index, arr) => arr.findIndex(item => item.toLowerCase() === name.toLowerCase()) === index)
      .slice(0, 10);

    const fetchNearbyAreasFromNominatim = async () => {
      // Approximate 5km bounding box around current coordinates.
      const latDelta = 5 / 111;
      const lngDelta = 5 / (111 * Math.max(Math.cos((Number(latitude) * Math.PI) / 180), 0.2));

      const viewbox = [
        Number(longitude) - lngDelta,
        Number(latitude) + latDelta,
        Number(longitude) + lngDelta,
        Number(latitude) - latDelta,
      ].join(',');

      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('bounded', '1');
      url.searchParams.set('limit', '20');
      url.searchParams.set('viewbox', viewbox);

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();

      if (!Array.isArray(data)) return [];

      const names = data.map(item => {
        const addr = item?.address || {};
        return addr.suburb
          || addr.neighbourhood
          || addr.quarter
          || addr.village
          || addr.town
          || addr.city_district
          || addr.city
          || String(item?.display_name || '').split(',')[0]?.trim();
      });

      return sanitizeNearbyNames(names);
    };

    try {
      const res = await fetch(`${API_BASE}/nearby-areas?lat=${latitude}&lng=${longitude}&radiusKm=5`);
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.areas)) {
        const cleaned = sanitizeNearbyNames(data.areas);
        if (cleaned.length) return cleaned;
      }

      return await fetchNearbyAreasFromNominatim();
    } catch {
      try {
        return await fetchNearbyAreasFromNominatim();
      } catch {
        return [];
      }
    }
  };

  const resolvePincodeFromAddress = async ({ area, city, state }) => {
    const query = [area, city, state, 'India']
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(', ');

    if (!query) return '';

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '1');
      url.searchParams.set('q', query);

      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      const first = Array.isArray(data) ? data[0] : null;
      const postcode = String(first?.address?.postcode || first?.display_name?.match(/\b\d{6}\b/)?.[0] || '').trim();
      return postcode;
    } catch {
      return '';
    }
  };

  const applyLiveLocationToProfile = (location, overwrite = false, nearbyAreas = []) => {
    if (!location) return;

    const area = String(location.area || '').trim();
    const city = String(location.city || '').trim();
    const state = String(location.state || '').trim();
    const pincode = String(location.pincode || '').trim();
    const displayName = String(location.displayName || '').trim();
    const deliverySuggestion = buildDeliveryAreaSuggestion(location, nearbyAreas);

    setProfile(prev => ({
      ...prev,
      area: overwrite ? (area || prev.area) : (prev.area || area),
      city: overwrite ? (city || prev.city) : (prev.city || city),
      state: overwrite ? (state || prev.state) : (prev.state || state),
      pincode: overwrite ? (pincode || prev.pincode) : (prev.pincode || pincode),
      deliveryAreas: overwrite ? (deliverySuggestion || prev.deliveryAreas) : (prev.deliveryAreas || deliverySuggestion),
    }));

    const baseAddress = displayName || [area, city, state, pincode].filter(Boolean).join(', ');
    setLocationStatus(baseAddress
      ? `${baseAddress} · delivery area set for ${DELIVERY_RADIUS_LABEL}`
      : `Live address detected · delivery area set for ${DELIVERY_RADIUS_LABEL}`);
  };

  const hasUsableLocation = (location) => {
    if (!location) return false;
    const area = String(location.area || '').trim();
    const city = String(location.city || '').trim();
    const state = String(location.state || '').trim();
    const pincode = String(location.pincode || '').trim();
    const displayName = String(location.displayName || '').trim();
    return Boolean(area || city || state || pincode || displayName);
  };

  const applyCoordinateFallback = (latitude, longitude, nearbyAreas = []) => {
    setProfile(prev => ({
      ...prev,
      deliveryAreas: nearbyAreas.length ? nearbyAreas.join(', ') : prev.deliveryAreas,
    }));

    setLocationStatus(nearbyAreas.length
      ? `Location permission granted, but full address details were not resolved. Nearby delivery areas loaded.`
      : 'Location permission granted, but address details (area/city/state/pincode) could not be resolved. Please try again.');
  };

  const useCurrentLocation = async (manual = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('Live location is not available in this browser');
      return;
    }

    setLocationLoading(true);
    setLocationStatus(manual ? 'Fetching your current location...' : 'Detecting your live address...');

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords || {};
      const nearbyAreas = await fetchNearbyAreas(latitude, longitude);

      try {
        const res = await fetch(`${API_BASE}/reverse-geocode?lat=${latitude}&lng=${longitude}`);
        const data = await res.json();
        if (res.ok && data?.success && data.location) {
          let enrichedLocation = {
            ...data.location,
            pincode: String(data.location.pincode || data.location.displayName?.match(/\b\d{6}\b/)?.[0] || '').trim(),
          };

          if (!String(enrichedLocation.pincode || '').trim()) {
            const resolvedPincode = await resolvePincodeFromAddress(enrichedLocation);
            if (resolvedPincode) {
              enrichedLocation = { ...enrichedLocation, pincode: resolvedPincode };
            }
          }

          if (hasUsableLocation(enrichedLocation)) {
            applyLiveLocationToProfile(enrichedLocation, true, nearbyAreas);
          } else {
            throw new Error(data?.error || 'Reverse geocoding failed');
          }
        } else {
          throw new Error(data?.error || 'Reverse geocoding failed');
        }
      } catch {
        try {
          const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
          nominatimUrl.searchParams.set('format', 'jsonv2');
          nominatimUrl.searchParams.set('lat', String(latitude));
          nominatimUrl.searchParams.set('lon', String(longitude));
          nominatimUrl.searchParams.set('addressdetails', '1');
          nominatimUrl.searchParams.set('zoom', '18');

          const res = await fetch(nominatimUrl.toString(), {
            headers: { Accept: 'application/json' },
          });
          const data = await res.json();
          const addr = data?.address || {};
          const displayName = String(data?.display_name || '').trim();
          const inferredPincode = String(addr.postcode || displayName.match(/\b\d{6}\b/)?.[0] || '').trim();
          let location = {
            area: addr.suburb || addr.neighbourhood || addr.quarter || addr.hamlet || addr.village || addr.town || '',
            city: addr.city || addr.county || addr.town || addr.village || '',
            state: addr.state || '',
            pincode: inferredPincode,
            displayName,
          };

          if (!String(location.pincode || '').trim()) {
            const resolvedPincode = await resolvePincodeFromAddress(location);
            if (resolvedPincode) {
              location = { ...location, pincode: resolvedPincode };
            }
          }

          if (hasUsableLocation(location)) {
            applyLiveLocationToProfile(location, true, nearbyAreas);
          } else {
            applyCoordinateFallback(latitude, longitude, nearbyAreas);
          }
        } catch {
          applyCoordinateFallback(latitude, longitude, nearbyAreas);
        }
      }

      setLocationLoading(false);
    }, () => {
      setLocationLoading(false);
      setLocationStatus('Location permission is required to autofill address');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };

  useEffect(() => {
    if (mode !== 'signup' || step !== STEPS.PROFILE) return;
    if (profile.city || profile.state || profile.area || profile.deliveryAreas || locationLoading) return;
    useCurrentLocation(false);
  }, [mode, step]);

  /* ─── Email submit → calls real backend ─── */
  const handleEmailSubmit = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiCall('/send-email-otp', { email });
      setStep(STEPS.OTP_EMAIL);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleEmailOtpVerified = () => {
    setEmailVerified(true);
    setStep(STEPS.PROFILE);
  };

  const toggleAppPlatform = (platform) => {
    setProfile(prev => {
      const exists = prev.appPlatforms.includes(platform);
      return {
        ...prev,
        appPlatforms: exists
          ? prev.appPlatforms.filter(item => item !== platform)
          : [...prev.appPlatforms, platform],
      };
    });
  };

  const handleProfileSubmit = async () => {
    if (!profile.fullName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (profile.appPlatforms.length === 0) {
      setError('Select at least one app you work on');
      return;
    }

    if (profile.appPlatforms.includes('Other') && !profile.appOtherName.trim()) {
      setError('Please enter the app name for Other');
      return;
    }

    if (!profile.phone.trim() || !/^\d{10}$/.test(profile.phone.replace(/\D/g, ''))) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    if (!profile.city.trim() || !profile.state.trim() || !profile.area.trim() || !profile.pincode.trim()) {
      setError('Please provide live area, city, state, and pincode');
      return;
    }

    if (!profile.deliveryAreas.trim()) {
      setError('Please enter delivery areas');
      return;
    }

    if (!profile.weeklyRevenue || !profile.hoursPerWeek) {
      setError('Please enter weekly revenue and weekly hours');
      return;
    }

    setError('');
    setStep(STEPS.PASSWORD);
  };

  const completeRegistration = async () => {
    if (!policyConfirmed) {
      setError('Please confirm the Insurance Management checklist before creating the account');
      return;
    }

    if (!PASSWORD_RULE.test(passwordForm.password)) {
      setError('Password must be 8+ chars with uppercase, lowercase, number, and special character');
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/business-onboarding', {
        fullName: profile.fullName.trim(),
        email,
        phone: profile.phone.replace(/\D/g, ''),
        appPlatforms: profile.appPlatforms,
        appOtherName: profile.appOtherName.trim(),
        city: profile.city.trim(),
        state: profile.state.trim(),
        pincode: profile.pincode.trim(),
        area: profile.area.trim(),
        deliveryAreas: profile.deliveryAreas,
        deliveryMode: profile.deliveryMode,
        plan: 'Basic',
        weeklyRevenue: Number(profile.weeklyRevenue),
        hoursPerWeek: Number(profile.hoursPerWeek),
      });

      const registrationProfile = {
        id: data?.account?.id,
        email,
        phone: profile.phone.replace(/\D/g, ''),
        fullName: profile.fullName.trim(),
        appPlatforms: profile.appPlatforms,
        appOtherName: profile.appOtherName.trim(),
        city: profile.city.trim(),
        state: profile.state.trim(),
        pincode: profile.pincode.trim(),
        area: profile.area.trim(),
        deliveryAreas: profile.deliveryAreas,
        deliveryMode: profile.deliveryMode,
        weeklyIncome: profile.weeklyRevenue,
        workingHours: profile.hoursPerWeek,
        plan: 'Basic',
        weatherSummary: data.weatherSummary,
      };

      await apiCall('/register-account', {
        email,
        password: passwordForm.password,
        profile: registrationProfile,
      });

      const loginData = await apiCall('/login-account', {
        email,
        password: passwordForm.password,
      });

      onLogin(loginData.account || registrationProfile);
    } catch (err) {
      if (String(err.message).toLowerCase().includes('pattern')) {
        setError('Password must be 8+ chars with uppercase, lowercase, number, and special character');
      } else {
        setError(err.message);
      }
    }
    setLoading(false);
  };

  const handleLoginSubmit = async () => {
    if (!loginForm.email || !loginForm.password) {
      setError('Enter email and password');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/login-account', {
        email: loginForm.email,
        password: loginForm.password,
      });

      onLogin(data.account || { email: loginForm.email });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleAdminLoginSubmit = async () => {
    if (!adminForm.email.trim() || !adminForm.password) {
      setError('Enter admin email and password');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/admin/login', {
        email: adminForm.email,
        password: adminForm.password,
      });

      onLogin(data.account || {
        email: adminForm.email || 'admin@zyrosafe.local',
        role: 'admin',
      });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const goBack = () => {
    setError('');
    if (step === STEPS.PASSWORD) setStep(STEPS.PROFILE);
    if (step === STEPS.OTP_EMAIL) setStep(STEPS.EMAIL);
    else if (step === STEPS.PROFILE) setStep(STEPS.EMAIL);
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-6 relative overflow-hidden bg-[#050810]">
      {/* Ambient blobs */}
      <div className="absolute top-[6%] left-[6%] w-[560px] h-[560px] bg-blue-600/28 rounded-full blur-[170px] pointer-events-none" />
      <div className="absolute bottom-[6%] right-[8%] w-[460px] h-[460px] bg-indigo-600/24 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-[50%] left-[55%] w-[360px] h-[360px] bg-cyan-500/16 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 22% 18%, rgba(59,130,246,0.26) 0%, rgba(59,130,246,0) 54%)' }} />
      <motion.div
        aria-hidden="true"
        className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-blue-400/18 blur-[120px] pointer-events-none"
        animate={{ x: [0, 28, 0], y: [0, 16, 0], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -bottom-20 -right-20 w-[360px] h-[360px] rounded-full bg-indigo-400/20 blur-[110px] pointer-events-none"
        animate={{ x: [0, -24, 0], y: [0, -14, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[500px] relative z-10"
      >
        <div className="rounded-[2rem] p-8 relative bg-[#0b1329]/58 backdrop-blur-[30px] border border-blue-200/15 shadow-[0_32px_96px_rgba(0,0,0,0.48),0_0_0_1px_rgba(96,165,250,0.14),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/16 via-transparent to-indigo-400/14 pointer-events-none" />
          <div className="absolute -top-16 -left-16 h-52 w-52 rounded-full bg-blue-400/18 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-20 right-8 h-44 w-44 rounded-full bg-indigo-400/16 blur-2xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-200/70 to-transparent" />
          <motion.div
            aria-hidden="true"
            className="absolute -top-10 left-[22%] w-[55%] h-20 rounded-full bg-blue-100/18 blur-2xl pointer-events-none"
            animate={{ x: [0, 18, 0], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-blue-300/14 border border-blue-200/20 backdrop-blur-md flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <Fingerprint className="w-6 h-6 text-blue-200" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-white">
              Secure Verification
            </h1>
            <p className="text-slate-300 mt-1.5 text-xs">Multi-factor identity verification</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => selectMode('signup')}
                className={`px-3 py-1.5 rounded-full text-[10px] border backdrop-blur-md ${mode === 'signup' ? 'bg-blue-500/28 text-blue-100 border-blue-300/35 shadow-[0_10px_24px_rgba(59,130,246,0.26)]' : 'bg-slate-900/45 text-slate-300 border-slate-500/35'}`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => selectMode('login')}
                className={`px-3 py-1.5 rounded-full text-[10px] border backdrop-blur-md ${mode === 'login' ? 'bg-blue-500/28 text-blue-100 border-blue-300/35 shadow-[0_10px_24px_rgba(59,130,246,0.26)]' : 'bg-slate-900/45 text-slate-300 border-slate-500/35'}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => selectMode('admin')}
                className={`px-3 py-1.5 rounded-full text-[10px] border backdrop-blur-md ${mode === 'admin' ? 'bg-blue-500/28 text-blue-100 border-blue-300/35 shadow-[0_10px_24px_rgba(59,130,246,0.26)]' : 'bg-slate-900/45 text-slate-300 border-slate-500/35'}`}
              >
                Admin Login
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="flex items-center gap-1.5 mb-6 px-2">
              {Object.values(STEPS).filter(stepName => stepName !== STEPS.MODE && stepName !== STEPS.LOGIN).map((s, i) => (
                <div key={s} className="flex-1">
                  <div className={`h-1 rounded-full transition-all duration-500 ${
                    i < Math.max(stepIndex - 1, 0) ? 'bg-emerald-500' : i === Math.max(stepIndex - 1, 0) ? 'bg-blue-400' : 'bg-slate-600/50'
                  }`} />
                </div>
              ))}
            </div>
          )}

          {/* Step header + badges */}
          <div className="flex justify-between items-center mb-5 px-1">
            <div className="flex items-center gap-1.5">
              {mode === 'signup' && step !== STEPS.EMAIL && step !== STEPS.LOGIN && step !== STEPS.MODE && (
                <button type="button" onClick={goBack} className="text-slate-300 hover:text-white transition-colors p-1">
                  <ArrowLeft size={14} />
                </button>
              )}
              <StepLabel step={step} />
            </div>
            <div className="flex items-center gap-1.5">
              {emailVerified && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">
                  <CheckCircle size={9} /> Email
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence mode="popLayout">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 px-3 py-2 bg-red-500/14 border border-red-400/25 rounded-xl text-xs text-red-200"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps */}
          <AnimatePresence mode="wait">
            {mode === 'login' && step === STEPS.LOGIN && (
              <StepContainer key="login">
                <div className="space-y-4">
                  <NeuInput
                    icon={<Mail size={16} />}
                    type="email"
                    placeholder="Registered Email"
                    value={loginForm.email}
                    onChange={e => { setLoginForm(p => ({ ...p, email: e.target.value })); setError(''); }}
                    autoFocus
                  />
                  <NeuInput
                    icon={<Lock size={16} />}
                    type="password"
                    placeholder="Password"
                    value={loginForm.password}
                    onChange={e => { setLoginForm(p => ({ ...p, password: e.target.value })); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
                  />
                  <SubmitButton onClick={handleLoginSubmit} loading={loading}>
                    {loading ? 'Signing In...' : 'Login'}
                  </SubmitButton>
                </div>
              </StepContainer>
            )}

            {mode === 'admin' && step === STEPS.LOGIN && (
              <StepContainer key="admin-login">
                <div className="space-y-4">
                  <NeuInput
                    icon={<Mail size={16} />}
                    type="email"
                    placeholder="Admin Email"
                    value={adminForm.email}
                    onChange={e => { setAdminForm(p => ({ ...p, email: e.target.value })); setError(''); }}
                    autoFocus
                  />
                  <NeuInput
                    icon={<Lock size={16} />}
                    type="password"
                    placeholder="Admin Password"
                    value={adminForm.password}
                    onChange={e => { setAdminForm(p => ({ ...p, password: e.target.value })); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleAdminLoginSubmit()}
                  />
                  <SubmitButton onClick={handleAdminLoginSubmit} loading={loading}>
                    {loading ? 'Signing In...' : 'Login as Admin'}
                  </SubmitButton>
                </div>
              </StepContainer>
            )}

            {step === STEPS.EMAIL && (
              <StepContainer key="email">
                <div className="space-y-4">
                  <NeuInput
                    icon={<Mail size={16} />}
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-300 px-1">
                    A real 6-digit code will be sent to your email inbox
                  </p>
                  <SubmitButton onClick={handleEmailSubmit} loading={loading}>
                    {loading ? 'Sending OTP...' : 'Send Verification Code'}
                  </SubmitButton>
                </div>
              </StepContainer>
            )}

            {step === STEPS.OTP_EMAIL && (
              <StepContainer key="otp-email">
                <OtpVerification
                  target={email}
                  targetType="email"
                  icon={<Mail size={14} />}
                  verifyEndpoint="/verify-email-otp"
                  resendEndpoint="/send-email-otp"
                  verifyPayload={{ email }}
                  resendPayload={{ email }}
                  onVerified={handleEmailOtpVerified}
                />
              </StepContainer>
            )}

            {step === STEPS.PROFILE && (
              <StepContainer key="profile">
                <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
                  <div className="rounded-xl p-3 flex items-center gap-3 border border-blue-200/18 bg-slate-900/35 backdrop-blur-md">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/16 border border-emerald-300/25 flex items-center justify-center">
                      <ShieldCheck size={16} className="text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Identity Verified</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {maskEmail(email)} · {profile.phone ? `+91 ${maskPhone(profile.phone)}` : 'Phone pending'}
                      </p>
                    </div>
                  </div>

                  <NeuInput
                    icon={<User size={16} />}
                    type="text"
                    placeholder="Full Name"
                    value={profile.fullName}
                    onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))}
                    autoFocus
                  />

                  <NeuInput
                    icon={<Phone size={16} />}
                    type="tel"
                    placeholder="Phone Number"
                    value={profile.phone}
                    onChange={e => setProfile(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                  />

                  <div>
                    <label className="text-[9px] text-slate-300 uppercase tracking-[0.15em] mb-2 block font-bold">
                      Apps You Work On (Multi-Select)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {APP_OPTIONS.map(app => (
                        <button
                          key={app}
                          type="button"
                          onClick={() => toggleAppPlatform(app)}
                          className={`rounded-xl py-2 px-2 text-xs border transition-all duration-200 ${
                            profile.appPlatforms.includes(app)
                              ? '!bg-white !border-white !text-black shadow-[0_8px_20px_rgba(0,0,0,0.15)]'
                              : 'bg-slate-900/45 border-slate-500/35 text-slate-300 hover:border-blue-300/35'
                          }`}
                        >
                          {app}
                        </button>
                      ))}
                    </div>
                  </div>

                  {profile.appPlatforms.includes('Other') && (
                    <NeuInput
                      icon={<Smartphone size={16} />}
                      type="text"
                      placeholder="Other App Name"
                      value={profile.appOtherName}
                      onChange={e => setProfile(p => ({ ...p, appOtherName: e.target.value }))}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <NeuInput
                      icon={<MapPin size={16} />}
                      type="text"
                      placeholder="City"
                      value={profile.city}
                      onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                      readOnly
                      textClassName="text-black placeholder-slate-500"
                    />
                    <NeuInput
                      icon={<MapPin size={16} />}
                      type="text"
                      placeholder="State"
                      value={profile.state}
                      onChange={e => setProfile(p => ({ ...p, state: e.target.value }))}
                      readOnly
                      textClassName="text-black placeholder-slate-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <NeuInput
                      icon={<MapPin size={16} />}
                      type="text"
                      placeholder="Area"
                      value={profile.area}
                      onChange={e => setProfile(p => ({ ...p, area: e.target.value }))}
                      readOnly
                      textClassName="text-black placeholder-slate-500"
                    />

                    <NeuInput
                      icon={<MapPin size={16} />}
                      type="text"
                      placeholder="Pincode"
                      value={profile.pincode}
                      onChange={e => setProfile(p => ({ ...p, pincode: e.target.value }))}
                      readOnly
                      textClassName="text-black placeholder-slate-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">

                    <button
                      type="button"
                      onClick={() => useCurrentLocation(true)}
                      disabled={locationLoading}
                      className="w-full py-2.5 px-3 rounded-xl text-xs border transition-all duration-200 bg-slate-900/45 backdrop-blur-md border-blue-200/25 text-slate-200 hover:bg-slate-900/62 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <MapPin size={14} />
                      {locationLoading ? 'Detecting Location...' : 'Use Current Location'}
                    </button>
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-300 uppercase tracking-[0.15em] mb-2 block font-bold">
                      Delivery Areas (comma separated)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ameerpet, Madhapur, Gachibowli"
                      value={profile.deliveryAreas}
                      onChange={e => setProfile(p => ({ ...p, deliveryAreas: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-sm text-slate-100 placeholder-slate-400 bg-slate-900/45 backdrop-blur-md border border-blue-200/22 outline-none focus:border-blue-300/45"
                    />
                    <p className="text-[10px] text-slate-300 px-1 mt-1">
                        {locationLoading ? 'Autofilling from live address...' : locationStatus || `Live address will autofill city, state, area, and delivery areas within ${DELIVERY_RADIUS_LABEL}.`}
                    </p>
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-300 uppercase tracking-[0.15em] mb-2 block font-bold">
                      Mode Of Delivery (Vehicle)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {DELIVERY_MODES.map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setProfile(prev => ({ ...prev, deliveryMode: mode }))}
                          className={`rounded-xl py-2 px-2 text-[11px] border transition-all duration-200 ${
                            profile.deliveryMode === mode
                              ? 'bg-blue-500/26 border-blue-300/35 text-blue-100 shadow-[0_8px_20px_rgba(59,130,246,0.25)]'
                              : 'bg-slate-900/45 border-slate-500/35 text-slate-300 hover:border-blue-300/35'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <NeuInput
                      icon={<Bike size={16} />}
                      type="number"
                      placeholder="Weekly Revenue ₹"
                      value={profile.weeklyRevenue}
                      onChange={e => setProfile(p => ({ ...p, weeklyRevenue: e.target.value }))}
                    />
                    <NeuInput
                      icon={<ShieldCheck size={16} />}
                      type="number"
                      placeholder="Hours / Week"
                      value={profile.hoursPerWeek}
                      onChange={e => setProfile(p => ({ ...p, hoursPerWeek: e.target.value }))}
                    />
                  </div>

                  <p className="text-[10px] text-slate-300 px-1">
                    Weather validation is connected automatically via secure server integration.
                  </p>

                  <SubmitButton onClick={handleProfileSubmit} loading={loading}>
                    {loading ? 'Validating...' : 'Continue to Password'}
                  </SubmitButton>
                </div>
              </StepContainer>
            )}

            {step === STEPS.PASSWORD && (
              <StepContainer key="password">
                <div className="space-y-4">
                  <div className="rounded-xl p-3 border border-blue-200/18 bg-slate-900/35 backdrop-blur-md text-[10px] text-slate-300">
                    Create a password to secure your account and sign in later without repeating OTP verification.
                  </div>
                  <NeuInput
                    icon={<Lock size={16} />}
                    type="password"
                    placeholder="Create Password"
                    autoComplete="new-password"
                    value={passwordForm.password}
                    onChange={e => { setPasswordForm(p => ({ ...p, password: e.target.value })); setError(''); }}
                    autoFocus
                  />
                  <NeuInput
                    icon={<Lock size={16} />}
                    type="password"
                    placeholder="Confirm Password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={e => { setPasswordForm(p => ({ ...p, confirmPassword: e.target.value })); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && completeRegistration()}
                  />

                  <div className="rounded-xl p-3 border border-blue-200/18 bg-slate-900/35 backdrop-blur-md">
                    <div className="flex items-start gap-3">
                      <input
                        id="insurance-management-checklist"
                        type="checkbox"
                        checked={policyConfirmed}
                        onChange={(e) => {
                          setPolicyConfirmed(e.target.checked);
                          setError('');
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-blue-200/40 bg-transparent accent-blue-500"
                      />
                      <div className="flex-1">
                        <label htmlFor="insurance-management-checklist" className="text-[11px] text-slate-100 font-semibold cursor-pointer">
                          Checklist: Insurance Management
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowInsurancePolicy(true)}
                          className="mt-1 text-[11px] text-blue-200 hover:text-blue-100 transition-colors flex items-center gap-1"
                        >
                          <FileText size={12} />
                          Insurance Management
                        </button>
                        <p className="text-[10px] text-slate-300 mt-1">
                          You must review and confirm this checklist before account creation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <SubmitButton onClick={completeRegistration} loading={loading}>
                    {loading ? 'Creating Account...' : 'Create Password & Finish'}
                  </SubmitButton>
                </div>
              </StepContainer>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showInsurancePolicy && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-[120] flex items-center justify-center p-4 sm:p-6"
              >
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="w-[95vw] max-w-[1400px] h-[92vh] rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] overflow-hidden"
                >
                  <div className="sticky top-0 z-10 px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Insurance Management</h2>
                      <p className="text-xs text-slate-500">Review the full policy before confirming the checklist.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInsurancePolicy(false)}
                      className="h-8 w-8 rounded-lg border border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 flex items-center justify-center"
                      aria-label="Close policy"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto h-[calc(92vh-84px)] bg-white">
                    <div className="rounded-xl bg-white border border-slate-200 p-5">
                      <pre className="whitespace-pre-wrap text-[13px] leading-7 text-slate-800 font-sans m-0">
                        {insuranceManagementPolicy}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OTP VERIFICATION — calls real backend
   ═══════════════════════════════════════════════════════════════ */
function OtpVerification({ target, targetType, icon, verifyEndpoint, resendEndpoint, verifyPayload, resendPayload, onVerified }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(OTP_EXPIRY_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef([]);
  const autoVerifyRef = useRef(false);

  // Countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Auto-verify
  useEffect(() => {
    const code = otp.join('');
    if (code.length === OTP_LENGTH && !verifying && !verified && !autoVerifyRef.current) {
      autoVerifyRef.current = true;
      verifyOtp(code);
    }
  }, [otp]);

  async function verifyOtp(code) {
    setVerifying(true);
    setError('');
    try {
      await apiCall(verifyEndpoint, { ...verifyPayload, otp: code });
      setVerified(true);
      setTimeout(() => onVerified(), 800);
    } catch (err) {
      setError(err.message);
      setOtp(Array(OTP_LENGTH).fill(''));
      autoVerifyRef.current = false;
      inputRefs.current[0]?.focus();
    }
    setVerifying(false);
  }

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];

    if (value.length > 1) {
      const digits = value.slice(0, OTP_LENGTH).split('');
      digits.forEach((d, i) => { if (index + i < OTP_LENGTH) newOtp[index + i] = d; });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));
    autoVerifyRef.current = false;
    try {
      await apiCall(resendEndpoint, resendPayload);
      setTimer(OTP_EXPIRY_SECONDS);
    } catch (err) {
      setError(err.message);
    }
    setResending(false);
    inputRefs.current[0]?.focus();
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-3 flex items-center gap-3 border border-blue-200/18 bg-slate-900/38 backdrop-blur-md">
        <div className="w-8 h-8 rounded-lg bg-blue-300/12 border border-blue-200/20 flex items-center justify-center text-blue-200">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-300">Code sent to</p>
          <p className="text-xs text-slate-100 font-medium truncate">
            {targetType === 'email' ? target : `+91 ${target}`}
          </p>
        </div>
        <div className={`text-xs font-mono font-bold ${timer <= 30 ? 'text-red-300' : 'text-slate-300'}`}>
          {fmt(timer)}
        </div>
      </div>

      {/* OTP boxes */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
          <motion.div key={i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <input
              ref={el => inputRefs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              value={otp[i]}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.target.select()}
              disabled={verifying || verified}
              autoFocus={i === 0}
              className={`w-11 text-center text-lg font-bold font-heading rounded-xl outline-none transition-all duration-300 border ${
                verified
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : otp[i]
                    ? 'bg-white/92 backdrop-blur-sm border-blue-300/55 text-slate-900 shadow-[0_10px_24px_rgba(0,0,0,0.25)]'
                    : 'bg-white/60 backdrop-blur-sm border-white/85 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]'
              } ${verifying ? 'animate-pulse' : ''}`}
              style={{ height: '52px' }}
            />
          </motion.div>
        ))}
      </div>

      {/* Status */}
      <AnimatePresence mode="wait">
        {verifying && (
          <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-xs text-blue-400">
            <Loader2 size={14} className="animate-spin" /> Verifying...
          </motion.div>
        )}
        {verified && (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 text-xs text-emerald-300">
            <CheckCircle size={14} /> Verified successfully!
          </motion.div>
        )}
        {error && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-center text-xs text-red-300">{error}</motion.div>
        )}
      </AnimatePresence>

      {/* Resend */}
      {!verified && (
        <div className="text-center">
          {timer > 0 ? (
            <p className="text-[10px] text-slate-300">
              Didn't receive it? Resend in {fmt(timer)}
            </p>
          ) : (
            <button type="button" onClick={handleResend} disabled={resending}
              className="text-[10px] text-blue-300 hover:text-blue-200 transition-colors flex items-center gap-1 mx-auto">
              <RefreshCw size={10} className={resending ? 'animate-spin' : ''} />
              {resending ? 'Sending...' : 'Resend Code'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED SUBCOMPONENTS
   ═══════════════════════════════════════════════════════════════ */
function StepContainer({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >{children}</motion.div>
  );
}

function StepLabel({ step }) {
  const labels = {
    [STEPS.MODE]: { icon: <LogIn size={13} />, text: 'Choose Account Type' },
    [STEPS.LOGIN]: { icon: <LogIn size={13} />, text: 'Login' },
    [STEPS.EMAIL]: { icon: <Mail size={13} />, text: 'Email Verification' },
    [STEPS.OTP_EMAIL]: { icon: <KeyRound size={13} />, text: 'Enter Email OTP' },
    [STEPS.PROFILE]: { icon: <ShieldCheck size={13} />, text: 'Business Setup' },
    [STEPS.PASSWORD]: { icon: <Lock size={13} />, text: 'Create Password' },
  };
  const { icon, text } = labels[step];
  return <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">{icon} {text}</div>;
}

function NeuInput({ icon, prefix, autoFocus, textClassName = '', ...props }) {
  const [focused, setFocused] = useState(false);
  const mergedInputStyle = {
    ...(props.style || {}),
    color: '#000000',
    WebkitTextFillColor: '#000000',
  };

  return (
    <div className={`relative group transition-all duration-300 ${focused ? 'scale-[1.01]' : ''}`}>
      <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors duration-300 ${focused ? 'text-blue-200' : 'text-slate-300'}`}>
        {icon}
      </div>
      {prefix && (
        <div className="absolute inset-y-0 left-10 flex items-center text-xs text-slate-400 font-mono pointer-events-none">{prefix}</div>
      )}
      <input
        {...props}
        style={mergedInputStyle}
        autoFocus={autoFocus}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        className={`w-full ${prefix ? 'pl-[4.5rem]' : 'pl-11'} pr-4 py-3 rounded-xl text-sm transition-all duration-300 outline-none
          ${focused
            ? `bg-white/95 backdrop-blur-md border-blue-300/45 shadow-[0_14px_30px_rgba(0,0,0,0.22)] ${textClassName || 'text-black'} placeholder-slate-500`
            : `bg-white/90 backdrop-blur-md border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${textClassName || 'text-black'} placeholder-slate-500`
          } border`}
      />
    </div>
  );
}

function SubmitButton({ onClick, loading, children }) {
  return (
    <motion.button
      type="button"
      whileHover={!loading ? { scale: 1.01, boxShadow: '0 14px 34px rgba(15,23,42,0.22)' } : {}}
      whileTap={!loading ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={loading}
      className="w-full py-3.5 bg-gradient-to-r from-blue-600/85 to-indigo-600/85 backdrop-blur-md rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 border border-blue-300/30 shadow-lg shadow-blue-900/35 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
      {!loading && <ArrowRight size={14} />}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local[0]}${'•'.repeat(Math.max(local.length - 2, 1))}${local.slice(-1)}@${domain}`;
}

function maskPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `${'•'.repeat(digits.length - 4)} ${digits.slice(-4)}`;
}
