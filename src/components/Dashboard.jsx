import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Activity, CloudRain,
  MapPin, AlertTriangle, Landmark,
  CheckCircle, Search, FileText, Zap,
  CloudLightning, Flame, Ban, Radio, ListOrdered, LayoutDashboard, User, Menu, Headset, X, Bell
} from 'lucide-react';
import IdleSimulationMap from './IdleSimulationMap';
import {
  calculatePayout,
  fetchDisruptionZone,
  postClaimPayoutTransaction,
  postFraudCheck,
} from '../services/mobilityService';

import earlyMorningBg from '../../clouds_bg.jpg';

const API_BASE = 'http://localhost:3001/api';
const WEEKLY_PAYOUT_CAP = 1500;
const API_TIMEOUT = 8000; // 8 second timeout for API calls
const WEEKLY_PREMIUM_RATES = {
  Basic: 0.05,
  Standard: 0.07,
  Premium: 0.1,
};

let razorpayCheckoutScriptPromise = null;

// Helper for controlled fetch with timeout
const fetchWithTimeout = (url, options = {}, timeout = API_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  return fetch(url, { ...options, signal: controller.signal })
    .then(res => {
      clearTimeout(timeoutId);
      return res;
    })
    .catch(err => {
      clearTimeout(timeoutId);
      throw err;
    });
};

const loadRazorpayCheckout = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout can only load in the browser'));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (!razorpayCheckoutScriptPromise) {
    razorpayCheckoutScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
      document.body.appendChild(script);
    });
  }

  return razorpayCheckoutScriptPromise;
};

const getWeeklyPremiumDetails = (profile = {}) => {
  const plan = String(profile.plan || 'Basic');
  const weeklyIncome = Number(profile.weeklyIncome || profile.weeklyRevenue || 0);
  const rate = WEEKLY_PREMIUM_RATES[plan] ?? WEEKLY_PREMIUM_RATES.Basic;
  const amount = Number((weeklyIncome * rate).toFixed(2));

  return { plan, weeklyIncome, rate, amount };
};

/* ═══════════════════════════════════════════════════════════════
   DISRUPTION PRESETS — maps to README thresholds
   ═══════════════════════════════════════════════════════════════ */
const PRESETS = {
  'Moderate Rain': { rainfall: 52, temperature: 30, event: 'None' },
  'Severe Rain':   { rainfall: 80, temperature: 28, event: 'None' },
  'Heat':          { rainfall: 0,  temperature: 48, event: 'None' },
  'Cyclone':       { rainfall: 90, temperature: 24, event: 'Cyclone' },
  'Curfew':        { rainfall: 0,  temperature: 30, event: 'Curfew' },
};

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
export default function Dashboard({ userProfile, onLogout }) {
  const [activePage, setActivePage] = useState('OPERATIONS');
  const [profileState, setProfileState] = useState(userProfile || {});
  const [isEditingUserInfo, setIsEditingUserInfo] = useState(false);
  const [userInfoForm, setUserInfoForm] = useState({
    name: '',
    phone: '',
    plan: 'Basic',
    deliveryMode: '',
    city: '',
    state: '',
    weeklyIncome: '',
    workingHours: '',
  });
  const [sim, setSim] = useState({
    mode: 'SIMULATION',
    rainfall: 0,
    temperature: 30,
    event: 'None',
  });
  const [triggerSource, setTriggerSource] = useState('manual');

  const [claim, setClaim] = useState({
    status: null,
    riskScore: 15,
    payout: 0,
    reason: '',
  });

  const [liveWeather, setLiveWeather] = useState(userProfile?.weatherSummary || null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherTrend, setWeatherTrend] = useState(null);
  const [socialAlertState, setSocialAlertState] = useState({ loading: false, data: null, error: '' });
  const [geoPosition, setGeoPosition] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [geoAddress, setGeoAddress] = useState(null);
  const [gpsHistory, setGpsHistory] = useState([]);
  const [activityState, setActivityState] = useState({
    isVisible: typeof document === 'undefined' ? true : !document.hidden,
    lastInteractionAt: Date.now(),
    lastVisibilityChangeAt: Date.now(),
    interactionCount: 0,
  });
  const geoLookupRef = useRef({ lat: null, lng: null, ts: 0 });
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [weeklyPaymentState, setWeeklyPaymentState] = useState({
    loading: false,
    message: '',
    error: '',
    paid: false,
    paidAt: '',
  });
  const [pipelineState, setPipelineState] = useState({
    gpsSent: false,
    fraudStored: false,
    transactionCreated: false,
    fraudScore: null,
    decision: null,
  });
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showFlowPopup, setShowFlowPopup] = useState(false);
  const [showSupportConstructionPopup, setShowSupportConstructionPopup] = useState(false);
  const [mapMarkerStatus, setMapMarkerStatus] = useState('normal');
  const [mapFraudResult, setMapFraudResult] = useState({ riskScore: null, status: 'normal', reasons: [] });
  const [mapAlerts, setMapAlerts] = useState([]);
  const lastFraudCallRef = useRef(0);
  const lastPayoutRef = useRef({ key: '', ts: 0 });
  const lastLocationRef = useRef(null);
  const autoTriggerSignatureRef = useRef('');
  const flowPopupTimerRef = useRef(null);
  const hamburgerMenuRef = useRef(null);

  const [time, setTime] = useState(new Date());
  const lockedLiveCity = geoAddress?.city || profileState?.city || '';
  const lockedLiveState = geoAddress?.state || profileState?.state || '';
  const userEmail = String(
    profileState?.email ||
    profileState?.userEmail ||
    profileState?.contactEmail ||
    ''
  ).toLowerCase();
  const transactionCacheKey = userEmail ? `zyrosafe.transactions.${userEmail}` : null;

  const readLocalTransactions = useCallback(() => {
    if (!transactionCacheKey || typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(transactionCacheKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [transactionCacheKey]);

  const writeLocalTransactions = useCallback((rows) => {
    if (!transactionCacheKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(transactionCacheKey, JSON.stringify(rows));
    } catch {
      // Ignore quota / storage failures.
    }
  }, [transactionCacheKey]);

  const weeklyPremiumDetails = getWeeklyPremiumDetails(profileState || userProfile || {});
  const notifications = useMemo(() => {
    if (weeklyPaymentState.paid) return [];
    if (!Number.isFinite(weeklyPremiumDetails.amount) || weeklyPremiumDetails.amount <= 0) return [];

    return [{
      id: 'weekly-subscription-due',
      title: 'Weekly subscription payment due',
      message: `Pay INR ${weeklyPremiumDetails.amount.toFixed(2)} to keep coverage active.`,
    }];
  }, [weeklyPaymentState.paid, weeklyPremiumDetails.amount]);

  useEffect(() => {
    const completedWeeklyTransactions = transactions
      .filter(txn => txn?.type === 'weekly_premium_subscription' && String(txn?.status || '').toLowerCase() === 'completed')
      .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());

    const latestWeeklyTransaction = completedWeeklyTransactions[0];
    const paidAtValue = latestWeeklyTransaction?.metadata?.paidAt || latestWeeklyTransaction?.timestamp || '';
    const paidAtMs = Date.parse(paidAtValue);
    const isPaidThisWeek = Boolean(latestWeeklyTransaction) && (!Number.isFinite(paidAtMs) || (Date.now() - paidAtMs) < (7 * 24 * 60 * 60 * 1000));
    const paidAtLabel = paidAtValue ? new Date(paidAtValue).toLocaleString() : '';

    setWeeklyPaymentState(prev => {
      if (prev.paid === isPaidThisWeek && prev.paidAt === paidAtLabel) return prev;
      return {
        ...prev,
        paid: isPaidThisWeek,
        paidAt: isPaidThisWeek ? paidAtLabel : '',
        message: isPaidThisWeek ? (prev.message || 'Weekly due paid successfully.') : prev.message,
      };
    });
  }, [transactions]);

  const mergeTransactions = useCallback((serverRows = [], localRows = []) => {
    const merged = [...serverRows, ...localRows];
    return Array.from(new Map(merged.map(txn => [txn.id, txn])).values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  const syncLocalTransactions = useCallback(async (pendingRows = []) => {
    if (!pendingRows.length || !userEmail) return [];

    const syncedRows = [];
    const stillPending = [];

    for (const txn of pendingRows) {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            userId: userProfile?.id,
            id: txn.id,
            type: txn.type,
            status: txn.status,
            amount: txn.amount,
            description: txn.description,
            metadata: txn.metadata,
          }),
        }, API_TIMEOUT);

        if (!res.ok) {
          stillPending.push(txn);
          continue;
        }

        const payload = await res.json().catch(() => ({}));
        if (payload?.transaction) {
          syncedRows.push(payload.transaction);
        }
      } catch {
        stillPending.push(txn);
      }
    }

    writeLocalTransactions(stillPending);
    return syncedRows;
  }, [userEmail, userProfile?.id, writeLocalTransactions]);

  useEffect(() => {
    setProfileState(userProfile || {});
  }, [userProfile]);

  useEffect(() => {
    const source = userProfile || {};
    setUserInfoForm({
      name: source?.name || source?.fullName || source?.businessName || '',
      phone: source?.phone || '',
      plan: source?.plan || 'Basic',
      deliveryMode: source?.deliveryMode || '',
      city: geoAddress?.city || source?.city || '',
      state: geoAddress?.state || source?.state || '',
      weeklyIncome: String(source?.weeklyIncome || ''),
      workingHours: String(source?.workingHours || ''),
    });
  }, [userProfile, geoAddress?.city, geoAddress?.state]);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const markInteraction = () => {
      setActivityState(prev => ({
        ...prev,
        lastInteractionAt: Date.now(),
        interactionCount: prev.interactionCount + 1,
      }));
    };

    const markVisibility = () => {
      setActivityState(prev => ({
        ...prev,
        isVisible: typeof document === 'undefined' ? true : !document.hidden,
        lastVisibilityChangeAt: Date.now(),
      }));
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(eventName => window.addEventListener(eventName, markInteraction, { passive: true }));
    window.addEventListener('focus', markInteraction);
    document.addEventListener('visibilitychange', markVisibility);

    return () => {
      events.forEach(eventName => window.removeEventListener(eventName, markInteraction));
      window.removeEventListener('focus', markInteraction);
      document.removeEventListener('visibilitychange', markVisibility);
    };
  }, []);

  const fetchLiveWeather = useCallback(async () => {
    const city = userProfile?.city;
    const state = userProfile?.state;
    if (!city || !state) return;

    setWeatherLoading(true);
    setWeatherError('');
    try {
      const query = new URLSearchParams({ city, state }).toString();
      const res = await fetchWithTimeout(`${API_BASE}/live-weather?${query}`, {}, API_TIMEOUT);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to fetch live weather');
      setLiveWeather(data.weatherSummary);
      setWeatherError('');
    } catch (err) {
      console.warn('Live weather fetch failed:', err.message);
      setWeatherError(err.message);
    }
    setWeatherLoading(false);
  }, [userProfile?.city, userProfile?.state]);

  const fetchWeatherTrend = useCallback(async () => {
    const city = userProfile?.city;
    const state = userProfile?.state;
    if (!city || !state) return;

    try {
      const query = new URLSearchParams({ city, state }).toString();
      const res = await fetchWithTimeout(`${API_BASE}/weather-probability?${query}`, {}, API_TIMEOUT);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to fetch weather trend');
      setWeatherTrend(data.probabilitySummary);
    } catch (err) {
      console.warn('Weather trend fetch failed:', err.message);
    }
  }, [userProfile?.city, userProfile?.state]);

  const fetchSocialAlerts = useCallback(async () => {
  const city = String(geoAddress?.city || profileState?.city || userProfile?.city || '').trim();
  const state = String(geoAddress?.state || profileState?.state || userProfile?.state || '').trim();
  const subarea = String(geoAddress?.area || profileState?.area || '').trim();
  if (!city && !state) return;

  setSocialAlertState(prev => ({ ...prev, loading: true, error: '' }));
  try {
    const query = new URLSearchParams();
    if (city) query.set('city', city);
    if (state) query.set('state', state);
    if (subarea) query.set('subarea', subarea);
    const res = await fetchWithTimeout(`${API_BASE}/social-disruption/active?${query.toString()}`, {}, API_TIMEOUT);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Unable to fetch social alerts');
    setSocialAlertState({ loading: false, data, error: '' });
  } catch (err) {
    setSocialAlertState({ loading: false, data: null, error: err.message || 'Unable to fetch social alerts' });
  }
  }, [geoAddress?.area, geoAddress?.city, geoAddress?.state, profileState?.area, profileState?.city, profileState?.state, userProfile?.city, userProfile?.state]);

  const recordGpsSample = useCallback((sample) => {
    if (!sample) return;
    setGpsHistory(prev => [...prev, sample].slice(-8));
  }, []);

  const pushMapAlert = useCallback((type, message) => {
    const row = {
      id: crypto.randomUUID(),
      type,
      message,
      ts: Date.now(),
    };

    setMapAlerts(prev => [row, ...prev].slice(0, 5));
  }, []);

  const handleLocationUpdate = useCallback(async (sample, { source = 'simulation' } = {}) => {
    if (!sample || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lng) || !userEmail) return;

    const normalizedSample = {
      lat: Number(sample.lat),
      lng: Number(sample.lng),
      accuracy: Number(sample.accuracy || 0),
      ts: Number(sample.timestamp || sample.ts || Date.now()),
    };

    setGeoPosition(normalizedSample);
    recordGpsSample(normalizedSample);

    const now = Date.now();
    const sinceLastCall = now - lastFraudCallRef.current;
    const previous = lastLocationRef.current;
    const movedEnough = !previous
      || Math.abs(normalizedSample.lat - previous.lat) > 0.00003
      || Math.abs(normalizedSample.lng - previous.lng) > 0.00003;

    if (sinceLastCall < 2500 || !movedEnough) {
      return;
    }

    lastFraudCallRef.current = now;
    lastLocationRef.current = { lat: normalizedSample.lat, lng: normalizedSample.lng };

    try {
      const fraud = await postFraudCheck({
        email: userEmail,
        gps: {
          lat: normalizedSample.lat,
          lng: normalizedSample.lng,
          accuracy: normalizedSample.accuracy,
          ts: normalizedSample.ts,
        },
      });

      setMapFraudResult(fraud);
      setMapMarkerStatus(fraud.status);

      if (fraud.status === 'flagged') {
        pushMapAlert('warning', 'Fraud risk detected');
      }

      if (fraud.status === 'rejected') {
        pushMapAlert('error', 'Fraud risk detected');
        return;
      }

      pushMapAlert('success', 'Claim approved');

      const zone = await fetchDisruptionZone({
        lat: normalizedSample.lat,
        lng: normalizedSample.lng,
        city: lockedLiveCity || profileState?.city || '',
        state: lockedLiveState || profileState?.state || '',
        subarea: geoAddress?.area || profileState?.area || '',
      });

      if (!zone?.active) return;

      const lostHours = Number(zone?.social_disruption_score || 0) >= 0.75 ? 6 : 3;
      const payoutAmount = calculatePayout({
        weeklyIncome: Number(profileState?.weeklyIncome || userProfile?.weeklyIncome || 0),
        workingHours: Number(profileState?.workingHours || userProfile?.workingHours || 0),
        lostHours,
        plan: profileState?.plan || userProfile?.plan || 'Basic',
      });

      if (payoutAmount <= 0) return;

      const payoutKey = `${zone?.primary?.id || zone?.primary?.reason || 'zone'}:${Math.floor(now / (5 * 60 * 1000))}`;
      if (lastPayoutRef.current.key === payoutKey && (now - lastPayoutRef.current.ts) < 5 * 60 * 1000) {
        return;
      }

      const transactionResponse = await postClaimPayoutTransaction({
        email: userEmail,
        amount: payoutAmount,
        description: 'Auto-triggered disruption payout',
        metadata: {
          source,
          mapDriven: true,
          riskScore: fraud.riskScore,
          reasons: fraud.reasons,
          gps: normalizedSample,
          disruption: zone?.primary || null,
          lostHours,
        },
      });

      if (transactionResponse?.success) {
        lastPayoutRef.current = { key: payoutKey, ts: now };
        pushMapAlert('success', `Payout INR ${payoutAmount.toFixed(2)} triggered`);
        fetchTransactions();
      }
    } catch (error) {
      pushMapAlert('error', error.message || 'Unable to process map update');
    }
  }, [
    geoAddress?.area,
    lockedLiveCity,
    lockedLiveState,
    profileState?.area,
    profileState?.city,
    profileState?.plan,
    profileState?.state,
    profileState?.weeklyIncome,
    profileState?.workingHours,
    pushMapAlert,
    recordGpsSample,
    userEmail,
    userProfile?.plan,
    userProfile?.weeklyIncome,
    userProfile?.workingHours,
  ]);

  useEffect(() => {
    const onDocumentPointerDown = (event) => {
      if (!showHamburgerMenu) return;
      if (hamburgerMenuRef.current?.contains(event.target)) return;
      setShowHamburgerMenu(false);
    };

    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
  }, [showHamburgerMenu]);

  const fetchTransactions = useCallback(async () => {
    if (!userEmail) return;
    setTransactionsLoading(true);
    try {
      const pendingLocalRows = readLocalTransactions().filter(txn => txn?.status === 'pending');
      const syncedRows = await syncLocalTransactions(pendingLocalRows);
      const query = new URLSearchParams({ email: userEmail, userId: userProfile?.id || '' }).toString();
      const res = await fetchWithTimeout(`${API_BASE}/transactions?${query}`, {}, API_TIMEOUT);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to fetch transactions');
      const serverRows = Array.isArray(data.transactions) ? data.transactions : [];
      if (data?.source && data.source !== 'memory' && data.source !== 'memory-fallback') {
        writeLocalTransactions([]);
      }
      if (data?.source === 'memory' || data?.source === 'memory-fallback') {
        setTransactions(prev => mergeTransactions(prev, [...serverRows, ...syncedRows, ...readLocalTransactions()]));
      } else {
        setTransactions(mergeTransactions([...serverRows, ...syncedRows]));
      }
    } catch (err) {
      console.warn('Transactions fetch failed:', err.message);
      setTransactions(prev => mergeTransactions(prev, readLocalTransactions()));
    }
    setTransactionsLoading(false);
  }, [userEmail, userProfile?.id, mergeTransactions, readLocalTransactions, syncLocalTransactions, writeLocalTransactions]);

  const fetchGeoAddress = useCallback(async (lat, lng) => {
    try {
      const query = new URLSearchParams({ lat: String(lat), lng: String(lng) }).toString();
      const res = await fetchWithTimeout(`${API_BASE}/reverse-geocode?${query}`, {}, API_TIMEOUT);
      const data = await res.json();
      if (res.ok && data?.success && data.location) {
        setGeoAddress(data.location);
        return;
      }
    } catch {
      // fallback to direct lookup below
    }

    try {
      const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
      nominatimUrl.searchParams.set('format', 'jsonv2');
      nominatimUrl.searchParams.set('lat', String(lat));
      nominatimUrl.searchParams.set('lon', String(lng));
      nominatimUrl.searchParams.set('addressdetails', '1');

      const res = await fetchWithTimeout(nominatimUrl.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      }, API_TIMEOUT);
      const data = await res.json();
      const addr = data?.address || {};
      if (!res.ok) return;

      setGeoAddress({
        area: addr.suburb || addr.neighbourhood || addr.quarter || addr.hamlet || addr.village || addr.town || '',
        city: addr.city || addr.county || addr.town || addr.village || '',
        state: addr.state || '',
        country: addr.country || '',
        displayName: data?.display_name || '',
      });
    } catch {
      // best effort: keep existing location display
    }
  }, []);

  const recordTransaction = useCallback(async ({ type, status, amount, description, metadata }) => {
    if (!userEmail) return false;
    const transactionId = crypto.randomUUID();
    const localTransaction = {
      id: transactionId,
      timestamp: new Date().toISOString(),
      email: userEmail,
      type,
      status,
      amount: Number(amount || 0),
      description,
      metadata: metadata || null,
      syncStatus: 'pending',
    };

    // Optimistic update so counts/cards change instantly on trigger.
    const initialLocalRows = readLocalTransactions();
    writeLocalTransactions([localTransaction, ...initialLocalRows.filter(txn => txn.id !== transactionId)]);
    setTransactions(prev => mergeTransactions([localTransaction], prev));

    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          userId: userProfile?.id,
          id: transactionId,
          type,
          status,
          amount,
          description,
          metadata,
        }),
      }, API_TIMEOUT);
      if (!res.ok) return false;
      const payload = await res.json().catch(() => ({}));
      if (payload?.transaction) {
        setTransactions(prev => {
          const deduped = prev.filter(txn => txn.id !== payload.transaction.id);
          return [payload.transaction, ...deduped];
        });
      }
      const localRows = readLocalTransactions().filter(txn => txn.id !== transactionId);
      writeLocalTransactions(localRows);
      fetchTransactions();
      return true;
    } catch (err) {
      console.warn('Transaction record failed:', err.message);
      return false;
    }
  }, [userEmail, userProfile?.id, fetchTransactions, mergeTransactions, readLocalTransactions, writeLocalTransactions]);

  const handleWeeklyPremiumPayment = useCallback(async () => {
    const paymentProfile = profileState || userProfile || {};
    const premiumDetails = getWeeklyPremiumDetails(paymentProfile);

    if (!userEmail) {
      setWeeklyPaymentState({ loading: false, message: '', error: 'Please log in to continue.' });
      return;
    }

    if (!premiumDetails.amount || premiumDetails.amount <= 0) {
      setWeeklyPaymentState({ loading: false, message: '', error: 'Weekly income is required to calculate the premium amount.' });
      return;
    }

    setWeeklyPaymentState({ loading: true, message: '', error: '', paid: false });

    try {
      const subscriptionRes = await fetchWithTimeout(`${API_BASE}/razorpay-weekly-subscription/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          userId: userProfile?.id,
          profile: {
            ...paymentProfile,
            plan: premiumDetails.plan,
            weeklyIncome: premiumDetails.weeklyIncome,
          },
        }),
      }, API_TIMEOUT);

      const subscriptionData = await subscriptionRes.json().catch(() => ({}));
      if (!subscriptionRes.ok || !subscriptionData?.success) {
        throw new Error(subscriptionData?.error || 'Unable to create weekly subscription');
      }

      if (subscriptionData?.simulated) {
        setWeeklyPaymentState({
          loading: false,
          message: subscriptionData.message || 'Weekly due paid successfully.',
          error: '',
          paid: true,
          paidAt: new Date().toLocaleString(),
        });
        return;
      }

      const RazorpayCheckout = await loadRazorpayCheckout();
      const checkoutType = subscriptionData?.checkoutType || 'subscription';

      const options = {
        key: subscriptionData.keyId,
        ...(checkoutType === 'subscription'
          ? { subscription_id: subscriptionData.subscription?.id }
          : {
              order_id: subscriptionData.order?.id,
              amount: subscriptionData.order?.amount,
            }),
        currency: 'INR',
        name: 'ZyroSafe',
        description: checkoutType === 'subscription'
          ? `Weekly subscription - ${premiumDetails.plan}`
          : `Weekly premium payment - ${premiumDetails.plan}`,
        prefill: {
          name: paymentProfile?.name || paymentProfile?.fullName || paymentProfile?.businessName || '',
          email: userEmail,
          contact: paymentProfile?.phone || '',
        },
        notes: {
          email: userEmail,
          plan: premiumDetails.plan,
          weeklyIncome: String(premiumDetails.weeklyIncome),
        },
        theme: {
          color: '#0ea5e9',
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetchWithTimeout(`${API_BASE}/razorpay-weekly-subscription/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                userId: userProfile?.id,
                subscription_id:
                  response.razorpay_subscription_id ||
                  response.subscription_id ||
                  subscriptionData.subscription?.id ||
                  subscriptionData.order?.id,
                payment_id: response.razorpay_payment_id || response.payment_id,
                signature: response.razorpay_signature || response.signature,
                amount: subscriptionData.amount,
                plan: subscriptionData.plan,
                weeklyIncome: subscriptionData.weeklyIncome,
                rate: subscriptionData.rate,
                profile: {
                  ...paymentProfile,
                  plan: premiumDetails.plan,
                  weeklyIncome: premiumDetails.weeklyIncome,
                },
              }),
            }, API_TIMEOUT);

            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }

            setWeeklyPaymentState({
              loading: false,
              message: verifyData.message || 'Weekly due paid successfully.',
              error: '',
              paid: true,
              paidAt: new Date().toLocaleString(),
            });
            fetchTransactions();
          } catch (err) {
            setWeeklyPaymentState({
              loading: false,
              message: '',
              error: err.message || 'Weekly premium verification failed',
              paid: false,
              paidAt: '',
            });
          }
        },
        modal: {
          ondismiss: () => {
            setWeeklyPaymentState(prev => ({
              ...prev,
              loading: false,
              message: prev.message || 'Payment window closed before completion.',
            }));
          },
        },
      };

      const razorpay = new RazorpayCheckout(options);
      razorpay.open();
      setWeeklyPaymentState({ loading: false, message: 'Razorpay subscription checkout opened.', error: '', paid: false, paidAt: '' });
    } catch (err) {
      setWeeklyPaymentState({ loading: false, message: '', error: err.message || 'Unable to start weekly subscription payment.', paid: false, paidAt: '' });
    }
  }, [fetchTransactions, profileState, userEmail, userProfile?.id, userProfile]);

  useEffect(() => {
    fetchLiveWeather();
    fetchWeatherTrend();
    fetchSocialAlerts();
    fetchTransactions();
    const id = setInterval(() => {
      fetchLiveWeather();
      fetchWeatherTrend();
      fetchSocialAlerts();
    }, 60000);
    return () => clearInterval(id);
  }, [fetchLiveWeather, fetchWeatherTrend, fetchSocialAlerts, fetchTransactions]);

  useEffect(() => {
    fetchTransactions();
    const txIntervalId = setInterval(() => {
      fetchTransactions();
    }, 5000);

    const onFocus = () => fetchTransactions();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(txIntervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchTransactions]);

  useEffect(() => {
    if (!navigator?.geolocation) return;

    const watcherId = navigator.geolocation.watchPosition(
      (position) => {
        setGeoError('');
        const sample = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          ts: position.timestamp || Date.now(),
        };
        handleLocationUpdate(sample, { source: 'live' });
      },
      (err) => {
        if (err?.code === 1) setGeoError('Location permission denied');
        else if (err?.code === 2) setGeoError('Location unavailable');
        else if (err?.code === 3) setGeoError('Location request timed out');
        else setGeoError('Unable to read live location');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      }
    );

    return () => navigator.geolocation.clearWatch(watcherId);
  }, [handleLocationUpdate]);

  useEffect(() => {
    if (!geoPosition?.lat || !geoPosition?.lng) return;

    const now = Date.now();
    const { lat: prevLat, lng: prevLng, ts: prevTs } = geoLookupRef.current;
    const movedEnough =
      !Number.isFinite(prevLat) ||
      !Number.isFinite(prevLng) ||
      Math.abs(geoPosition.lat - prevLat) > 0.001 ||
      Math.abs(geoPosition.lng - prevLng) > 0.001;
    const staleEnough = now - prevTs > 30000;

    if (!movedEnough && !staleEnough) return;

    geoLookupRef.current = { lat: geoPosition.lat, lng: geoPosition.lng, ts: now };
    fetchGeoAddress(geoPosition.lat, geoPosition.lng);
  }, [geoPosition?.lat, geoPosition?.lng, fetchGeoAddress]);

  /* ─── Computed thresholds from README ─── */
  const isModerateRain = sim.rainfall >= 45 && sim.rainfall <= 60;
  const isSevereRain   = sim.rainfall > 60;
  const isExtremeHeat  = sim.temperature > 45;
  const isEventActive  = sim.event !== 'None';
  const isAlertActive  = isModerateRain || isSevereRain || isExtremeHeat || isEventActive;

  const severity = (isSevereRain || isExtremeHeat || isEventActive) ? 'severe'
                 : isModerateRain ? 'moderate' : 'none';

  const alertLabel = isEventActive  ? sim.event
                   : isExtremeHeat  ? 'Extreme Heat Warning'
                   : isSevereRain   ? 'Severe Rainfall Alert'
                   : isModerateRain ? 'Heavy Rainfall Warning'
                   : '';

  const liveRainMmPerDay = (Number(liveWeather?.rainfallMm1h || 0) * 24);
  const liveTemp = Number(liveWeather?.temperatureC || 0);
  const liveCondition = String(liveWeather?.condition || '').toLowerCase();
  const liveEventWeather = /storm|thunder|squall|tornado|cyclone/.test(liveCondition);
  const isSunny = /clear|sun/.test(liveCondition);
  const hasClouds = /cloud/.test(liveCondition);
  const isRainySky = /rain|drizzle|thunder|storm/.test(liveCondition);
  const currentHour = time.getHours();
  const isEarlyMorning = currentHour >= 4 && currentHour < 6;
  const isNight = currentHour >= 19 || currentHour < 6;
  const showDaySkyScene = !isNight && (isSunny || hasClouds);
  const showSunScene = !isNight && (isSunny || (liveTemp >= 30 && !isRainySky));
  const earlyMorningBgOpacity = (() => {
    if (isRainySky || liveEventWeather) return 0.10;
    if (isSunny) return 0.28;
    if (hasClouds) return 0.22;
    return 0.18;
  })();

  const earlyMorningOverlay = (() => {
    if (isRainySky || liveEventWeather) {
      return 'linear-gradient(to bottom, rgba(2, 10, 24, 0.42), rgba(8, 18, 38, 0.60))';
    }

    if (hasClouds) {
      return 'linear-gradient(to bottom, rgba(223, 241, 255, 0.22), rgba(14, 31, 54, 0.28))';
    }

    if (isSunny) {
      return 'linear-gradient(to bottom, rgba(255, 247, 214, 0.16), rgba(14, 31, 54, 0.22))';
    }

    return 'linear-gradient(to bottom, rgba(6, 18, 36, 0.18), rgba(6, 18, 36, 0.34))';
  })();

  const uiWeatherTheme = (() => {
    if (isEarlyMorning) {
      return {
        shell: 'bg-gradient-to-br from-[#d9efff] via-[#bfe0ff] to-[#8fb9e8]',
        glowOne: 'bg-sky-200/18',
        glowTwo: 'bg-amber-100/14',
        haze: 'from-white/20 via-sky-100/10 to-transparent',
      };
    }

    if (isRainySky || liveEventWeather) {
      return {
        shell: 'bg-gradient-to-br from-[#040b16] via-[#08172d] to-[#09142a]',
        glowOne: 'bg-blue-500/12',
        glowTwo: 'bg-indigo-500/10',
        haze: 'from-cyan-300/8 via-blue-300/5 to-transparent',
      };
    }

    if (isNight) {
      return {
        shell: 'bg-gradient-to-br from-[#040816] via-[#07111f] to-[#0a1630]',
        glowOne: 'bg-sky-500/10',
        glowTwo: 'bg-indigo-500/12',
        haze: 'from-sky-100/6 via-indigo-200/6 to-transparent',
      };
    }

    if (isSunny) {
      return {
        shell: 'bg-gradient-to-br from-[#4ea9ff] via-[#2f86dc] to-[#1f5ea8]',
        glowOne: 'bg-amber-300/20',
        glowTwo: 'bg-sky-300/12',
        haze: 'from-amber-200/12 via-yellow-200/6 to-transparent',
      };
    }

    if (hasClouds) {
      return {
        shell: 'bg-gradient-to-br from-[#7bc3ff] via-[#4f9be6] to-[#2f74bf]',
        glowOne: 'bg-slate-100/20',
        glowTwo: 'bg-sky-200/16',
        haze: 'from-sky-100/12 via-white/8 to-transparent',
      };
    }

    return {
      shell: 'bg-gradient-to-br from-[#74beff] via-[#4997e4] to-[#2d70be]',
      glowOne: 'bg-sky-100/18',
      glowTwo: 'bg-cyan-100/14',
      haze: 'from-sky-100/14 via-white/8 to-transparent',
    };
  })();

  const getSelectedTrigger = () => {
    if (sim.event === 'Cyclone') return 'Cyclone';
    if (sim.event === 'Curfew' || sim.event === 'Strike') return sim.event;
    if (sim.temperature > 45) return 'Heat';
    if (sim.rainfall > 60) return 'Severe Rain';
    if (sim.rainfall >= 45) return 'Moderate Rain';
    return null;
  };

  const selectedTrigger = getSelectedTrigger();
  const liveThresholdMatch = (() => {
    switch (selectedTrigger) {
      case 'Moderate Rain':
        return liveRainMmPerDay >= 45 && liveRainMmPerDay <= 60;
      case 'Severe Rain':
        return liveRainMmPerDay > 60;
      case 'Heat':
        return liveTemp > 45;
      case 'Cyclone':
        return liveEventWeather;
      case 'Curfew':
      case 'Strike':
        return false;
      default:
        return false;
    }
  })();

  const liveThresholdLabel = (() => {
    if (liveRainMmPerDay > 60) return 'Severe Rain';
    if (liveRainMmPerDay >= 45) return 'Moderate Rain';
    if (liveTemp > 45) return 'Heat';
    if (liveEventWeather) return 'Cyclone';
    return 'No payout condition';
  })();

  const buildWeatherMismatchExplanation = useCallback((overrideTrigger = selectedTrigger, overrideLiveLabel = liveThresholdLabel) => {
    const liveSnapshot = {
      temperatureC: liveWeather?.temperatureC ?? null,
      rainfallMm1h: liveWeather?.rainfallMm1h ?? null,
      condition: liveWeather?.condition || 'Unavailable',
    };

    const triggerLabel = overrideTrigger || 'no threshold';
    const liveLabel = overrideLiveLabel || 'no live condition';
    const evidence = [
      `Selected trigger: ${triggerLabel}`,
      `Live weather signal: ${liveLabel}`,
      `Temperature: ${liveSnapshot.temperatureC ?? '--'}°C`,
      `Rainfall: ${liveSnapshot.rainfallMm1h ?? '--'} mm/h`,
      `Condition: ${liveSnapshot.condition}`,
    ];

    return {
      decision: 'rejected',
      model: 'Weather Threshold Guard',
      confidence: 0.96,
      summary: `Rejected: the selected payout trigger (${triggerLabel}) does not match the current live weather (${liveLabel}).`,
      evidence,
      liveSnapshot,
    };
  }, [liveRainMmPerDay, liveTemp, liveWeather?.condition, liveWeather?.rainfallMm1h, liveWeather?.temperatureC, selectedTrigger, liveThresholdLabel]);

  /* ─── Payout calculator from README ─── */
  const calcPayout = useCallback(() => {
    const income = parseFloat(userProfile?.weeklyIncome || 5000);
    const hours  = parseFloat(userProfile?.workingHours || 50);
    const hourly = income / hours;
    const lost   = severity === 'severe' ? 6 : 3;
    const factor = userProfile?.plan === 'Premium' ? 1.2
                 : userProfile?.plan === 'Standard' ? 1.0
                 : 0.8;
    const minPayout = Math.max(50, income * 0.01);
    const uncapped = Math.max(minPayout, hourly * lost * factor);
    return Math.min(uncapped, WEEKLY_PAYOUT_CAP);
  }, [userProfile, severity]);

  const updatePipeline = useCallback((patch) => {
    setPipelineState(prev => ({ ...prev, ...patch }));
  }, []);

  const runFraudCheck = useCallback(async () => {
    if (!userEmail) return null;

    updatePipeline({ gpsSent: Boolean(geoPosition), fraudStored: false });

    const locationContext = {
      area: geoAddress?.area || '',
      city: geoAddress?.city || '',
      state: geoAddress?.state || '',
      country: geoAddress?.country || '',
      displayName: geoAddress?.displayName || '',
    };

    const expectedLocation = {
      city: profileState?.city || '',
      state: profileState?.state || '',
      area: profileState?.area || '',
    };

    try {
      const res = await fetchWithTimeout(`${API_BASE}/fraud-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          userId: userProfile?.id,
          gps: geoPosition,
          gpsHistory,
          activity: activityState,
          locationContext,
          expectedLocation,
        }),
      }, API_TIMEOUT);

      const data = await res.json();
      if (!res.ok || !data?.success) return null;
      updatePipeline({
        fraudStored: Boolean(data?.fraud?.stored),
        fraudScore: Number.isFinite(data?.fraud?.score) ? data.fraud.score : null,
      });
      return data.fraud || null;
    } catch {
      return null;
    }
  }, [activityState, geoAddress, geoPosition, gpsHistory, profileState?.area, profileState?.city, profileState?.state, updatePipeline, userEmail, userProfile?.id]);

  /* ─── Trigger simulation pipeline ─── */
  const triggerSystem = async () => {
    if (!isAlertActive || isProcessing) return;

    if (flowPopupTimerRef.current) {
      clearTimeout(flowPopupTimerRef.current);
      flowPopupTimerRef.current = null;
    }
    setShowFlowPopup(true);

    setPipelineState({
      gpsSent: false,
      fraudStored: false,
      transactionCreated: false,
      fraudScore: null,
      decision: null,
    });

    const enforceLiveWeather = Boolean(selectedTrigger);

    // Guard autopayout with README-aligned live thresholds for every selected trigger.
    if (enforceLiveWeather && !liveThresholdMatch) {
      const attemptedPayout = parseFloat(calcPayout().toFixed(2));
      const explainableAI = buildWeatherMismatchExplanation();
      setClaim({
        status: 'rejected',
        riskScore: 88,
        payout: 0,
        reason: explainableAI.summary,
      });
      const created = await recordTransaction({
        type: 'fraud_transaction',
        status: 'rejected',
        amount: attemptedPayout,
        description: explainableAI.summary,
        metadata: {
          sim,
          liveWeather,
          selectedTrigger,
          liveThresholdLabel,
          explainableAI,
        },
      });
      updatePipeline({ transactionCreated: created, decision: 'rejected' });
      return;
    }

    setClaim({ status: 'processing', riskScore: 15, payout: 0, reason: '' });

    const fraud = await runFraudCheck();
    if (fraud?.action === 'rejected') {
      const attemptedPayout = parseFloat(calcPayout().toFixed(2));
      const reason = `Fraud transaction rejected (${fraud.score}/100): GPS/IP mismatch or movement anomaly`;
      setClaim({
        status: 'rejected',
        riskScore: fraud.score,
        payout: 0,
        reason,
      });
      const created = await recordTransaction({
        type: 'fraud_transaction',
        status: 'rejected',
        amount: attemptedPayout,
        description: reason,
        metadata: {
          sim,
          liveWeather,
          geoPosition,
          fraud,
        },
      });
      updatePipeline({ transactionCreated: created, decision: 'rejected', fraudScore: fraud.score });
      return;
    }

    const baseScore = Math.max(18, Number(fraud?.score || 18));

    setTimeout(() => {
      setClaim(p => ({ ...p, status: 'validating' }));
    }, 800);

    setTimeout(() => {
      let score = baseScore;
      if (sim.event === 'Cyclone') score = 45;
      if (sim.rainfall > 120) score = 82;
      if (sim.event === 'Curfew' && sim.rainfall > 60) score = 65;

      setClaim(p => ({ ...p, status: 'scoring', riskScore: score }));

      setTimeout(async () => {
        if (score > 70) {
          setClaim(p => ({ ...p, status: 'rejected', reason: `Fraud transaction rejected (risk score ${score})` }));
          const created = await recordTransaction({
            type: 'fraud_transaction',
            status: 'rejected',
            amount: parseFloat(calcPayout().toFixed(2)),
            description: `Fraud transaction rejected (risk score ${score})`,
            metadata: { score, sim, geoPosition, fraud },
          });
          updatePipeline({ transactionCreated: created, decision: 'rejected', fraudScore: score });
        } else {
          const payout = calcPayout();
          setClaim({ status: 'approved', riskScore: score, payout: parseFloat(payout.toFixed(2)), reason: '' });
          const payoutAmount = parseFloat(payout.toFixed(2));
          const created = await recordTransaction({
            type: 'autopayout',
            status: 'completed',
            amount: payoutAmount,
            description: 'Model autopayout released',
            metadata: { score, sim, geoPosition, fraud },
          });
          updatePipeline({ transactionCreated: created, decision: 'approved', fraudScore: score });

          // Trigger Razorpay payout
          if (created && payoutAmount > 0) {
            try {
              const payoutRes = await fetchWithTimeout(`${API_BASE}/razorpay-payout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: userEmail,
                  transactionId: created.id,
                  amount: payoutAmount,
                  description: 'Insurance claim autopayout - Weather disruption',
                  recipientPhone: profileState?.phone,
                  recipientUPI: profileState?.upi,
                  selectedTrigger,
                  liveThresholdLabel,
                  liveWeather,
                  explainableAI: buildWeatherMismatchExplanation(),
                }),
              }, API_TIMEOUT);

              if (payoutRes.ok) {
                const payoutData = await payoutRes.json();
                console.log('Razorpay payout initiated:', payoutData);
              }
            } catch (err) {
              console.warn('Razorpay payout request failed:', err.message);
            }
          }
        }
      }, 1200);
    }, 1500);
  };

  const resetClaim = () => setClaim({ status: null, riskScore: 15, payout: 0, reason: '' });

  const closeFlowPopup = useCallback(() => {
    if (flowPopupTimerRef.current) {
      clearTimeout(flowPopupTimerRef.current);
      flowPopupTimerRef.current = null;
    }
    setShowFlowPopup(false);
  }, []);

  const applyPreset = (key) => {
    const preset = PRESETS[key];
    autoTriggerSignatureRef.current = '';
    setSim(p => ({ ...p, ...preset }));
    setTriggerSource('preset');
    resetClaim();
  };

  const isProcessing = ['processing', 'validating', 'scoring'].includes(claim.status);

  useEffect(() => {
    if (triggerSource !== 'preset') return;
    if (!isAlertActive || isProcessing) return;

    const signature = [sim.mode, sim.rainfall, sim.temperature, sim.event].join('|');
    if (autoTriggerSignatureRef.current === signature) return;

    autoTriggerSignatureRef.current = signature;
    const timerId = setTimeout(() => {
      triggerSystem();
    }, 350);

    return () => clearTimeout(timerId);
  }, [triggerSource, isAlertActive, isProcessing, sim.mode, sim.rainfall, sim.temperature, sim.event]);

  useEffect(() => {
    if (!showFlowPopup) return;
    if (!['approved', 'rejected'].includes(claim.status)) return;

    if (flowPopupTimerRef.current) {
      clearTimeout(flowPopupTimerRef.current);
    }

    flowPopupTimerRef.current = setTimeout(() => {
      setShowFlowPopup(false);
      flowPopupTimerRef.current = null;
    }, 7000);

    return () => {
      if (flowPopupTimerRef.current) {
        clearTimeout(flowPopupTimerRef.current);
        flowPopupTimerRef.current = null;
      }
    };
  }, [claim.status, showFlowPopup]);

  useEffect(() => {
    return () => {
      if (flowPopupTimerRef.current) {
        clearTimeout(flowPopupTimerRef.current);
      }
    };
  }, []);
  const liveGpsLabel = geoPosition
    ? `${geoPosition.lat.toFixed(4)}, ${geoPosition.lng.toFixed(4)}${Number.isFinite(geoPosition.accuracy) ? ` (±${Math.round(geoPosition.accuracy)}m)` : ''}`
    : geoError || 'Waiting for location...';
  const socialSignals = Array.isArray(socialAlertState.data?.signals) ? socialAlertState.data.signals : [];
  const socialPrimary = socialAlertState.data?.primary || socialSignals[0] || null;
  const socialActive = Boolean(socialAlertState.data?.active);
  const socialScorePct = Math.round(Number(socialAlertState.data?.social_disruption_score || 0) * 100);
  const mapRiskScore = Number.isFinite(mapFraudResult?.riskScore) ? mapFraudResult.riskScore : 0;
  const userInfoLabel = [
    profileState?.plan ? `${profileState.plan} plan` : null,
    profileState?.deliveryMode ? `Mode: ${profileState.deliveryMode}` : null,
    userEmail || null,
  ].filter(Boolean).join(' | ');
  const allTransactions = [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const rejectedTransactions = allTransactions.filter(txn => String(txn.status || '').toLowerCase() === 'rejected');
  const approvedCount = allTransactions.filter(txn => String(txn.status || '').toLowerCase() === 'completed').length;
  const flaggedCount = allTransactions.filter(txn => String(txn.status || '').toLowerCase() === 'flagged').length;
  const recentTransactions = allTransactions.slice(0, 3);
  const mapAlertTone = {
    success: 'text-emerald-200 border-emerald-300/30 bg-emerald-500/10',
    warning: 'text-amber-200 border-amber-300/30 bg-amber-500/10',
    error: 'text-red-200 border-red-300/30 bg-red-500/10',
  };
  const userDisplayName =
    profileState?.name ||
    profileState?.fullName ||
    profileState?.businessName ||
    (profileState?.email ? String(profileState.email).split('@')[0] : 'Partner');
  const userInfoRows = [
    ['Name', userDisplayName],
    ['Email', userEmail || '--'],
    ['Phone', profileState?.phone || '--'],
    ['Plan', profileState?.plan || 'Basic'],
    ['Delivery Mode', profileState?.deliveryMode || '--'],
    ['City', lockedLiveCity || '--'],
    ['State', lockedLiveState || '--'],
    ['Weekly Income', `₹${Number(profileState?.weeklyIncome || 0).toLocaleString('en-IN')}`],
    ['Working Hours', profileState?.workingHours ? `${profileState.workingHours} hrs/week` : '--'],
  ];

  const handleUserInfoFieldChange = (field, value) => {
    setUserInfoForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveUserInfo = () => {
    setProfileState(prev => ({
      ...prev,
      name: userInfoForm.name.trim(),
      phone: userInfoForm.phone.trim(),
      plan: userInfoForm.plan,
      deliveryMode: userInfoForm.deliveryMode.trim(),
      city: lockedLiveCity,
      state: lockedLiveState,
      weeklyIncome: userInfoForm.weeklyIncome ? Number(userInfoForm.weeklyIncome) : prev.weeklyIncome,
      workingHours: userInfoForm.workingHours ? Number(userInfoForm.workingHours) : prev.workingHours,
    }));
    setIsEditingUserInfo(false);
  };

  const handleCancelUserInfoEdit = () => {
    setUserInfoForm({
      name: profileState?.name || profileState?.fullName || profileState?.businessName || '',
      phone: profileState?.phone || '',
      plan: profileState?.plan || 'Basic',
      deliveryMode: profileState?.deliveryMode || '',
      city: lockedLiveCity,
      state: lockedLiveState,
      weeklyIncome: String(profileState?.weeklyIncome || ''),
      workingHours: String(profileState?.workingHours || ''),
    });
    setIsEditingUserInfo(false);
  };

  const handleSupportClick = () => {
    setActivePage('SUPPORT');
    setShowHamburgerMenu(false);
  };

  const handleSupportActionClick = () => {
    setShowSupportConstructionPopup(true);
  };

  const openUserInfo = () => {
    setActivePage('USER_INFO');
    setShowHamburgerMenu(false);
  };

  const openNotifications = () => {
    setActivePage('NOTIFICATIONS');
    setShowHamburgerMenu(false);
  };

  const openTransactions = () => {
    setActivePage('TRANSACTIONS');
    setShowHamburgerMenu(false);
  };

  const handleMenuLogout = () => {
    setShowHamburgerMenu(false);
    onLogout();
  };

  const goToMainPage = () => {
    setActivePage('OPERATIONS');
  };

  return (
    <div className={`h-full w-full text-white font-body flex flex-col overflow-hidden relative ${uiWeatherTheme.shell}`}>
      {/* Ambient background */}
      <div className={`absolute top-[-15%] right-[-10%] w-[600px] h-[600px] ${uiWeatherTheme.glowOne} rounded-full blur-[150px] pointer-events-none z-0`} />
      <div className={`absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] ${uiWeatherTheme.glowTwo} rounded-full blur-[130px] pointer-events-none z-0`} />
      <div className={`absolute inset-0 bg-gradient-to-b ${uiWeatherTheme.haze} pointer-events-none z-0`} />

      {isEarlyMorning && (
        <>
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `${earlyMorningOverlay}, url(${earlyMorningBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
              opacity: earlyMorningBgOpacity,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#dff1ff]/18 via-transparent to-[#0e1f36]/30 pointer-events-none z-0" />
        </>
      )}

      {isNight && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#08101c]/35 via-transparent to-[#02040a]/70 pointer-events-none" />
          <div
            className="absolute inset-0 pointer-events-none opacity-95"
            style={{
              backgroundImage:
                'radial-gradient(circle at 10% 14%, rgba(255,255,255,0.95) 0 1px, transparent 1.5px), radial-gradient(circle at 18% 36%, rgba(255,255,255,0.85) 0 1px, transparent 1.5px), radial-gradient(circle at 31% 18%, rgba(255,255,255,0.9) 0 1px, transparent 1.5px), radial-gradient(circle at 46% 28%, rgba(255,255,255,0.8) 0 1px, transparent 1.5px), radial-gradient(circle at 58% 12%, rgba(255,255,255,0.94) 0 1px, transparent 1.5px), radial-gradient(circle at 70% 26%, rgba(255,255,255,0.82) 0 1px, transparent 1.5px), radial-gradient(circle at 82% 16%, rgba(255,255,255,0.92) 0 1px, transparent 1.5px), radial-gradient(circle at 88% 44%, rgba(255,255,255,0.76) 0 1px, transparent 1.5px), radial-gradient(circle at 24% 68%, rgba(255,255,255,0.88) 0 1px, transparent 1.5px), radial-gradient(circle at 52% 76%, rgba(255,255,255,0.84) 0 1px, transparent 1.5px), radial-gradient(circle at 76% 72%, rgba(255,255,255,0.9) 0 1px, transparent 1.5px)',
              backgroundSize: '100% 100%',
            }}
          />
          <motion.div initial={{ opacity: 0.35 }} animate={{ opacity: 0.8 }} transition={{ duration: 5.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-14 left-[12%] w-2 h-2 rounded-full bg-white/95 shadow-[0_0_12px_rgba(255,255,255,0.75)] pointer-events-none" />
          <motion.div initial={{ opacity: 0.2 }} animate={{ opacity: 0.72 }} transition={{ duration: 6.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-24 left-[24%] w-1.5 h-1.5 rounded-full bg-cyan-100/90 shadow-[0_0_10px_rgba(165,243,252,0.7)] pointer-events-none" />
          <motion.div initial={{ opacity: 0.3 }} animate={{ opacity: 0.78 }} transition={{ duration: 7.1, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-16 left-[39%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.58)] pointer-events-none" />
          <motion.div initial={{ opacity: 0.28 }} animate={{ opacity: 0.74 }} transition={{ duration: 8, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-28 left-[56%] w-2 h-2 rounded-full bg-sky-100/90 shadow-[0_0_12px_rgba(186,230,253,0.72)] pointer-events-none" />
          <motion.div initial={{ opacity: 0.22 }} animate={{ opacity: 0.76 }} transition={{ duration: 6.8, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-12 left-[72%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.58)] pointer-events-none" />
          <motion.div initial={{ opacity: 0.26 }} animate={{ opacity: 0.82 }} transition={{ duration: 7.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-26 left-[86%] w-2 h-2 rounded-full bg-cyan-100/85 shadow-[0_0_12px_rgba(165,243,252,0.68)] pointer-events-none" />
        </>
      )}

      {showDaySkyScene && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-sky-200/20 via-sky-200/6 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-[#041325]/24 pointer-events-none" />
          <div
            className="absolute top-0 left-0 right-0 h-[42%] pointer-events-none opacity-80"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 10% 22%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 28%), radial-gradient(ellipse at 34% 20%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 26%), radial-gradient(ellipse at 58% 24%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 27%), radial-gradient(ellipse at 82% 18%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 25%)',
            }}
          />

          {showSunScene && (
            <>
              <div
                className="absolute top-6 right-20 w-32 h-32 rounded-full pointer-events-none"
                style={{
                  opacity: 1,
                  transform: 'scale(1.08)',
                  transformOrigin: 'center',
                  background: 'radial-gradient(circle at 35% 35%, rgba(255,225,155,1) 0%, rgba(255,186,70,0.98) 34%, rgba(235,120,34,0.96) 66%, rgba(191,78,20,0.92) 100%)',
                }}
              />
              <div className="absolute top-0 right-14 w-52 h-52 rounded-full bg-orange-500/24 blur-2xl pointer-events-none" />
              <div className="absolute top-2 right-16 w-48 h-48 rounded-full border border-orange-200/25 pointer-events-none" />
              <div className="absolute top-[-8px] right-8 w-64 h-64 rounded-full bg-amber-300/20 blur-3xl pointer-events-none" />
              <div className="absolute top-[22px] right-[92px] w-20 h-20 rounded-full bg-amber-50/14 blur-xl pointer-events-none" />
            </>
          )}

          <motion.div
            initial={{ x: -20, opacity: 0.7 }}
            animate={{ x: 28, opacity: 0.98 }}
            transition={{ duration: 12, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="absolute top-12 left-[18%] w-[180px] h-[56px] bg-white/58 rounded-full blur-[1px] pointer-events-none"
          >
            <div className="absolute -left-5 top-2 w-[68px] h-[38px] bg-white/58 rounded-full" />
            <div className="absolute left-14 -top-4 w-[74px] h-[46px] bg-white/58 rounded-full" />
            <div className="absolute left-28 top-2 w-[62px] h-[34px] bg-white/58 rounded-full" />
          </motion.div>

          <motion.div
            initial={{ x: 25, opacity: 0.6 }}
            animate={{ x: -32, opacity: 0.95 }}
            transition={{ duration: 15, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="absolute top-24 left-[45%] w-[196px] h-[58px] bg-white/52 rounded-full blur-[1px] pointer-events-none"
          >
            <div className="absolute -left-4 top-2 w-[62px] h-[38px] bg-white/52 rounded-full" />
            <div className="absolute left-16 -top-4 w-[72px] h-[44px] bg-white/52 rounded-full" />
            <div className="absolute left-32 top-2 w-[62px] h-[34px] bg-white/52 rounded-full" />
          </motion.div>

          <motion.div
            initial={{ x: -18, opacity: 0.55 }}
            animate={{ x: 24, opacity: 0.85 }}
            transition={{ duration: 18, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="absolute top-32 left-[28%] w-[170px] h-[50px] bg-white/46 rounded-full blur-[1px] pointer-events-none"
          >
            <div className="absolute -left-3 top-2 w-[54px] h-[34px] bg-white/46 rounded-full" />
            <div className="absolute left-12 -top-3 w-[58px] h-[38px] bg-white/46 rounded-full" />
            <div className="absolute left-24 top-2 w-[52px] h-[30px] bg-white/46 rounded-full" />
          </motion.div>

          <motion.div
            initial={{ x: 20, opacity: 0.5 }}
            animate={{ x: -26, opacity: 0.8 }}
            transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="absolute top-16 left-[62%] w-[150px] h-[44px] bg-white/44 rounded-full blur-[1px] pointer-events-none"
          >
            <div className="absolute -left-3 top-2 w-[44px] h-[30px] bg-white/44 rounded-full" />
            <div className="absolute left-10 -top-2 w-[52px] h-[34px] bg-white/44 rounded-full" />
            <div className="absolute left-20 top-2 w-[44px] h-[28px] bg-white/44 rounded-full" />
          </motion.div>

          <motion.div
            initial={{ x: -22, opacity: 0.6 }}
            animate={{ x: 30, opacity: 0.9 }}
            transition={{ duration: 22, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="absolute top-10 left-[36%] w-[190px] h-[54px] bg-white/50 rounded-full blur-[1px] pointer-events-none"
          >
            <div className="absolute -left-4 top-2 w-[60px] h-[36px] bg-white/50 rounded-full" />
            <div className="absolute left-16 -top-4 w-[70px] h-[44px] bg-white/50 rounded-full" />
            <div className="absolute left-34 top-2 w-[56px] h-[32px] bg-white/50 rounded-full" />
          </motion.div>

          <motion.div
            initial={{ x: 24, opacity: 0.55 }}
            animate={{ x: -34, opacity: 0.85 }}
            transition={{ duration: 24, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="absolute top-36 left-[58%] w-[170px] h-[50px] bg-white/46 rounded-full blur-[1px] pointer-events-none"
          >
            <div className="absolute -left-3 top-2 w-[52px] h-[34px] bg-white/46 rounded-full" />
            <div className="absolute left-12 -top-3 w-[58px] h-[38px] bg-white/46 rounded-full" />
            <div className="absolute left-26 top-2 w-[52px] h-[30px] bg-white/46 rounded-full" />
          </motion.div>

          <motion.div
            initial={{ x: -26, opacity: 0.5 }}
            animate={{ x: 36, opacity: 0.86 }}
            transition={{ duration: 26, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="absolute top-[18%] left-[6%] w-[160px] h-[46px] bg-white/40 rounded-full blur-[1px] pointer-events-none"
          >
            <div className="absolute -left-3 top-2 w-[50px] h-[32px] bg-white/40 rounded-full" />
            <div className="absolute left-10 -top-3 w-[54px] h-[36px] bg-white/40 rounded-full" />
            <div className="absolute left-22 top-2 w-[48px] h-[28px] bg-white/40 rounded-full" />
          </motion.div>
        </>
      )}

      <div className="relative z-[1200] shrink-0 p-3 pb-0">
        <header className="glass-strong rounded-2xl px-5 py-3 border border-white/12 shadow-[0_16px_40px_rgba(2,8,20,0.34)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg glass-control flex items-center justify-center shrink-0">
              <MapPin size={14} className="text-blue-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-extrabold font-heading tracking-[0.04em] leading-tight text-white">ZyroSafe</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:justify-end min-w-0">
            <div className="text-right min-w-0">
              <div className="text-[9px] text-sky-200 uppercase tracking-widest">Live Session</div>
              <div className="text-xs font-bold font-mono tracking-wider text-sky-100">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[9px] text-cyan-100 truncate max-w-[200px]">{userEmail || 'Connected user'}</div>
            </div>
            <button
              className="w-8 h-8 rounded-full glass-control text-sky-100 inline-flex items-center justify-center relative"
              aria-label="Notifications"
              onClick={openNotifications}
            >
              <Bell size={14} />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

            <div className="relative z-[1300]" ref={hamburgerMenuRef}>
              <button
                onClick={() => setShowHamburgerMenu((prev) => !prev)}
                className="w-8 h-8 rounded-full bg-[#0b1732] border border-[#243b67] text-sky-100 hover:text-white hover:bg-[#122447] transition-colors inline-flex items-center justify-center"
                aria-label="Open menu"
              >
                <User size={14} />
              </button>

              {showHamburgerMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#243b67] bg-[#0b1732] p-1.5 z-[1400] shadow-[0_14px_28px_rgba(1,7,18,0.55)]">
                  <button onClick={handleSupportClick} className="w-full text-left px-3 py-2 rounded-lg text-xs text-sky-100 hover:bg-[#13284d] inline-flex items-center gap-2">
                    <Headset size={13} />
                    Support
                  </button>
                  <button onClick={openUserInfo} className="w-full text-left px-3 py-2 rounded-lg text-xs text-sky-100 hover:bg-[#13284d] inline-flex items-center gap-2">
                    <User size={13} />
                    User Info
                  </button>
                  <button onClick={openTransactions} className="w-full text-left px-3 py-2 rounded-lg text-xs text-sky-100 hover:bg-[#13284d] inline-flex items-center gap-2">
                    <ListOrdered size={13} />
                    Transactions
                  </button>
                  <button onClick={handleMenuLogout} className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-300 hover:bg-[#3a1a28] inline-flex items-center gap-2">
                    <Ban size={13} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      </div>

      <AnimatePresence>
        {showFlowPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#030712]/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 8, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="glass-strong rounded-2xl w-full max-w-xl border border-white/20 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-200">Control Flow</p>
                  <h3 className="text-base font-bold text-white">Trigger System Pipeline</h3>
                </div>
                <button
                  onClick={closeFlowPopup}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-white/20 text-sky-100 hover:bg-white/10"
                  aria-label="Close popup"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                <TimelineStep
                  status={claim.status ? 'done' : 'waiting'}
                  icon={<AlertTriangle size={11} />}
                  title="Event Triggered"
                  desc="Disruption signal received"
                  time="Instant"
                />
                <TimelineStep
                  status={
                    claim.status === 'processing' ? 'active'
                      : ['validating', 'scoring', 'approved', 'rejected'].includes(claim.status) ? 'done'
                        : 'waiting'
                  }
                  icon={<ShieldCheck size={11} />}
                  title="Fraud Validation"
                  desc="GPS, IP, behavioral analysis"
                  time="< 1 sec"
                />
                <TimelineStep
                  status={
                    claim.status === 'validating' ? 'active'
                      : ['scoring', 'approved', 'rejected'].includes(claim.status) ? 'done'
                        : 'waiting'
                  }
                  icon={<Search size={11} />}
                  title="Risk Scoring"
                  desc={claim.riskScore > 15 ? `Score: ${claim.riskScore}/100` : 'Analyzing patterns...'}
                />
                <TimelineStep
                  status={claim.status === 'approved' ? 'done' : claim.status === 'rejected' ? 'rejected' : 'waiting'}
                  icon={<Landmark size={11} />}
                  title={claim.status === 'rejected' ? 'Claim Rejected' : 'Payout Processed'}
                  desc={claim.status === 'approved' ? `INR ${claim.payout} deposited` : claim.reason || 'Awaiting approval'}
                  highlight={claim.status === 'approved'}
                />
              </div>

              <p className="mt-3 text-[10px] text-cyan-200">
                {['approved', 'rejected'].includes(claim.status)
                  ? 'This popup will auto-close after 7 seconds.'
                  : 'Flow is running...'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSupportConstructionPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1600] bg-[#030712]/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 8, opacity: 0 }}
              className="rounded-2xl bg-[#0b1732] border border-[#2b4472] w-full max-w-md p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-sky-100">Support</h3>
                <button
                  type="button"
                  onClick={() => setShowSupportConstructionPopup(false)}
                  className="w-7 h-7 rounded-md border border-[#2b4472] text-sky-100 hover:bg-[#13284d] inline-flex items-center justify-center"
                >
                  <X size={13} />
                </button>
              </div>
              <p className="mt-3 text-sm text-sky-200">This page is under construction.</p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSupportConstructionPopup(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#1b3f7c] text-white text-xs font-semibold hover:bg-[#24539f]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-20 flex flex-1 min-h-0 gap-3 px-3 pb-3 pt-3 overflow-hidden">
      {/* ═══════════ LEFT SIDEBAR — SIMULATION PANEL ═══════════ */}
      <motion.aside
        initial={{ x: -30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-[300px] min-w-[300px] h-full p-3 z-10 overflow-y-auto"
      >
        <div className="glass-strong rounded-2xl p-4 relative overflow-hidden h-full flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

          {/* Header + Toggle */}
          <div className="flex justify-between items-center mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-blue-400" />
              <h2 className="text-sm font-heading font-bold text-slate-100 tracking-wide">Simulation Controls</h2>
            </div>
            <div className="flex glass-control rounded-full p-0.5">
              {['LIVE', 'SIMULATION'].map(m => (
                <button
                  key={m}
                  onClick={() => setSim(p => ({ ...p, mode: m }))}
                  className={`px-2 py-0.5 text-[9px] rounded-full font-bold transition-all tracking-wider ${
                    sim.mode === m
                      ? (m === 'LIVE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400')
                      : 'text-sky-200'
                  }`}
                >
                  {m === 'SIMULATION' ? 'SIM' : m}
                </button>
              ))}
            </div>
          </div>

          <div className={`flex-1 flex flex-col gap-3 min-h-0 transition-all duration-300 ${sim.mode === 'LIVE' ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
            {/* Quick Trigger Buttons */}
            <div className="shrink-0">
              <label className="text-[9px] text-sky-300 uppercase tracking-widest font-bold mb-1.5 block">Quick Triggers</label>
              <div className="grid grid-cols-3 gap-1">
                {Object.keys(PRESETS).map(k => {
                  const iconMap = {
                    'Moderate Rain': <CloudRain size={11} />,
                    'Severe Rain': <CloudLightning size={11} />,
                    'Heat': <Flame size={11} />,
                    'Cyclone': <Zap size={11} />,
                    'Curfew': <Ban size={11} />,
                  };
                  return (
                    <button
                      key={k}
                      onClick={() => applyPreset(k)}
                      className="flex flex-col items-center gap-0.5 px-1.5 py-2 text-[10px] rounded-lg glass-card-soft text-sky-200 hover:bg-white/[0.09] hover:border-white/20 hover:text-slate-100 transition-all leading-tight text-center"
                    >
                      {iconMap[k]}
                      <span className="truncate w-full">{k}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-2 shrink-0">
              <div>
                <label className="flex justify-between text-[10px] text-sky-300 mb-1">
                  <span>Rainfall</span>
                  <span className={`font-bold ${sim.rainfall >= 45 ? 'text-blue-400' : 'text-sky-200'}`}>{sim.rainfall} mm</span>
                </label>
                <input
                  type="range" min="0" max="150" value={sim.rainfall}
                  onChange={e => { setTriggerSource('manual'); setSim(p => ({ ...p, rainfall: +e.target.value })); resetClaim(); }}
                  className="w-full"
                />
                <div className="flex justify-between text-[8px] text-sky-200 mt-0.5">
                  <span>0</span><span className="text-yellow-600">45</span><span className="text-red-600">60</span><span>150</span>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-[10px] text-sky-300 mb-1">
                  <span>Temperature</span>
                  <span className={`font-bold ${sim.temperature > 45 ? 'text-orange-400' : 'text-sky-200'}`}>{sim.temperature}°C</span>
                </label>
                <input
                  type="range" min="20" max="60" value={sim.temperature}
                  onChange={e => { setTriggerSource('manual'); setSim(p => ({ ...p, temperature: +e.target.value })); resetClaim(); }}
                  className="w-full accent-orange"
                />
              </div>
            </div>

            {/* Event Dropdown */}
            <div className="shrink-0">
              <label className="text-[9px] text-sky-300 uppercase tracking-widest font-bold mb-1 block">Event</label>
              <select
                value={sim.event}
                onChange={e => { setTriggerSource('manual'); setSim(p => ({ ...p, event: e.target.value })); resetClaim(); }}
                className="w-full py-2 px-3 glass-control rounded-lg text-xs text-sky-100 outline-none focus:border-blue-500/30 transition-all"
              >
                <option value="None">No Event</option>
                <option value="Heavy Rain">Heavy Rain</option>
                <option value="Cyclone">Cyclone</option>
                <option value="Curfew">Curfew</option>
                <option value="Strike">Strike</option>
              </select>
            </div>

            {/* Trigger Button — always visible */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={triggerSystem}
              disabled={!isAlertActive || isProcessing}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border shrink-0 ${
                isAlertActive && !isProcessing
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-400/20 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20'
                  : 'glass-control text-sky-200 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
              ) : (
                <><Activity size={14} /> Trigger System</>
              )}
            </motion.button>

            {/* Coverage Profile — compact inline */}
            <div className="shrink-0 mt-auto pt-2 border-t border-white/[0.04]">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-sky-200">₹{userProfile?.weeklyIncome || 5000}/wk</span>
                <span className="text-sky-200">{userProfile?.workingHours || 50} hrs</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] rounded font-bold uppercase border border-emerald-500/15">
                  {userProfile?.plan || 'Basic'}
                </span>
              </div>
              <div className="text-[9px] text-sky-200 mt-1 truncate">
                {profileState?.city && profileState?.state ? `${profileState.city}, ${profileState.state}` : 'Location pending'}
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="relative z-20 flex-1 h-full flex flex-col gap-3 p-3 pl-0 overflow-y-auto overflow-x-hidden"
      >
        {activePage === 'OPERATIONS' ? (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-[1.04fr_0.96fr] gap-3 flex-1 min-h-[560px] items-stretch">
              <div className="glass rounded-2xl p-0 border border-white/15 min-h-[560px] overflow-hidden">
                <IdleSimulationMap
                  mode="LIVE"
                  initialCenter={{
                    lat: Number(geoPosition?.lat || 13.0827),
                    lng: Number(geoPosition?.lng || 80.2707),
                  }}
                  livePosition={geoPosition}
                  markerStatus={mapMarkerStatus}
                  movementIntervalMs={1500}
                  onLocationUpdate={(next) => handleLocationUpdate(next, { source: 'live' })}
                  className="h-full min-h-[560px] rounded-2xl border-0"
                />
              </div>

              <div className="grid grid-rows-[auto_minmax(160px,1fr)_minmax(180px,1fr)] gap-3 min-h-[560px]">
            {/* Live Weather Card */}
            <div className="glass rounded-2xl p-4 border-white/5 min-h-[200px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-sky-200 font-heading">Live Weather</h3>
                <button
                  onClick={() => {
                    fetchLiveWeather();
                    fetchWeatherTrend();
                  }}
                  disabled={weatherLoading}
                  className="text-[9px] text-blue-400 disabled:text-sky-200"
                >
                  {weatherLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              {liveWeather ? (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="glass-card-soft rounded-lg py-2 px-1">
                    <div className="text-[8px] text-sky-200 uppercase">Temp</div>
                    <div className="text-[11px] font-bold text-blue-300">{liveWeather?.temperatureC ?? '--'}°C</div>
                  </div>
                  <div className="glass-card-soft rounded-lg py-2 px-1">
                    <div className="text-[8px] text-sky-200 uppercase">Rain</div>
                    <div className="text-[11px] font-bold text-cyan-300">{liveWeather?.rainfallMm1h ?? 0} mm</div>
                  </div>
                  <div className="glass-card-soft rounded-lg py-2 px-1">
                    <div className="text-[8px] text-sky-200 uppercase">Humidity</div>
                    <div className="text-[11px] font-bold text-teal-300">{liveWeather?.humidity ?? '--'}%</div>
                  </div>
                  <div className="glass-card-soft rounded-lg py-2 px-1">
                    <div className="text-[8px] text-sky-200 uppercase">Wind</div>
                    <div className="text-[11px] font-bold text-indigo-300">{liveWeather?.windSpeed ?? '--'} m/s</div>
                  </div>
                </div>
              ) : weatherError ? (
                <p className="text-[10px] text-red-400">{weatherError}</p>
              ) : (
                <p className="text-[10px] text-sky-300">Waiting for weather data</p>
              )}
              <p className="text-[9px] text-sky-200 mt-2 truncate">
                {liveWeather?.condition || 'Waiting for weather data'}
              </p>
              {weatherError && liveWeather && (
                <p className="text-[9px] text-amber-400 mt-1 truncate">
                  Last refresh warning: {weatherError}
                </p>
              )}
              {weatherTrend?.highestProbabilityCondition && (
                <div className="mt-2 glass-card-soft rounded-lg p-2">
                  <p className="text-[9px] text-sky-300 uppercase tracking-wider">Highest probability trend</p>
                  <p className="text-[11px] text-emerald-300 font-semibold">
                    {weatherTrend.highestProbabilityCondition.condition} ({weatherTrend.highestProbabilityCondition.probability}%)
                  </p>
                  <p className="text-[9px] text-sky-200">
                    Rain event probability: {weatherTrend.rainEventProbability}% over next {weatherTrend.sourceWindowHours}h
                  </p>
                </div>
              )}
            </div>

            {/* Risk Score Gauge */}
            <div className="glass rounded-2xl p-5 border-white/5 flex items-center justify-between h-full min-h-[160px]">
              <div className="flex-1">
                <h3 className="text-xs font-bold text-sky-200 font-heading mb-1">Fraud Risk Score</h3>
                <p className="text-[10px] text-sky-200 leading-relaxed max-w-[160px]">
                  Multi-layer AI validation: GPS, behavioral, environmental.
                </p>
                <div className="mt-3">
                  <RiskBadge score={claim.riskScore} status={claim.status} />
                </div>
              </div>
              <RiskGauge score={claim.riskScore} status={claim.status} />
            </div>

            {/* Payout Card */}
            <div className="glass rounded-2xl p-5 border-white/5 relative overflow-hidden h-full min-h-[180px]">
              <AnimatePresence>
                {claim.status === 'approved' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] to-transparent pointer-events-none"
                  />
                )}
              </AnimatePresence>

              <h3 className="text-xs font-bold text-sky-200 font-heading mb-3 relative z-10 flex items-center gap-2">
                Income Protected
                <ShieldCheck size={12} className="text-emerald-500/60" />
              </h3>

              <div className="flex items-end justify-between relative z-10">
                <div>
                  <div className="text-[9px] text-sky-200 uppercase tracking-widest mb-1">Instant Payout</div>
                  <div className="text-3xl font-bold font-heading">
                    {claim.status === 'approved' ? (
                      <CountUp value={claim.payout} />
                    ) : (
                      <span className="text-sky-100">₹ 0.00</span>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {claim.status === 'approved' && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 glow-teal"
                    >
                      <Landmark size={20} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
            </div>

            <div className="glass rounded-lg p-3 border border-white/20 shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-sky-200 mb-2">Recent Transactions</p>
              {recentTransactions.length === 0 ? (
                <p className="text-[10px] text-sky-300">No transactions yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {recentTransactions.map(txn => (
                    <div key={`recent-${txn.id}`} className="flex items-center justify-between text-[10px] gap-2">
                      <span className="text-slate-100 truncate pr-2">{txn.description}</span>
                      <span className={`${String(txn.status || '').toLowerCase() === 'rejected' ? 'text-red-300' : 'text-emerald-300'} shrink-0`}>{txn.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : activePage === 'NOTIFICATIONS' ? (
          <div className="glass rounded-2xl p-5 border-white/5 flex-1 min-h-0 overflow-y-auto">
            <div className="mb-3">
              <button
                type="button"
                onClick={goToMainPage}
                className="px-3 py-1.5 rounded-lg border border-cyan-300/35 bg-cyan-500/20 text-cyan-100 text-xs font-semibold hover:bg-cyan-500/30 transition-all"
              >
                Back to Main Page
              </button>
            </div>

            <h3 className="text-lg font-bold text-sky-100">Notifications</h3>
            <p className="text-sm text-sky-200 mt-1">Billing and account updates</p>

            <div className="mt-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="glass-card-soft rounded-xl p-4 border border-white/10">
                  <p className="text-sm text-sky-100">No new notifications.</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div key={item.id} className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold text-amber-100">{item.title}</p>
                    <p className="text-xs text-amber-200/90 mt-1">{item.message}</p>
                    <button
                      type="button"
                      onClick={handleWeeklyPremiumPayment}
                      className="mt-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-amber-300/40 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30"
                    >
                      Pay now
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activePage === 'SUPPORT' ? (
          <div className="glass rounded-2xl p-5 border-white/5 flex-1 min-h-0 overflow-y-auto">
            <div className="mb-3">
              <button
                type="button"
                onClick={goToMainPage}
                className="px-3 py-1.5 rounded-lg border border-cyan-300/35 bg-cyan-500/20 text-cyan-100 text-xs font-semibold hover:bg-cyan-500/30 transition-all"
              >
                Back to Main Page
              </button>
            </div>
            <h3 className="text-lg font-bold text-sky-100">Support Center</h3>
            <p className="text-sm text-sky-200 mt-1">How can we help you today?</p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="glass-card-soft rounded-xl p-4 border border-white/10">
                <h4 className="text-sm font-semibold text-white">Contact Support</h4>
                <p className="text-xs text-sky-200 mt-1">Reach our support team for account and claim help.</p>
                <button type="button" onClick={handleSupportActionClick} className="mt-3 px-3 py-1.5 rounded-lg bg-[#1b3f7c] text-white text-xs font-semibold hover:bg-[#24539f]">Start Chat</button>
              </div>
              <div className="glass-card-soft rounded-xl p-4 border border-white/10">
                <h4 className="text-sm font-semibold text-white">Create Ticket</h4>
                <p className="text-xs text-sky-200 mt-1">Open a support ticket and track your issue status.</p>
                <button type="button" onClick={handleSupportActionClick} className="mt-3 px-3 py-1.5 rounded-lg bg-[#1b3f7c] text-white text-xs font-semibold hover:bg-[#24539f]">Create Ticket</button>
              </div>
              <div className="glass-card-soft rounded-xl p-4 border border-white/10">
                <h4 className="text-sm font-semibold text-white">Knowledge Base</h4>
                <p className="text-xs text-sky-200 mt-1">Browse guides for payments, fraud checks, and coverage.</p>
                <button type="button" onClick={handleSupportActionClick} className="mt-3 px-3 py-1.5 rounded-lg bg-[#1b3f7c] text-white text-xs font-semibold hover:bg-[#24539f]">View Articles</button>
              </div>
              <div className="glass-card-soft rounded-xl p-4 border border-white/10">
                <h4 className="text-sm font-semibold text-white">Call Support</h4>
                <p className="text-xs text-sky-200 mt-1">Request a callback from our support team.</p>
                <button type="button" onClick={handleSupportActionClick} className="mt-3 px-3 py-1.5 rounded-lg bg-[#1b3f7c] text-white text-xs font-semibold hover:bg-[#24539f]">Request Callback</button>
              </div>
            </div>
          </div>
        ) : activePage === 'TRANSACTIONS' ? (
          <div className="glass rounded-2xl p-4 border-white/5 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToMainPage}
                  className="px-3 py-1.5 rounded-lg border border-cyan-300/35 bg-cyan-500/20 text-cyan-100 text-[11px] font-semibold hover:bg-cyan-500/30 transition-all"
                >
                  Back to Main Page
                </button>
                <h3 className="text-sm font-bold font-heading">Transaction History</h3>
              </div>
              <button
                type="button"
                onClick={fetchTransactions}
                disabled={transactionsLoading}
                className="text-[10px] text-blue-400 disabled:text-sky-200"
              >
                {transactionsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allTransactions.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-sky-300">
                  No transactions yet.
                </div>
              ) : (
                <>
                  <div className="glass-card rounded-xl border-red-400/25 bg-red-500/[0.08] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-300">Rejected Transactions</p>
                      <span className="text-[10px] text-red-200">{rejectedTransactions.length}</span>
                    </div>
                    {rejectedTransactions.length === 0 ? (
                      <p className="text-[10px] text-red-200/80">No rejected transactions yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {rejectedTransactions.map(txn => (
                          <div key={`rej-${txn.id}`} className="glass-card-soft rounded-lg border border-red-300/25 p-2">
                            <p className="text-[11px] text-slate-100 font-medium">{txn.description}</p>
                            <p className="text-[10px] text-sky-200 mt-0.5">{new Date(txn.timestamp).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-sky-200 uppercase tracking-wider mt-1">All Transactions</p>
                  {allTransactions.map(txn => (
                    <div key={txn.id} className="glass-card-soft rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-100 font-medium">{txn.description}</p>
                          <p className="text-[10px] text-sky-300 mt-1">
                            {new Date(txn.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-[10px] uppercase font-semibold ${String(txn.status || '').toLowerCase() === 'rejected' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {txn.status}
                          </p>
                          <p className="text-sm font-semibold text-blue-300">₹ {Number(txn.amount || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-sky-200 mt-1">Type: {txn.type}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-5 border-white/5 flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToMainPage}
                  className="px-3 py-1.5 rounded-lg border border-cyan-300/35 bg-cyan-500/20 text-cyan-100 text-[11px] font-semibold hover:bg-cyan-500/30 transition-all"
                >
                  Back to Main Page
                </button>
                <h3 className="text-base font-bold font-heading text-sky-100">User Information</h3>
              </div>
              {!isEditingUserInfo ? (
                <button
                  type="button"
                  onClick={() => setIsEditingUserInfo(true)}
                  className="px-3 py-1.5 rounded-lg border border-cyan-300/40 bg-cyan-500/20 text-cyan-100 text-[11px] font-semibold hover:bg-cyan-500/30 transition-all"
                >
                  Edit Info
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveUserInfo}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-[11px] font-semibold hover:bg-emerald-500/30 transition-all"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelUserInfoEdit}
                    className="px-3 py-1.5 rounded-lg glass-control text-sky-100 text-[11px] font-semibold hover:bg-white/[0.09] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {isEditingUserInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UserInfoInput label="Name" value={userInfoForm.name} onChange={(value) => handleUserInfoFieldChange('name', value)} />
                <UserInfoInput label="Phone" value={userInfoForm.phone} onChange={(value) => handleUserInfoFieldChange('phone', value)} />
                <div className="glass-card-soft rounded-xl px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-sky-300">Plan</p>
                  <select
                    value={userInfoForm.plan}
                    onChange={(e) => handleUserInfoFieldChange('plan', e.target.value)}
                    className="w-full mt-1 py-2 px-2 glass-control rounded-lg text-sm text-slate-100 outline-none focus:border-cyan-400/60"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Standard">Standard</option>
                    <option value="Premium">Premium</option>
                  </select>
                </div>
                <UserInfoInput label="Delivery Mode" value={userInfoForm.deliveryMode} onChange={(value) => handleUserInfoFieldChange('deliveryMode', value)} />
                <UserInfoInput label="City" value={lockedLiveCity || '--'} locked note="Locked to live address" />
                <UserInfoInput label="State" value={lockedLiveState || '--'} locked note="Locked to live address" />
                <UserInfoInput label="Weekly Income" type="number" value={userInfoForm.weeklyIncome} onChange={(value) => handleUserInfoFieldChange('weeklyIncome', value)} />
                <UserInfoInput label="Working Hours / Week" type="number" value={userInfoForm.workingHours} onChange={(value) => handleUserInfoFieldChange('workingHours', value)} />
                <div className="glass-card-soft rounded-xl px-3 py-2 md:col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-sky-300">Email</p>
                  <p className="text-sm text-slate-100 mt-1 break-words">{userEmail || '--'}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userInfoRows.map(([label, value]) => (
                  <div key={label} className="glass-card-soft rounded-xl px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-sky-300">{label}</p>
                    <p className="text-sm text-slate-100 mt-1 break-words">{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 glass-card-soft rounded-xl border-cyan-300/25 bg-cyan-500/[0.08] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-cyan-200">Live Location Snapshot</p>
              <p className="text-sm text-cyan-100 mt-1">{geoAddress?.displayName || liveGpsLabel}</p>
            </div>
          </div>
        )}
      </motion.main>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function TimelineStep({ status, icon, title, desc, time, highlight }) {
  const colors = {
    done: 'bg-emerald-500 border-emerald-500 text-black',
    active: 'bg-blue-500 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)] animate-pulse',
    rejected: 'bg-red-500 border-red-500 text-white',
    waiting: 'glass-control text-sky-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: status === 'waiting' ? 0.35 : 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex gap-3 pl-1"
    >
      <div className={`relative z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${colors[status]}`}>
        {icon}
      </div>
      <div className="pb-5">
        <h4 className={`text-xs font-semibold ${highlight && status === 'done' ? 'text-emerald-400' : 'text-sky-100'}`}>{title}</h4>
        {desc && <p className="text-[10px] text-sky-300 mt-0.5">{desc}</p>}
        {time && <p className="text-[8px] text-sky-200 mt-0.5 font-mono tracking-wider">{time}</p>}
      </div>
    </motion.div>
  );
}

function RiskGauge({ score, status }) {
  const isPending = !status;
  const effectiveScore = isPending ? 0 : score;
  const color = isPending ? '#64748b' : score > 70 ? '#ef4444' : score > 30 ? '#eab308' : '#10b981';
  const labelColor = isPending ? 'text-sky-300' : score > 70 ? 'text-red-400' : score > 30 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
        <motion.circle
          cx="18" cy="18" r="15.9"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="100"
          initial={{ strokeDashoffset: 100 }}
          animate={{ strokeDashoffset: 100 - effectiveScore }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-lg font-bold font-heading ${labelColor}`}>{isPending ? '--' : score}</span>
        <span className="text-[7px] text-sky-200 uppercase tracking-widest">Risk</span>
      </div>
    </div>
  );
}

function RiskBadge({ score, status }) {
  if (!status) return <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-500/10 text-sky-200 font-bold border border-slate-400/25">• Pending</span>;
  if (score <= 30) return <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/15">✓ Approved</span>;
  if (score <= 70) return <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold border border-yellow-500/15">⚠ Flagged</span>;
  return <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold border border-red-500/15">✕ Rejected</span>;
}

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef();

  useEffect(() => {
    const end = parseFloat(value) || 0;
    const dur = 1500;
    const start = performance.now();

    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setDisplay((end * ease).toFixed(2));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span className="text-emerald-400">₹ {display}</span>;
}

function UserInfoInput({ label, value, onChange, type = 'text', locked = false, note = '' }) {
  return (
    <div className="glass-card-soft rounded-xl px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-sky-300">{label}</p>
        {locked && <span className="text-[9px] uppercase tracking-wider text-cyan-200">Locked</span>}
      </div>
      {locked ? (
        <>
          <div className="w-full mt-1 py-2 px-2 glass-control border-cyan-300/25 rounded-lg text-sm text-cyan-100">
            {value || '--'}
          </div>
          {note && <p className="text-[9px] text-cyan-200 mt-1">{note}</p>}
        </>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1 py-2 px-2 glass-control rounded-lg text-sm text-slate-100 outline-none focus:border-cyan-400/60"
        />
      )}
    </div>
  );
}
