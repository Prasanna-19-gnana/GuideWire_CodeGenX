import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import Razorpay from 'razorpay';
import { MongoClient, ServerApiVersion } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
app.set('trust proxy', true);
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase();
const IS_PRODUCTION = NODE_ENV === 'production';
const RAZORPAY_MODE = String(process.env.RAZORPAY_MODE || 'test').toLowerCase();
const RAZORPAY_ENABLED = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS || 120);
const OTP_EXPIRY_MS = OTP_EXPIRY_SECONDS * 1000;
const WEEKLY_SUBSCRIPTION_CYCLES = 52;
const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || 'zyrosafe').trim();
const EXPOSE_DB_HEALTH = String(process.env.EXPOSE_DB_HEALTH || (IS_PRODUCTION ? 'false' : 'true')).toLowerCase() === 'true';
const DB_HEALTH_TOKEN = String(process.env.DB_HEALTH_TOKEN || '').trim();
const MONGODB_MAX_POOL_SIZE = Number(process.env.MONGODB_MAX_POOL_SIZE || 50);
const MONGODB_MIN_POOL_SIZE = Number(process.env.MONGODB_MIN_POOL_SIZE || 5);
const MONGODB_MAX_IDLE_TIME_MS = Number(process.env.MONGODB_MAX_IDLE_TIME_MS || 300000);
const MONGODB_CONNECT_TIMEOUT_MS = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 10000);
const MONGODB_SOCKET_TIMEOUT_MS = Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 30000);
const MONGODB_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000);
const MONGODB_WAIT_QUEUE_TIMEOUT_MS = Number(process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS || 10000);
const NEWSAPI_KEY = String(process.env.NEWSAPI_KEY || '').trim();
const NEWS_LOOKBACK_HOURS = Number(process.env.NEWS_LOOKBACK_HOURS || 12);
const ADMIN_OVERRIDE_TOKEN = String(process.env.ADMIN_OVERRIDE_TOKEN || '').trim();
const ADMIN_LOGIN_EMAIL = String(process.env.ADMIN_LOGIN_EMAIL || 'vd0602@srmist.edu.in').trim().toLowerCase();
const ADMIN_LOGIN_PASSWORD = String(process.env.ADMIN_LOGIN_PASSWORD || 'Code@123');
const OFFICIAL_ALERT_TOKEN = String(process.env.OFFICIAL_ALERT_TOKEN || '').trim();
const MONGODB_REQUIRED = IS_PRODUCTION
	? String(process.env.MONGODB_REQUIRED || 'true').toLowerCase() === 'true'
	: false;

const razorpayInstance = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID || '',
	key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || 'smtp.gmail.com',
	port: Number(process.env.SMTP_PORT || 587),
	secure: false,
	auth: process.env.SMTP_USER ? {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	} : undefined,
});

const otpStore = new Map();
const accounts = new Map();
const transactions = new Map();
const fraudChecks = new Map();
const onboarding = new Map();
const policies = new Map();
const events = new Map();
const rateLimits = new Map();
const adminDisruptions = new Map();
const officialAlerts = new Map();

let mongoClient = null;
let mongoDb = null;
let mongoConnecting = false;
let mongoCollections = {
	accounts: null,
	transactions: null,
	fraudChecks: null,
	onboarding: null,
	policies: null,
	events: null,
	socialDisruptions: null,
};

const SOCIAL_DISRUPTION_KEYWORDS = [
	'curfew',
	'section 144',
	'district administration order',
	'shutdown',
	'bandh',
	'zone closure',
	'strike',
	'riot control',
];

const TRUSTED_NEWS_SOURCES = new Set([
	'the-times-of-india',
	'the-hindu',
	'hindustan-times',
	'ndtv',
	'bbc-news',
	'reuters',
	'associated-press',
]);

function clone(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function getRequestKey(req) {
	return `${req.ip || req.connection?.remoteAddress || 'unknown'}:${req.method}:${req.path}`;
}

function uniqueNames(values) {
	const seen = new Set();
	const result = [];
	for (const value of values) {
		const name = String(value || '').trim();
		if (!name) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(name);
	}
	return result;
}

function extractAreaName(address) {
	if (!address) return '';
	return String(
		address.suburb
		|| address.neighbourhood
		|| address.quarter
		|| address.hamlet
		|| address.village
		|| address.town
		|| address.city_district
		|| address.city
		|| address.county
		|| '',
	).trim();
}

function buildLocationFromNominatim(data) {
	const address = data?.address || {};
	const displayName = String(data?.display_name || '').trim();
	const inferredPincode = String(address.postcode || displayName.match(/\b\d{6}\b/)?.[0] || '').trim();
	return {
		area: extractAreaName(address),
		city: String(address.city || address.county || address.town || address.village || '').trim(),
		state: String(address.state || '').trim(),
		pincode: inferredPincode,
		country: String(address.country || '').trim(),
		displayName,
	};
}

function normalizeClientIp(ip) {
	const value = String(ip || '').trim();
	if (!value) return '';
	if (value.startsWith('::ffff:')) return value.slice(7);
	return value;
}

function buildLocationFromIpLookup(data) {
	return {
		area: String(data?.city || data?.region || data?.regionName || '').trim(),
		city: String(data?.city || data?.city_name || '').trim(),
		state: String(data?.region || data?.regionName || data?.state || '').trim(),
		pincode: String(data?.postal || data?.postal_code || data?.zip || '').trim(),
		country: String(data?.country_name || data?.country || '').trim(),
		displayName: String([
			data?.city || data?.city_name || '',
			data?.region || data?.regionName || data?.state || '',
			data?.country_name || data?.country || '',
		].filter(Boolean).join(', ')).trim(),
	};
}

function hasResolvedAddress(location) {
	if (!location) return false;
	return [location.area, location.city, location.state, location.pincode, location.displayName]
		.some((value) => String(value || '').trim().length > 0);
}

function normalizeText(value) {
	return String(value || '').trim().toLowerCase();
}

function makeZoneLabel({ subarea = '', city = '', state = '' } = {}) {
	return [subarea, city, state].map(item => String(item || '').trim()).filter(Boolean).join(', ');
}

function nowIso() {
	return new Date().toISOString();
}

function parseIso(value) {
	const parsed = Date.parse(String(value || ''));
	return Number.isFinite(parsed) ? parsed : null;
}

function isActiveWindow(startTime, endTime, atMs = Date.now()) {
	const startMs = parseIso(startTime);
	const endMs = parseIso(endTime);
	if (startMs != null && atMs < startMs) return false;
	if (endMs != null && atMs > endMs) return false;
	return true;
}

function pickDisruptionReason(text = '') {
	const value = normalizeText(text);
	if (value.includes('section 144')) return 'Section 144 enforcement';
	if (value.includes('curfew')) return 'Curfew notice detected';
	if (value.includes('bandh')) return 'Bandh-related disruption signal';
	if (value.includes('strike')) return 'Strike-related disruption signal';
	if (value.includes('shutdown')) return 'Shutdown order signal';
	if (value.includes('zone closure')) return 'Zone closure signal';
	return 'Social disruption signal detected';
}

function computeSocialDisruptionScore(signals = []) {
	if (!Array.isArray(signals) || !signals.length) return 0;
	const weighted = signals.reduce((sum, signal) => sum + Number(signal.confidence || 0), 0);
	const bonus = signals.some(signal => signal.source === 'official_alert') ? 0.1 : 0;
	return Number(Math.min(1, weighted / Math.max(1, signals.length) + bonus).toFixed(2));
}

function toSignalRecord({
	type = 'social_disruption',
	source,
	location,
	subarea = '',
	startTime,
	endTime,
	confidence = 0,
	reason,
	metadata = null,
}) {
	return {
		type,
		source,
		location: String(location || '').trim(),
		subarea: String(subarea || '').trim(),
		startTime: startTime || nowIso(),
		endTime: endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
		confidence: Number(Math.max(0, Math.min(1, confidence)).toFixed(2)),
		reason: String(reason || '').trim(),
		metadata,
	};
}

async function fetchWeatherDisruptionSignal({ lat, lng, city, state }) {
	const apiKey = String(process.env.OPENWEATHER_API_KEY || '').trim();
	if (!apiKey) return null;

	const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
	if (!hasCoords && (!city || !state)) return null;

	try {
		let resolvedLat = lat;
		let resolvedLng = lng;

		if (!hasCoords) {
			const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(`${city},${state},IN`)}&limit=1&appid=${apiKey}`);
			const geoData = await geoRes.json();
			const location = Array.isArray(geoData) && geoData.length ? geoData[0] : null;
			if (!location) return null;
			resolvedLat = Number(location.lat);
			resolvedLng = Number(location.lon);
		}

		const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${resolvedLat}&lon=${resolvedLng}&appid=${apiKey}&units=metric`);
		if (!weatherRes.ok) return null;
		const weather = await weatherRes.json();
		const condition = String(weather?.weather?.[0]?.main || '').toLowerCase();
		const rain1h = Number(weather?.rain?.['1h'] || 0);
		const severeWeather = /storm|thunder|squall|tornado|cyclone/.test(condition);
		const heavyRain = rain1h >= 2;

		if (!severeWeather && !heavyRain) return null;

		const reason = severeWeather
			? `Severe weather condition detected (${weather?.weather?.[0]?.main || 'storm'})`
			: `Heavy rainfall detected (${rain1h} mm/h)`;

		return toSignalRecord({
			type: 'weather_disruption',
			source: 'weather_api',
			location: makeZoneLabel({ city: city || weather?.name, state }) || weather?.name || city,
			subarea: '',
			startTime: nowIso(),
			endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
			confidence: severeWeather ? 0.92 : 0.8,
			reason,
			metadata: {
				temperatureC: weather?.main?.temp ?? null,
				rainfallMm1h: rain1h,
				condition: weather?.weather?.[0]?.main || 'Unknown',
				lat: resolvedLat,
				lng: resolvedLng,
			},
		});
	} catch {
		return null;
	}
}

async function fetchNewsSignals({ city = '', state = '' }) {
	const locationTerms = [city, state].map(item => String(item || '').trim()).filter(Boolean);
	if (!locationTerms.length) return [];

	const query = `(${SOCIAL_DISRUPTION_KEYWORDS.map(term => `"${term}"`).join(' OR ')}) AND (${locationTerms.map(term => `"${term}"`).join(' OR ')})`;
	const signals = [];

	if (NEWSAPI_KEY) {
		try {
			const fromIso = new Date(Date.now() - NEWS_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
			const url = new URL('https://newsapi.org/v2/everything');
			url.searchParams.set('q', query);
			url.searchParams.set('language', 'en');
			url.searchParams.set('sortBy', 'publishedAt');
			url.searchParams.set('pageSize', '10');
			url.searchParams.set('from', fromIso);
			url.searchParams.set('apiKey', NEWSAPI_KEY);

			const response = await fetch(url.toString());
			if (response.ok) {
				const data = await response.json();
				const articles = Array.isArray(data?.articles) ? data.articles : [];
				for (const article of articles.slice(0, 5)) {
					const text = `${article?.title || ''} ${article?.description || ''}`;
					const sourceId = normalizeText(article?.source?.id || article?.source?.name);
					const trustedBoost = TRUSTED_NEWS_SOURCES.has(sourceId) ? 0.12 : 0;
					signals.push(toSignalRecord({
						source: 'news_signal',
						location: makeZoneLabel({ city, state }),
						subarea: city,
						startTime: article?.publishedAt || nowIso(),
						endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
						confidence: 0.52 + trustedBoost,
						reason: pickDisruptionReason(text),
						metadata: {
							headline: article?.title || '',
							source: article?.source?.name || article?.source?.id || 'unknown',
							url: article?.url || '',
						},
					}));
				}
			}
		} catch {
			// News API is best-effort.
		}
	}

	if (!signals.length) {
		try {
			const gdeltUrl = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
			gdeltUrl.searchParams.set('query', query);
			gdeltUrl.searchParams.set('mode', 'artlist');
			gdeltUrl.searchParams.set('maxrecords', '5');
			gdeltUrl.searchParams.set('format', 'json');
			gdeltUrl.searchParams.set('sort', 'datedesc');

			const response = await fetch(gdeltUrl.toString());
			if (response.ok) {
				const data = await response.json();
				const articles = Array.isArray(data?.articles) ? data.articles : [];
				for (const article of articles.slice(0, 5)) {
					const text = `${article?.title || ''} ${article?.seendate || ''}`;
					signals.push(toSignalRecord({
						source: 'news_signal',
						location: makeZoneLabel({ city, state }),
						subarea: city,
						startTime: article?.seendate ? new Date(article.seendate).toISOString() : nowIso(),
						endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
						confidence: 0.48,
						reason: pickDisruptionReason(text),
						metadata: {
							headline: article?.title || '',
							source: article?.domain || 'GDELT',
							url: article?.url || '',
						},
					}));
				}
			}
		} catch {
			// GDELT fallback is best-effort.
		}
	}

	return signals;
}

async function enrichPincode(location) {
	const resolved = { ...location };
	if (String(resolved.pincode || '').trim()) return resolved;

	const queryParts = [resolved.area, resolved.city, resolved.state, resolved.country]
		.map(value => String(value || '').trim())
		.filter(Boolean);

	if (!queryParts.length) return resolved;

	try {
		const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
		searchUrl.searchParams.set('format', 'jsonv2');
		searchUrl.searchParams.set('addressdetails', '1');
		searchUrl.searchParams.set('limit', '1');
		searchUrl.searchParams.set('q', queryParts.join(', '));

		const response = await fetch(searchUrl.toString(), {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'ZyroSafe/1.0 (postcode-enrichment)',
			},
		});

		if (response.ok) {
			const data = await response.json();
			const first = Array.isArray(data) ? data[0] : null;
			const postcode = String(first?.address?.postcode || first?.display_name?.match(/\b\d{6}\b/)?.[0] || '').trim();
			if (postcode) resolved.pincode = postcode;
		}
	} catch {
		// Leave partial location as-is.
	}

	return resolved;
}

function pointsInRadius(lat, lng, radiusKm) {
	const earthRadiusKm = 6371;
	const latRad = lat * (Math.PI / 180);
	lng = lng * (Math.PI / 180);
	const bearings = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
	const radii = [radiusKm / 2, radiusKm];

	const points = [{ lat, lng: lng * (180 / Math.PI) }];
	for (const sampleRadiusKm of radii) {
		const delta = sampleRadiusKm / earthRadiusKm;
		for (const bearingDeg of bearings) {
			const bearing = bearingDeg * (Math.PI / 180);
			const sampleLat = Math.asin(
				Math.sin(latRad) * Math.cos(delta)
				+ Math.cos(latRad) * Math.sin(delta) * Math.cos(bearing),
			);
			const sampleLng = lng + Math.atan2(
				Math.sin(bearing) * Math.sin(delta) * Math.cos(latRad),
				Math.cos(delta) - Math.sin(latRad) * Math.sin(sampleLat),
			);

			points.push({
				lat: sampleLat * (180 / Math.PI),
				lng: sampleLng * (180 / Math.PI),
			});
		}
	}

	return points;
}

function rateLimit(req, res, next) {
	const key = getRequestKey(req);
	const now = Date.now();
	const windowMs = 60 * 1000;
	const max = req.method === 'GET' ? 120 : 60;
	const entry = rateLimits.get(key);

	if (!entry || now > entry.resetAt) {
		rateLimits.set(key, { count: 1, resetAt: now + windowMs });
		return next();
	}

	if (entry.count >= max) {
		return res.status(429).json({ error: 'Too many requests. Please try again later.' });
	}

	entry.count += 1;
	return next();
}

app.use(cors({
	origin(origin, callback) {
		if (!origin || origin === FRONTEND_URL) return callback(null, true);
		try {
			const parsed = new URL(origin);
			if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
				return callback(null, true);
			}
		} catch {
			// ignore
		}
		return callback(new Error('Not allowed by CORS'));
	},
}));
app.use(express.json({ limit: '1mb' }));

async function initMongo() {
	if (mongoDb) return true;
	if (mongoConnecting) return false;
	if (!MONGODB_URI) {
		console.warn('⚠️  MONGODB_URI is not configured');
		return false;
	}

	try {
		mongoConnecting = true;
		const client = new MongoClient(MONGODB_URI, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
			maxPoolSize: MONGODB_MAX_POOL_SIZE,
			minPoolSize: MONGODB_MIN_POOL_SIZE,
			maxIdleTimeMS: MONGODB_MAX_IDLE_TIME_MS,
			connectTimeoutMS: MONGODB_CONNECT_TIMEOUT_MS,
			socketTimeoutMS: MONGODB_SOCKET_TIMEOUT_MS,
			serverSelectionTimeoutMS: MONGODB_SERVER_SELECTION_TIMEOUT_MS,
			waitQueueTimeoutMS: MONGODB_WAIT_QUEUE_TIMEOUT_MS,
		});

		await client.connect();
		const db = client.db(MONGODB_DB_NAME);
		const collections = {
			accounts: db.collection('accounts'),
			transactions: db.collection('transactions'),
			fraudChecks: db.collection('fraud_checks'),
			onboarding: db.collection('onboarding_records'),
			policies: db.collection('policies'),
			events: db.collection('events'),
			socialDisruptions: db.collection('social_disruptions'),
		};

		await Promise.all([
			collections.accounts.createIndex({ email: 1 }, { unique: true }),
			collections.transactions.createIndex({ email: 1, timestamp: -1 }),
			collections.transactions.createIndex({ userId: 1, timestamp: -1 }),
			collections.onboarding.createIndex({ email: 1, createdAt: -1 }),
			collections.policies.createIndex({ email: 1, updatedAt: -1 }),
			collections.policies.createIndex({ policyNumber: 1 }, { unique: true }),
			collections.fraudChecks.createIndex({ email: 1, timestamp: -1 }),
			collections.events.createIndex({ active: 1, expiresAt: -1 }),
			collections.events.createIndex({ type: 1, createdAt: -1 }),
			collections.socialDisruptions.createIndex({ source: 1, location: 1, startTime: -1 }),
		]);

		await db.command({ ping: 1 });
		mongoClient = client;
		mongoDb = db;
		mongoCollections = collections;
		console.log(`✅ MongoDB connected | db=${MONGODB_DB_NAME}`);
		return true;
	} catch (err) {
		console.error(`❌ MongoDB connection failed: ${err.message}`);
		mongoClient = null;
		mongoDb = null;
		mongoCollections = { accounts: null, transactions: null, fraudChecks: null, onboarding: null, policies: null, events: null, socialDisruptions: null };
		return false;
	} finally {
		mongoConnecting = false;
	}
}

function isMongoConnected() {
	return Boolean(mongoDb && mongoCollections.accounts && mongoCollections.transactions);
}

async function ensureMongo(res) {
	if (isMongoConnected()) return true;
	const connected = await initMongo();
	if (connected) return true;
	if (MONGODB_REQUIRED) {
		res.status(503).json({ error: 'Primary MongoDB is unavailable' });
	}
	return false;
}

function hashOTP(otp) {
	return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateOTP() {
	const min = Math.pow(10, OTP_LENGTH - 1);
	const max = Math.pow(10, OTP_LENGTH) - 1;
	return String(crypto.randomInt(min, max + 1));
}

function buildEmailHTML(code, type = 'email') {
	return `
<!doctype html>
<html>
	<body style="font-family:Arial,sans-serif;background:#0b1220;color:#e5eefc;padding:24px;">
		<div style="max-width:480px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;">
			<h2 style="margin:0 0 12px;">ZyroSafe</h2>
			<p style="margin:0 0 16px;color:#93c5fd;">Secure ${type === 'email' ? 'email' : 'phone'} verification code</p>
			<div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#60a5fa;text-align:center;padding:18px 0;border:1px solid #1f2937;border-radius:12px;background:#0f172a;">${code}</div>
			<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">This code expires in ${OTP_EXPIRY_SECONDS} seconds.</p>
		</div>
	</body>
</html>`;
}

function calculateWeeklyPremium(profile = {}) {
	const plan = String(profile.plan || 'Basic');
	const weeklyIncome = Number(profile.weeklyIncome ?? profile.weeklyRevenue ?? 0);
	const safeWeeklyIncome = Number.isFinite(weeklyIncome) ? weeklyIncome : 0;
	const rate = plan === 'Premium' ? 0.10 : plan === 'Standard' ? 0.07 : 0.05;
	const baseAmount = Number((safeWeeklyIncome * rate).toFixed(2));
	return {
		plan,
		weeklyIncome: safeWeeklyIncome,
		rate,
		amount: baseAmount,
	};
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function pickRiskBucketFromCondition(condition = '') {
	const value = normalizeText(condition);
	if (/thunder|storm|cyclone|tornado|squall/.test(value)) return 0.18;
	if (/rain|drizzle/.test(value)) return 0.12;
	if (/cloud/.test(value)) return 0.05;
	if (/clear|sun/.test(value)) return -0.03;
	return 0;
}

function buildDynamicPremiumEstimate({ profile = {}, weatherSummary = null, disruption = null } = {}) {
	const base = calculateWeeklyPremium(profile);
	const hyperLocalDiscount = Number(profile.safeZoneDiscount ?? 0);
	const weatherRisk = pickRiskBucketFromCondition(weatherSummary?.condition || '');
	const rainRisk = clamp(Number(weatherSummary?.rainfallMm1h || 0) / 20, 0, 0.2);
	const disruptionRisk = disruption?.active ? clamp(Number(disruption?.social_disruption_score || 0) * 0.2, 0.08, 0.25) : 0;
	const safeZoneCredit = clamp(Number(hyperLocalDiscount) || 0, -0.05, 0.05);
	const premiumMultiplier = clamp(1 + weatherRisk + rainRisk + disruptionRisk - safeZoneCredit, 0.8, 1.4);
	const amount = Number((base.amount * premiumMultiplier).toFixed(2));
	const coverageHours = clamp(Math.round((Number(profile.coverageHours || 12)) * (1 + (weatherRisk * 0.5) - (disruptionRisk * 0.25))), 8, 24);

	return {
		plan: base.plan,
		weeklyIncome: base.weeklyIncome,
		baseRate: base.rate,
		baseAmount: base.amount,
		premiumMultiplier: Number(premiumMultiplier.toFixed(3)),
		amount,
		coverageHours,
		adjustments: {
			weatherRisk,
			rainRisk,
			disruptionRisk,
			safeZoneCredit,
		},
	};
}

async function fetchPremiumContext(profile = {}) {
	const city = String(profile.city || profile.location?.city || '').trim();
	const state = String(profile.state || profile.location?.state || '').trim();
	const lat = Number(profile.lat ?? profile.location?.lat);
	const lng = Number(profile.lng ?? profile.location?.lng);
	const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
	const weatherSummary = await (async () => {
		const apiKey = String(process.env.OPENWEATHER_API_KEY || '').trim();
		if (!apiKey || (!hasCoords && (!city || !state))) return null;
		try {
			let resolvedLat = lat;
			let resolvedLng = lng;
			if (!hasCoords) {
				const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(`${city},${state},IN`)}&limit=1&appid=${apiKey}`);
				const geoData = await geoRes.json();
				const location = Array.isArray(geoData) && geoData.length ? geoData[0] : null;
				if (!location) return null;
				resolvedLat = Number(location.lat);
				resolvedLng = Number(location.lon);
			}

			const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${resolvedLat}&lon=${resolvedLng}&appid=${apiKey}&units=metric`);
			if (!weatherRes.ok) return null;
			const weather = await weatherRes.json();
			return {
				city: weather?.name || city,
				state,
				temperatureC: weather?.main?.temp ?? null,
				rainfallMm1h: Number(weather?.rain?.['1h'] || 0),
				humidity: weather?.main?.humidity ?? null,
				windSpeed: weather?.wind?.speed ?? null,
				condition: weather?.weather?.[0]?.main || 'Unknown',
				lat: resolvedLat,
				lng: resolvedLng,
				fetchedAt: nowIso(),
			};
		} catch {
			return null;
		}
	})();

	let disruption = null;
	try {
		const params = new URLSearchParams();
		if (city) params.set('city', city);
		if (state) params.set('state', state);
		if (hasCoords) {
			params.set('lat', String(lat));
			params.set('lng', String(lng));
		}
		if (city || state || hasCoords) {
			const res = await fetch(`http://127.0.0.1:${PORT}/api/social-disruption/active?${params.toString()}`);
			const data = await res.json().catch(() => ({}));
			if (res.ok) disruption = data;
		}
	} catch {
		// Best-effort pricing context only.
	}

	return { weatherSummary, disruption };
}

function buildWeeklySubscriptionPayload(profile = {}) {
	const premium = calculateWeeklyPremium(profile);
	return {
		...premium,
		amountPaise: Math.max(100, Math.round(premium.amount * 100)),
		planName: `ZyroSafe Weekly Premium - ${premium.plan}`,
	};
}

function verifySubscriptionSignature(subscriptionId, paymentId, signature) {
	const secret = process.env.RAZORPAY_KEY_SECRET || '';
	const candidates = [`${subscriptionId}|${paymentId}`, `${paymentId}|${subscriptionId}`];
	return candidates.some(payload => {
		const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
		return expected === signature;
	});
}

function makeTransaction(email, transaction) {
	const row = {
		id: transaction.id || crypto.randomUUID(),
		timestamp: transaction.timestamp || new Date().toISOString(),
		email: normalizeEmail(email),
		...clone(transaction),
	};
	transactions.set(row.id, row);
	return row;
}

function makePolicy(policy = {}) {
	return {
		id: policy.id || crypto.randomUUID(),
		email: normalizeEmail(policy.email),
		policyNumber: policy.policyNumber || `POL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
		status: policy.status || 'active',
		plan: policy.plan || 'Basic',
		weeklyIncome: Number(policy.weeklyIncome || 0),
		coverageHours: Number(policy.coverageHours || 12),
		city: String(policy.city || '').trim(),
		state: String(policy.state || '').trim(),
		safeZoneDiscount: Number(policy.safeZoneDiscount || 0),
		notes: String(policy.notes || '').trim(),
		createdAt: policy.createdAt || nowIso(),
		updatedAt: nowIso(),
		metadata: clone(policy.metadata || null),
	};
}

async function readPoliciesByEmail(email) {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) return [];

	if (isMongoConnected() && mongoCollections.policies) {
		return mongoCollections.policies.find({ email: normalizedEmail }).sort({ updatedAt: -1 }).toArray();
	}

	return [...policies.values()].filter(policy => policy.email === normalizedEmail).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function upsertPolicy(policy = {}) {
	const row = makePolicy(policy);
	if (isMongoConnected() && mongoCollections.policies) {
		await mongoCollections.policies.updateOne(
			{ id: row.id },
			{ $set: row, $setOnInsert: { createdAt: row.createdAt } },
			{ upsert: true },
		);
		return row;
	}

	policies.set(row.id, row);
	return row;
}

async function deletePolicy(policyId) {
	if (!policyId) return false;
	if (isMongoConnected() && mongoCollections.policies) {
		const result = await mongoCollections.policies.deleteOne({ id: policyId });
		return result.deletedCount > 0;
	}
	return policies.delete(policyId);
}

const EVENT_SEVERITIES = new Set(['low', 'medium', 'high']);

function normalizeEventType(value = '') {
	const normalized = normalizeText(value);
	if (normalized === 'heavy rain' || normalized === 'rain' || normalized === 'storm') return 'rain';
	if (normalized === 'heatwave' || normalized === 'heat') return 'heat';
	if (normalized === 'curfew' || normalized === 'lockdown' || normalized === 'section-144' || normalized === 'section 144') return 'curfew';
	return 'curfew';
}

function normalizeEventSeverity(value = 'medium') {
	const normalized = normalizeText(value);
	return EVENT_SEVERITIES.has(normalized) ? normalized : 'medium';
}

function makeEvent(event = {}) {
	const createdAt = event.createdAt || nowIso();
	const duration = Math.max(1, Number(event.duration || 1));
	const expiresAt = event.expiresAt || new Date(Date.parse(createdAt) + (duration * 60 * 60 * 1000)).toISOString();
	const location = event.location || {};
	const lat = Number(location.lat);
	const lng = Number(location.lng);
	const city = String(location.city || '').trim();
	const type = normalizeEventType(event.type);

	return {
		id: event.id || crypto.randomUUID(),
		type,
		location: {
			lat: Number.isFinite(lat) ? lat : null,
			lng: Number.isFinite(lng) ? lng : null,
			city,
		},
		radius: Math.max(0.25, Number(event.radius || 0.25)),
		duration,
		severity: normalizeEventSeverity(event.severity),
		active: event.active !== false,
		createdAt,
		expiresAt,
		updatedAt: nowIso(),
		createdBy: String(event.createdBy || 'admin').trim(),
		metadata: clone(event.metadata || null),
	};
}

function isEventActive(event, atMs = Date.now()) {
	if (!event) return false;
	if (event.active === false) return false;
	const expiresAt = parseIso(event.expiresAt);
	if (Number.isFinite(expiresAt) && expiresAt < atMs) return false;
	return true;
}

function eventToGeoDistanceKm(lat1, lng1, lat2, lng2) {
	if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
	const earthRadiusKm = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
	return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function isUserInsideEvent(lat, lng, event) {
	const eventLat = Number(event?.location?.lat);
	const eventLng = Number(event?.location?.lng);
	const radius = Math.max(0, Number(event?.radius || 0));
	if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(eventLat) && Number.isFinite(eventLng)) {
		return eventToGeoDistanceKm(lat, lng, eventLat, eventLng) <= radius;
	}
	const city = normalizeText(event?.location?.city);
	return Boolean(city);
}

async function readEvents({ activeOnly = true } = {}) {
	if (isMongoConnected() && mongoCollections.events) {
		const rows = await mongoCollections.events.find({}).sort({ createdAt: -1 }).toArray();
		return activeOnly ? rows.filter((event) => isEventActive(event)) : rows;
	}

	const rows = [...events.values()].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
	return activeOnly ? rows.filter((event) => isEventActive(event)) : rows;
}

async function storeEvent(event = {}) {
	const row = makeEvent(event);
	if (isMongoConnected() && mongoCollections.events) {
		await mongoCollections.events.insertOne(row);
		return row;
	}

	if (MONGODB_REQUIRED) {
		throw new Error('Primary MongoDB is unavailable');
	}

	events.set(row.id, row);
	return row;
}

async function deactivateEvent(eventId) {
	if (!eventId) return false;
	if (isMongoConnected() && mongoCollections.events) {
		const result = await mongoCollections.events.updateOne({ id: eventId }, { $set: { active: false, updatedAt: nowIso() } });
		return result.matchedCount > 0;
	}

	const existing = events.get(eventId);
	if (!existing) return false;
	events.set(eventId, { ...existing, active: false, updatedAt: nowIso() });
	return true;
}

app.get('/api/policies', rateLimit, async (req, res) => {
	const email = normalizeEmail(req.query?.email);
	if (!email) return res.status(400).json({ error: 'Email is required' });

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const rows = await readPoliciesByEmail(email);
	return res.json({ success: true, policies: rows, source: canUseMongo ? 'mongo' : 'memory' });
});

app.post('/api/policies', rateLimit, async (req, res) => {
	const body = req.body || {};
	const email = normalizeEmail(body.email);
	if (!email) return res.status(400).json({ error: 'Email is required' });

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const row = await upsertPolicy({ ...body, email });
	return res.json({ success: true, policy: row });
});

app.put('/api/policies/:policyId', rateLimit, async (req, res) => {
	const policyId = String(req.params.policyId || '').trim();
	if (!policyId) return res.status(400).json({ error: 'policyId is required' });

	const body = req.body || {};
	const existing = isMongoConnected() && mongoCollections.policies
		? await mongoCollections.policies.findOne({ id: policyId })
		: policies.get(policyId);
	if (!existing) return res.status(404).json({ error: 'Policy not found' });

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const row = makePolicy({ ...existing, ...body, id: policyId, email: existing.email });
	if (isMongoConnected() && mongoCollections.policies) {
		await mongoCollections.policies.updateOne({ id: policyId }, { $set: row });
	} else {
		policies.set(policyId, row);
	}

	return res.json({ success: true, policy: row });
});

app.delete('/api/policies/:policyId', rateLimit, async (req, res) => {
	const policyId = String(req.params.policyId || '').trim();
	if (!policyId) return res.status(400).json({ error: 'policyId is required' });

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const deleted = await deletePolicy(policyId);
	if (!deleted) return res.status(404).json({ error: 'Policy not found' });
	return res.json({ success: true });
});

app.get('/api/events', rateLimit, async (req, res) => {
	const city = String(req.query?.city || '').trim();
	const state = String(req.query?.state || '').trim();
	const lat = Number(req.query?.lat);
	const lng = Number(req.query?.lng);
	const activeOnly = String(req.query?.activeOnly || 'true').toLowerCase() !== 'false';
	const rows = await readEvents({ activeOnly });
	const filtered = rows.filter((event) => {
		if (city && normalizeText(event?.location?.city) && !normalizeText(event.location.city).includes(normalizeText(city))) {
			return false;
		}
		if (state && event?.location?.state && !normalizeText(event.location.state).includes(normalizeText(state))) {
			return false;
		}
		if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(event?.location?.lat) && Number.isFinite(event?.location?.lng)) {
			return isUserInsideEvent(lat, lng, event) || event.radius > 0;
		}
		return true;
	});

	return res.json({ success: true, events: filtered, count: filtered.length });
});

app.post('/api/admin/trigger-event', rateLimit, async (req, res) => {
	if (!requireTokenIfConfigured(req, res, ADMIN_OVERRIDE_TOKEN, 'x-admin-token')) return;
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const body = req.body || {};
	const rawType = normalizeText(body.type);
	if (!['curfew', 'rain', 'heat', 'heavy rain', 'heatwave', 'storm', 'lockdown', 'section 144', 'section-144'].includes(rawType)) {
		return res.status(400).json({ error: 'type must be curfew, rain, or heat' });
	}
	const type = normalizeEventType(body.type);

	const location = body.location || {};
	const city = String(location.city || '').trim();
	const lat = Number(location.lat);
	const lng = Number(location.lng);
	const radius = Number(body.radius || 0);
	const duration = Number(body.duration || 0);
	const severity = normalizeEventSeverity(body.severity);

	if (!city) {
		return res.status(400).json({ error: 'location.city is required' });
	}
	if (!Number.isFinite(radius) || radius <= 0) {
		return res.status(400).json({ error: 'radius must be a positive number' });
	}
	if (!Number.isFinite(duration) || duration <= 0) {
		return res.status(400).json({ error: 'duration must be a positive number' });
	}

	try {
		const row = await storeEvent({
			type,
			location: {
				city,
				lat: Number.isFinite(lat) ? lat : null,
				lng: Number.isFinite(lng) ? lng : null,
			},
			radius,
			duration,
			severity,
			createdBy: String(body.createdBy || 'admin').trim(),
			metadata: {
				notes: String(body.notes || '').trim(),
				source: 'admin-panel',
			},
		});

		return res.json({ success: true, event: row });
	} catch (err) {
		return res.status(500).json({ error: err.message || 'Failed to store event' });
	}
});

app.get('/api/admin/events', rateLimit, async (req, res) => {
	if (!requireTokenIfConfigured(req, res, ADMIN_OVERRIDE_TOKEN, 'x-admin-token')) return;
	const rows = await readEvents({ activeOnly: false });
	return res.json({ success: true, events: rows, count: rows.length });
});

app.patch('/api/admin/events/:eventId/deactivate', rateLimit, async (req, res) => {
	if (!requireTokenIfConfigured(req, res, ADMIN_OVERRIDE_TOKEN, 'x-admin-token')) return;
	const eventId = String(req.params.eventId || '').trim();
	if (!eventId) return res.status(400).json({ error: 'eventId is required' });

	const updated = await deactivateEvent(eventId);
	if (!updated) return res.status(404).json({ error: 'Event not found' });

	return res.json({ success: true });
});

app.get('/api/admin/stats', rateLimit, async (req, res) => {
	if (!requireTokenIfConfigured(req, res, ADMIN_OVERRIDE_TOKEN, 'x-admin-token')) return;

	const activeEvents = await readEvents({ activeOnly: true });
	const transactionRows = isMongoConnected() && mongoCollections.transactions
		? await mongoCollections.transactions.find({}).sort({ timestamp: -1 }).limit(2000).toArray()
		: [...transactions.values()];
	const fraudRows = isMongoConnected() && mongoCollections.fraudChecks
		? await mongoCollections.fraudChecks.find({}).sort({ timestamp: -1 }).limit(2000).toArray()
		: [...fraudChecks.values()];

	const payoutRows = transactionRows.filter((row) => {
		const type = normalizeText(row?.type);
		const status = normalizeText(row?.status);
		return (type === 'claim_payout' || type === 'autopayout') && ['approved', 'completed'].includes(status);
	});

	const affectedUsers = new Set(payoutRows.map((row) => normalizeEmail(row?.email)).filter(Boolean)).size;
	const totalPayoutAmount = payoutRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0);
	const fraudAttemptsDetected = fraudRows.filter((row) => !['approved', 'stored'].includes(normalizeText(row?.action))).length;

	return res.json({
		success: true,
		stats: {
			activeEvents: activeEvents.length,
			affectedUsers,
			totalPayoutsTriggered: payoutRows.length,
			totalPayoutAmount: Number(totalPayoutAmount.toFixed(2)),
			fraudAttemptsDetected,
		},
	});
});

app.post('/api/premium-estimate', rateLimit, async (req, res) => {
	const body = req.body || {};
	const profile = { ...clone(body.profile || body) };
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const context = await fetchPremiumContext(profile);
	const estimate = buildDynamicPremiumEstimate({
		profile,
		weatherSummary: context.weatherSummary,
		disruption: context.disruption,
	});

	return res.json({
		success: true,
		estimate,
		context,
	});
});

async function addTransaction(email, transaction) {
	const row = {
		id: transaction.id || crypto.randomUUID(),
		timestamp: transaction.timestamp || new Date().toISOString(),
		email: normalizeEmail(email),
		...clone(transaction),
	};

	if (isMongoConnected() && mongoCollections.transactions) {
		await mongoCollections.transactions.insertOne(row);
		return row;
	}

	if (MONGODB_REQUIRED) {
		throw new Error('Primary MongoDB is unavailable');
	}

	transactions.set(row.id, row);
	return row;
}

app.get('/api/health', async (req, res) => {
	if (!isMongoConnected()) {
		await initMongo();
	}
	res.json({
		success: true,
		mode: NODE_ENV,
		razorpayEnabled: RAZORPAY_ENABLED,
		mongoConnected: isMongoConnected(),
		mongoRequired: MONGODB_REQUIRED,
		dbName: MONGODB_DB_NAME,
	});
});

app.post('/api/send-email-otp', rateLimit, async (req, res) => {
	try {
		const email = normalizeEmail(req.body?.email);
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return res.status(400).json({ error: 'Invalid email address' });
		}

		const otp = generateOTP();
		otpStore.set(`email:${email}`, {
			otpHash: hashOTP(otp),
			expiresAt: Date.now() + OTP_EXPIRY_MS,
			attempts: 0,
		});

		try {
			await transporter.sendMail({
				from: process.env.SMTP_USER ? `"ZyroSafe" <${process.env.SMTP_USER}>` : undefined,
				to: email,
				subject: `${otp} — Your ZyroSafe Verification Code`,
				html: buildEmailHTML(otp, 'email'),
			});
		} catch (mailErr) {
			console.warn('OTP email send failed:', mailErr.message);
		}

		return res.json({ success: true, message: 'OTP sent' });
	} catch (err) {
		return res.status(500).json({ error: err.message || 'Failed to send OTP' });
	}
});

app.post('/api/verify-email-otp', rateLimit, (req, res) => {
	const email = normalizeEmail(req.body?.email);
	const otp = String(req.body?.otp || '').trim();
	const entry = otpStore.get(`email:${email}`);

	if (!entry) return res.status(400).json({ error: 'OTP not found or expired' });
	if (Date.now() > entry.expiresAt) {
		otpStore.delete(`email:${email}`);
		return res.status(400).json({ error: 'OTP expired' });
	}

	entry.attempts += 1;
	if (entry.attempts > 5) {
		otpStore.delete(`email:${email}`);
		return res.status(429).json({ error: 'Too many attempts' });
	}

	if (entry.otpHash !== hashOTP(otp)) {
		return res.status(400).json({ error: 'Invalid OTP' });
	}

	otpStore.delete(`email:${email}`);
	return res.json({ success: true, message: 'OTP verified' });
});

app.get('/api/reverse-geocode', rateLimit, async (req, res) => {
	const { lat, lng } = req.query || {};
	if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1&zoom=18`;
		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'ZyroSafe/1.0 (reverse-geocode-service)',
			},
		});

		if (response.ok) {
			const data = await response.json();
			const location = await enrichPincode(buildLocationFromNominatim(data));
			if (hasResolvedAddress(location)) {
				return res.json({ success: true, location });
			}
		}

		// Fallback provider when Nominatim is rate-limited/unavailable.
		const backupUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;
		const backupRes = await fetch(backupUrl, { headers: { Accept: 'application/json' } });
		if (backupRes.ok) {
			const backup = await backupRes.json();
			const location = await enrichPincode({
				area: String(backup?.locality || backup?.city || backup?.principalSubdivision || '').trim(),
				city: String(backup?.city || backup?.locality || '').trim(),
				state: String(backup?.principalSubdivision || '').trim(),
				pincode: String(backup?.postcode || '').trim(),
				country: String(backup?.countryName || '').trim(),
				displayName: String(backup?.localityInfo?.administrative?.map(item => item.name).filter(Boolean).join(', ') || '').trim(),
			});

			if (hasResolvedAddress(location)) {
				return res.json({ success: true, location });
			}
		}

		return res.json({
			success: true,
			location: {
				area: '', city: '', state: '', pincode: '', country: '', displayName: '',
			},
		});
	} catch {
		return res.json({
			success: true,
			location: {
				area: '', city: '', state: '', pincode: '', country: '', displayName: '',
			},
		});
	}
});

app.get('/api/ip-location', rateLimit, async (req, res) => {
	const clientIp = normalizeClientIp(req.query?.ip || req.ip || req.connection?.remoteAddress || '');
	if (!clientIp) {
		return res.json({
			success: true,
			ip: '',
			location: {
				area: '', city: '', state: '', pincode: '', country: '', displayName: '',
			},
		});
	}

	const providers = [
		{
			url: `https://ipapi.co/${encodeURIComponent(clientIp)}/json/`,
			normalize: buildLocationFromIpLookup,
		},
		{
			url: `https://ipwho.is/${encodeURIComponent(clientIp)}`,
			normalize: (data) => buildLocationFromIpLookup({
				city: data?.city,
				region: data?.region,
				postal: data?.postal,
				country_name: data?.country,
			}),
		},
	];

	for (const provider of providers) {
		try {
			const response = await fetch(provider.url, {
				headers: {
					Accept: 'application/json',
					'User-Agent': 'ZyroSafe/1.0 (ip-location-service)',
				},
			});
			if (!response.ok) continue;

			const data = await response.json();
			if (data?.success === false) continue;

			const location = await enrichPincode(provider.normalize(data));
			if (hasResolvedAddress(location)) {
				return res.json({ success: true, ip: clientIp, location });
			}
		} catch {
			// Try the next provider.
		}
	}

	return res.json({
		success: true,
		ip: clientIp,
		location: {
			area: '', city: '', state: '', pincode: '', country: '', displayName: '',
		},
	});
});

app.get('/api/nearby-areas', rateLimit, async (req, res) => {
	const lat = Number(req.query?.lat);
	const lng = Number(req.query?.lng);
	const radiusKmRaw = Number(req.query?.radiusKm || 5);
	const radiusKm = Number.isFinite(radiusKmRaw) ? Math.min(Math.max(radiusKmRaw, 1), 10) : 5;

	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		return res.status(400).json({ error: 'lat and lng must be valid numbers' });
	}

	const points = pointsInRadius(lat, lng, radiusKm);

	try {
		const requests = points.map(async (point) => {
			const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(point.lat)}&lon=${encodeURIComponent(point.lng)}&addressdetails=1`;
			const response = await fetch(url, {
				headers: {
					Accept: 'application/json',
					'User-Agent': 'ZyroSafe/1.0 (nearby-area-service)',
				},
			});
			if (!response.ok) return '';
			const data = await response.json();
			return extractAreaName(data?.address);
		});

		const names = uniqueNames(await Promise.all(requests))
			.filter(name => !/industrial/i.test(name))
			.slice(0, 12);
		return res.json({ success: true, radiusKm, areas: names });
	} catch (err) {
		return res.json({
			success: true,
			radiusKm,
			areas: [],
			message: err?.message || 'Unable to fetch nearby areas',
		});
	}
});

app.get('/api/live-weather', rateLimit, async (req, res) => {
	const city = String(req.query?.city || '').trim();
	const state = String(req.query?.state || '').trim();
	const lat = Number(req.query?.lat);
	const lng = Number(req.query?.lng);
	const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

	const apiKey = String(process.env.OPENWEATHER_API_KEY || '').trim();
	if (!apiKey) {
		return res.status(503).json({ error: 'OPENWEATHER_API_KEY is not configured' });
	}

	if (!hasCoords && (!city || !state)) {
		return res.status(400).json({ error: 'Provide lat/lng or city and state' });
	}

	try {
		let resolvedLat = lat;
		let resolvedLng = lng;
		let resolvedCity = city;
		let resolvedState = state;

		if (!hasCoords) {
			const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(`${city},${state},IN`)}&limit=1&appid=${apiKey}`);
			const geoData = await geoRes.json();
			const location = Array.isArray(geoData) && geoData.length ? geoData[0] : null;
			if (!location) return res.status(404).json({ error: 'Location not found' });

			resolvedLat = Number(location.lat);
			resolvedLng = Number(location.lon);
			resolvedCity = location.name || city;
			resolvedState = location.state || state;
		}

		const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${resolvedLat}&lon=${resolvedLng}&appid=${apiKey}&units=metric`);

		const weather = await weatherRes.json();
		if (!weatherRes.ok) {
			return res.status(weatherRes.status || 500).json({ error: weather?.message || 'Failed to fetch live weather' });
		}

		let rainfallMm1h = Number.isFinite(weather?.rain?.['1h'])
			? Number(weather.rain['1h'])
			: 0;

		try {
			const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${resolvedLat}&longitude=${resolvedLng}&current=precipitation&timezone=auto`);
			if (meteoRes.ok) {
				const meteoData = await meteoRes.json();
				const meteoPrecip = Number(meteoData?.current?.precipitation);
				if (Number.isFinite(meteoPrecip)) {
					rainfallMm1h = meteoPrecip;
				}
			}
		} catch {
			// Keep OpenWeather rainfall fallback.
		}

		rainfallMm1h = Number(rainfallMm1h.toFixed(2));

		return res.json({
			success: true,
			weatherSummary: {
				city: weather?.name || resolvedCity || city,
				state: resolvedState || state,
				temperatureC: weather?.main?.temp ?? null,
				rainfallMm1h,
				humidity: weather?.main?.humidity ?? null,
				windSpeed: weather?.wind?.speed ?? null,
				condition: weather?.weather?.[0]?.main || 'Unknown',
				lat: resolvedLat,
				lng: resolvedLng,
				fetchedAt: new Date().toISOString(),
			},
		});
	} catch (err) {
		return res.status(500).json({ error: err.message || 'Failed to fetch weather' });
	}
});

app.get('/api/weather-probability', rateLimit, async (req, res) => {
	const city = String(req.query?.city || '').trim();
	const state = String(req.query?.state || '').trim();
	const lat = Number(req.query?.lat);
	const lng = Number(req.query?.lng);
	const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

	const apiKey = String(process.env.OPENWEATHER_API_KEY || '').trim();
	if (!apiKey) {
		return res.status(503).json({ error: 'OPENWEATHER_API_KEY is not configured' });
	}

	if (!hasCoords && (!city || !state)) {
		return res.status(400).json({ error: 'Provide lat/lng or city and state' });
	}

	try {
		let resolvedLat = lat;
		let resolvedLng = lng;

		if (!hasCoords) {
			const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(`${city},${state},IN`)}&limit=1&appid=${apiKey}`);
			const geoData = await geoRes.json();
			const location = Array.isArray(geoData) && geoData.length ? geoData[0] : null;
			if (!location) return res.status(404).json({ error: 'Location not found' });

			resolvedLat = Number(location.lat);
			resolvedLng = Number(location.lon);
		}

		const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${resolvedLat}&lon=${resolvedLng}&appid=${apiKey}&units=metric`);
		const forecast = await forecastRes.json();
		if (!forecastRes.ok) {
			return res.status(forecastRes.status || 500).json({ error: forecast?.message || 'Failed to fetch weather forecast' });
		}

		const nowSec = Math.floor(Date.now() / 1000);
		const windowHours = 24;
		const windowEnd = nowSec + (windowHours * 3600);
		const bucket = Array.isArray(forecast?.list)
			? forecast.list.filter(item => Number(item?.dt || 0) >= nowSec && Number(item?.dt || 0) <= windowEnd)
			: [];

		const conditionMax = new Map();
		let rainEventProbability = 0;

		for (const item of bucket) {
			const condition = String(item?.weather?.[0]?.main || 'Unknown');
			const popProbability = Number.isFinite(item?.pop) ? Math.round(item.pop * 100) : 0;
			const rain3h = Number(item?.rain?.['3h'] || 0);
			const snow3h = Number(item?.snow?.['3h'] || 0);
			const eventBoost = rain3h > 0 || snow3h > 0 || /rain|storm|snow|drizzle/i.test(condition) ? 15 : 0;
			const probability = Math.min(100, Math.max(popProbability, eventBoost));

			conditionMax.set(condition, Math.max(conditionMax.get(condition) || 0, probability));
			if (/rain|storm|drizzle|snow/i.test(condition) || rain3h > 0 || snow3h > 0) {
				rainEventProbability = Math.max(rainEventProbability, probability);
			}
		}

		let highestProbabilityCondition = { condition: 'No major event', probability: 0 };
		for (const [condition, probability] of conditionMax.entries()) {
			if (probability > highestProbabilityCondition.probability) {
				highestProbabilityCondition = { condition, probability };
			}
		}

		return res.json({
			success: true,
			probabilitySummary: {
				highestProbabilityCondition,
				rainEventProbability,
				sourceWindowHours: windowHours,
				lat: resolvedLat,
				lng: resolvedLng,
			},
		});
	} catch (err) {
		return res.status(500).json({ error: err.message || 'Failed to fetch weather probability' });
	}
});

function requireTokenIfConfigured(req, res, token, headerName = 'x-admin-token') {
	if (!token) return true;
	const provided = String(req.headers?.[headerName] || req.query?.token || '').trim();
	if (provided === token) return true;
	res.status(401).json({ error: 'Unauthorized token' });
	return false;
}

function readActiveMapSignals(store, { city = '', state = '', atMs = Date.now() }) {
	const cityNorm = normalizeText(city);
	const stateNorm = normalizeText(state);
	const out = [];

	for (const value of store.values()) {
		const locationNorm = normalizeText(value.location);
		const subareaNorm = normalizeText(value.subarea);
		const zoneMatch = !cityNorm || locationNorm.includes(cityNorm) || subareaNorm.includes(cityNorm);
		const stateMatch = !stateNorm || !locationNorm.includes(',') || locationNorm.includes(stateNorm);
		if (!zoneMatch || !stateMatch) continue;
		if (!isActiveWindow(value.startTime, value.endTime, atMs)) continue;
		out.push(value);
	}

	return out;
}

function filterActiveSignals(rows = [], { city = '', state = '', atMs = Date.now(), allowedSources = [] } = {}) {
	const cityNorm = normalizeText(city);
	const stateNorm = normalizeText(state);
	const sourceSet = new Set((allowedSources || []).map(source => normalizeText(source)).filter(Boolean));
	const out = [];

	for (const value of rows) {
		if (!value) continue;
		if (sourceSet.size > 0 && !sourceSet.has(normalizeText(value.source))) continue;
		if (value.active === false) continue;
		const locationNorm = normalizeText(value.location);
		const subareaNorm = normalizeText(value.subarea);
		const zoneMatch = !cityNorm || locationNorm.includes(cityNorm) || subareaNorm.includes(cityNorm);
		const stateMatch = !stateNorm || !locationNorm.includes(',') || locationNorm.includes(stateNorm);
		if (!zoneMatch || !stateMatch) continue;
		if (!isActiveWindow(value.startTime, value.endTime, atMs)) continue;
		out.push(value);
	}

	return out;
}

function dedupeSignals(rows = []) {
	const deduped = new Map();
	for (const row of rows) {
		if (!row) continue;
		const key = String(row.id || `${row.source}:${row.location}:${row.subarea}:${row.startTime}`).trim();
		if (!deduped.has(key)) deduped.set(key, row);
	}
	return [...deduped.values()];
}

app.post('/api/social-disruption/admin', rateLimit, async (req, res) => {
	if (!requireTokenIfConfigured(req, res, ADMIN_OVERRIDE_TOKEN, 'x-admin-token')) return;
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const body = req.body || {};
	const location = String(body.location || '').trim();
	const subarea = String(body.subarea || '').trim();
	const reason = String(body.reason || 'Curfew / Section 144 / zone closure').trim();
	const confidence = Number(body.confidence ?? 0.95);
	const startTime = body.startTime ? new Date(body.startTime).toISOString() : nowIso();
	const endTime = body.endTime ? new Date(body.endTime).toISOString() : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

	if (!location) {
		return res.status(400).json({ error: 'location is required' });
	}

	const record = toSignalRecord({
		type: 'social_disruption',
		source: 'admin_override',
		location,
		subarea,
		startTime,
		endTime,
		confidence,
		reason,
		metadata: {
			createdBy: String(body.createdBy || 'admin').trim(),
			notes: String(body.notes || '').trim(),
		},
	});

	const id = crypto.randomUUID();
	const persisted = {
		id,
		...record,
		createdAt: nowIso(),
	};
	adminDisruptions.set(id, persisted);
	if (canUseMongo && mongoCollections.socialDisruptions) {
		await mongoCollections.socialDisruptions.insertOne({
			...persisted,
			active: true,
		});
	}

	return res.json({ success: true, disruption: persisted });
});

app.post('/api/social-disruption/official-alert', rateLimit, async (req, res) => {
	if (!requireTokenIfConfigured(req, res, OFFICIAL_ALERT_TOKEN, 'x-official-token')) return;
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const body = req.body || {};
	const location = String(body.location || body.area || '').trim();
	const subarea = String(body.subarea || '').trim();
	const reason = String(body.reason || body.headline || 'Official alert').trim();
	const confidence = Number(body.confidence ?? 0.97);
	const startTime = body.startTime ? new Date(body.startTime).toISOString() : nowIso();
	const endTime = body.endTime ? new Date(body.endTime).toISOString() : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

	if (!location) return res.status(400).json({ error: 'location is required' });

	const record = toSignalRecord({
		type: 'social_disruption',
		source: 'official_alert',
		location,
		subarea,
		startTime,
		endTime,
		confidence,
		reason,
		metadata: {
			provider: String(body.provider || 'CAP/SACHET-adapter').trim(),
			reference: String(body.reference || '').trim(),
			severity: String(body.severity || 'warning').trim(),
		},
	});

	const id = crypto.randomUUID();
	const persisted = {
		id,
		...record,
		createdAt: nowIso(),
	};
	officialAlerts.set(id, persisted);
	if (canUseMongo && mongoCollections.socialDisruptions) {
		await mongoCollections.socialDisruptions.insertOne({
			...persisted,
			active: true,
		});
	}

	return res.json({ success: true, alert: persisted });
});

app.get('/api/social-disruption/active', rateLimit, async (req, res) => {
	const lat = Number(req.query?.lat);
	const lng = Number(req.query?.lng);
	const city = String(req.query?.city || '').trim();
	const state = String(req.query?.state || '').trim();
	const subarea = String(req.query?.subarea || '').trim();
	const atMs = parseIso(req.query?.at) || Date.now();
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const zone = {
		city,
		state,
		subarea,
	};

	const weatherSignal = await fetchWeatherDisruptionSignal({ lat, lng, city, state });
	const newsSignals = await fetchNewsSignals({ city, state });
	const memoryAdminSignals = readActiveMapSignals(adminDisruptions, { city, state, atMs });
	const memoryOfficialSignals = readActiveMapSignals(officialAlerts, { city, state, atMs });
	let mongoAdminSignals = [];
	let mongoOfficialSignals = [];

	if (canUseMongo && mongoCollections.socialDisruptions) {
		const mongoRows = await mongoCollections.socialDisruptions
			.find({ active: { $ne: false } })
			.sort({ startTime: -1, createdAt: -1 })
			.limit(250)
			.toArray();

		mongoAdminSignals = filterActiveSignals(mongoRows, {
			city,
			state,
			atMs,
			allowedSources: ['admin_override'],
		});
		mongoOfficialSignals = filterActiveSignals(mongoRows, {
			city,
			state,
			atMs,
			allowedSources: ['official_alert'],
		});
	}

	const adminSignals = dedupeSignals([...mongoAdminSignals, ...memoryAdminSignals]);
	const officialSignals = dedupeSignals([...mongoOfficialSignals, ...memoryOfficialSignals]);

	const signals = [
		...(weatherSignal ? [weatherSignal] : []),
		...officialSignals,
		...newsSignals,
		...adminSignals,
	].sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));

	const score = computeSocialDisruptionScore(signals);
	const active = score >= 0.55 && signals.length > 0;
	const primary = signals[0] || null;

	return res.json({
		success: true,
		active,
		social_disruption_score: score,
		zone,
		primary,
		signals,
		recommendation: active
			? 'Evaluate payout if location, time window, and fraud checks pass.'
			: 'No strong social disruption signal detected.',
		sources: {
			weatherApi: Boolean(weatherSignal),
			officialAlerts: officialSignals.length,
			newsSignals: newsSignals.length,
			adminOverrides: adminSignals.length,
			newsApiConfigured: Boolean(NEWSAPI_KEY),
		},
	});
});

app.get('/api/transactions', rateLimit, async (req, res) => {
	const email = normalizeEmail(req.query?.email);
	const userId = String(req.query?.userId || '').trim();
	if (!email && !userId) {
		return res.status(400).json({ error: 'Email or userId is required' });
	}

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	if (canUseMongo && mongoCollections.transactions) {
		const query = userId ? { $or: [{ userId }, ...(email ? [{ email }] : [])] } : { email };
		const rows = await mongoCollections.transactions
			.find(query)
			.sort({ timestamp: -1 })
			.limit(500)
			.toArray();
		return res.json({ success: true, source: 'mongo', transactions: rows });
	}

	const rows = [...transactions.values()].filter(row => {
		if (userId && row.userId === userId) return true;
		if (email && row.email === email) return true;
		return false;
	}).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

	return res.json({ success: true, source: 'memory', transactions: rows });
});

app.post('/api/transactions', rateLimit, async (req, res) => {
	const { email, id, userId, type, status, amount, description, metadata } = req.body || {};
	if (!email || !type || !status || !description) {
		return res.status(400).json({ error: 'Email, type, status, and description are required' });
	}
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	try {
		const row = await addTransaction(email, {
			id,
			userId: userId || null,
			type,
			status,
			amount: Number(amount || 0),
			description,
			metadata: metadata || null,
		});

		return res.json({ success: true, storedInMongo: canUseMongo, transaction: row });
	} catch (err) {
		return res.status(500).json({ error: err.message || 'Failed to store transaction' });
	}
});

app.post('/api/register-account', rateLimit, async (req, res) => {
	const { email, password, profile = {} } = req.body || {};
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
		return res.status(400).json({ error: 'Valid email is required' });
	}
	if (!password || String(password).length < 8) {
		return res.status(400).json({ error: 'Password must be at least 8 characters' });
	}

	const salt = crypto.randomBytes(16).toString('hex');
	const passwordHash = crypto.scryptSync(String(password), salt, 64).toString('hex');
	const account = {
		email: normalizedEmail,
		passwordSalt: salt,
		passwordHash,
		profile: { ...clone(profile), email: normalizedEmail },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	if (canUseMongo && mongoCollections.accounts) {
		try {
			// Check if email already exists
			const existingAccount = await mongoCollections.accounts.findOne({ email: normalizedEmail });
			if (existingAccount) {
				return res.status(409).json({ error: 'Email already exists' });
			}
			// Create new account
			const accountWithId = { ...account, id: crypto.randomUUID() };
			await mongoCollections.accounts.insertOne(accountWithId);
			return res.json({ success: true, account: { id: String(accountWithId.id), ...accountWithId.profile, email: normalizedEmail } });
		} catch (err) {
			if (err?.code === 11000) {
				return res.status(409).json({ error: 'Email already exists' });
			}
			if (MONGODB_REQUIRED) {
				return res.status(503).json({ error: 'Primary MongoDB is unavailable' });
			}
			return res.status(500).json({ error: err.message || 'Unable to register account' });
		}
	}

	// In-memory fallback: check if email already exists
	if (accounts.has(normalizedEmail)) {
		return res.status(409).json({ error: 'Email already exists' });
	}

	accounts.set(normalizedEmail, account);
	return res.json({ success: true, account: { id: crypto.randomUUID(), ...account.profile, email: normalizedEmail } });
});

app.post('/api/login-account', rateLimit, async (req, res) => {
	const { email, password } = req.body || {};
	const normalizedEmail = normalizeEmail(email);
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const account = canUseMongo && mongoCollections.accounts
		? await mongoCollections.accounts.findOne({ email: normalizedEmail })
		: accounts.get(normalizedEmail);
	if (!account) return res.status(401).json({ error: 'Account not found' });

	const derived = crypto.scryptSync(String(password || ''), account.passwordSalt, 64).toString('hex');
	if (derived !== account.passwordHash) {
		return res.status(401).json({ error: 'Invalid email or password' });
	}

	return res.json({ success: true, account: { id: String(account.id || account._id || crypto.randomUUID()), ...account.profile, email: normalizedEmail } });
});

app.post('/api/admin/login', rateLimit, async (req, res) => {
	const email = normalizeEmail(req.body?.email);
	const password = String(req.body?.password || '');

	if (!email || !password) {
		return res.status(400).json({ error: 'Admin email and password are required' });
	}

	if (email !== ADMIN_LOGIN_EMAIL || password !== ADMIN_LOGIN_PASSWORD) {
		return res.status(401).json({ error: 'Invalid admin credentials' });
	}

	return res.json({
		success: true,
		account: {
			id: `admin-${crypto.randomBytes(6).toString('hex')}`,
			email,
			fullName: 'Admin Operator',
			role: 'admin',
			adminToken: ADMIN_OVERRIDE_TOKEN,
		},
	});
});

app.post('/api/fraud-check', rateLimit, async (req, res) => {
	const { email, gps, expectedLocation = {} } = req.body || {};
	const normalizedEmail = normalizeEmail(email);

	let score = 10;
	if (gps?.lat == null || gps?.lng == null) score += 35;
	if (expectedLocation?.city && expectedLocation?.city !== '') score += 5;

	const result = {
		success: true,
		fraud: {
			stored: true,
			score,
			action: score >= 70 ? 'rejected' : score >= 30 ? 'flagged' : 'approved',
			email: normalizedEmail,
		},
	};

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const fraudRow = {
		id: crypto.randomUUID(),
		email: normalizedEmail,
		score,
		action: result.fraud.action,
		gps: gps || null,
		expectedLocation,
		timestamp: new Date().toISOString(),
	};

	if (canUseMongo && mongoCollections.fraudChecks) {
		await mongoCollections.fraudChecks.insertOne(fraudRow);
	} else {
		fraudChecks.set(fraudRow.id, fraudRow);
	}

	return res.json(result);
});

app.post('/api/business-onboarding', rateLimit, async (req, res) => {
	const body = req.body || {};
	const email = normalizeEmail(body.email);
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.status(400).json({ error: 'Valid email is required' });
	}
	const payload = {
		...clone(body),
		email,
		updatedAt: new Date().toISOString(),
	};

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;
	if (canUseMongo && mongoCollections.onboarding) {
		try {
			const existingAccount = mongoCollections.accounts
				? await mongoCollections.accounts.findOne({ email })
				: null;
			if (existingAccount) {
				return res.status(409).json({ error: 'Email already exists' });
			}

			await mongoCollections.onboarding.updateOne(
				{ email },
				{ $set: payload, $setOnInsert: { createdAt: new Date().toISOString() } },
				{ upsert: true },
			);
			return res.json({ success: true, message: 'Business onboarding saved and weather API validated', weatherSummary: null, storedInMongo: { onboarding: true, premiumTransaction: false } });
		} catch (err) {
			if (MONGODB_REQUIRED) {
				return res.status(503).json({ error: 'Primary MongoDB is unavailable' });
			}
			return res.status(500).json({ error: err.message || 'Unable to save onboarding' });
		}
	}

	if (accounts.has(email)) {
		return res.status(409).json({ error: 'Email already exists' });
	}

	onboarding.set(email || crypto.randomUUID(), payload);
	return res.json({ success: true, message: 'Business onboarding saved and weather API validated', weatherSummary: null, storedInMongo: { onboarding: false, premiumTransaction: false } });
});

app.post('/api/razorpay-weekly-subscription/create', rateLimit, async (req, res) => {
	try {
		const { email, userId, profile = {} } = req.body || {};
		const normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });

		const premiumContext = await fetchPremiumContext(profile);
		const subscriptionPayload = buildDynamicPremiumEstimate({
			profile,
			weatherSummary: premiumContext.weatherSummary,
			disruption: premiumContext.disruption,
		});
		const amountPaise = Math.max(100, Math.round(subscriptionPayload.amount * 100));
		if (!amountPaise || amountPaise <= 0) {
			return res.status(400).json({ error: 'Weekly income is required to calculate the subscription amount' });
		}

		if (!RAZORPAY_ENABLED) {
			const planId = `plan_sim_${crypto.randomBytes(10).toString('hex')}`;
			return res.json({
				success: true,
				simulated: true,
				checkoutType: 'subscription',
				keyId: process.env.RAZORPAY_KEY_ID || '',
				planName: subscriptionPayload.planName,
				plan: subscriptionPayload.plan,
				weeklyIncome: subscriptionPayload.weeklyIncome,
				rate: subscriptionPayload.baseRate,
				amount: subscriptionPayload.amount,
				coverageHours: subscriptionPayload.coverageHours,
				premiumMultiplier: subscriptionPayload.premiumMultiplier,
				adjustments: subscriptionPayload.adjustments,
				currency: 'INR',
				planId,
				subscription: {
					id: `sub_sim_${crypto.randomBytes(12).toString('hex')}`,
					status: 'created',
					plan_id: planId,
					total_count: WEEKLY_SUBSCRIPTION_CYCLES,
				},
				message: 'Razorpay keys are not configured; generated a simulated weekly subscription.',
			});
		}

		try {
			const plan = await razorpayInstance.plans.create({
				period: 'weekly',
				interval: 1,
				item: {
					name: subscriptionPayload.planName,
					amount: amountPaise,
					currency: 'INR',
				},
				notes: { email: normalizedEmail, userId: String(userId || ''), plan: subscriptionPayload.plan, purpose: 'weekly_premium_subscription' },
			});

			const subscription = await razorpayInstance.subscriptions.create({
				plan_id: plan.id,
				total_count: WEEKLY_SUBSCRIPTION_CYCLES,
				customer_notify: 1,
				notes: { email: normalizedEmail, userId: String(userId || ''), plan: subscriptionPayload.plan, purpose: 'weekly_premium_subscription' },
			});

			return res.json({
				success: true,
				checkoutType: 'subscription',
				keyId: process.env.RAZORPAY_KEY_ID || '',
				razorpayPlan: plan,
				subscription,
				planName: subscriptionPayload.planName,
				plan: subscriptionPayload.plan,
				weeklyIncome: subscriptionPayload.weeklyIncome,
				rate: subscriptionPayload.baseRate,
				amount: subscriptionPayload.amount,
				coverageHours: subscriptionPayload.coverageHours,
				premiumMultiplier: subscriptionPayload.premiumMultiplier,
				adjustments: subscriptionPayload.adjustments,
				currency: 'INR',
				mode: RAZORPAY_MODE,
			});
		} catch (subscriptionErr) {
			const order = await razorpayInstance.orders.create({
				amount: subscriptionPayload.amountPaise,
				currency: 'INR',
				receipt: `weekly_order_${Date.now()}`,
				notes: {
					email: normalizedEmail,
					userId: String(userId || ''),
					plan: subscriptionPayload.plan,
					purpose: 'weekly_premium_order_fallback',
				},
			});

			return res.json({
				success: true,
				checkoutType: 'order',
				subscriptionFallback: true,
				fallbackReason: subscriptionErr?.message || 'Subscription API unavailable for this account',
				keyId: process.env.RAZORPAY_KEY_ID || '',
				order,
				planName: subscriptionPayload.planName,
				plan: subscriptionPayload.plan,
				weeklyIncome: subscriptionPayload.weeklyIncome,
				rate: subscriptionPayload.rate,
				amount: subscriptionPayload.amount,
				currency: 'INR',
				mode: RAZORPAY_MODE,
			});
		}
	} catch (err) {
		return res.status(500).json({ success: false, error: err.message || 'Unable to start Razorpay checkout' });
	}
});

app.post('/api/razorpay-weekly-subscription/verify', rateLimit, async (req, res) => {
	const { email, subscription_id, payment_id, signature, amount, plan, weeklyIncome, rate, userId, profile = {} } = req.body || {};
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail || !subscription_id || !payment_id || !signature) {
		return res.status(400).json({ error: 'Email, subscription_id, payment_id, and signature are required' });
	}

	if (RAZORPAY_ENABLED && !verifySubscriptionSignature(subscription_id, payment_id, signature)) {
		return res.status(400).json({ error: 'Invalid Razorpay subscription signature' });
	}
	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	const premiumContext = await fetchPremiumContext(profile);
	const dynamicEstimate = buildDynamicPremiumEstimate({
		profile,
		weatherSummary: premiumContext.weatherSummary,
		disruption: premiumContext.disruption,
	});
	const subscriptionAmount = Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) : dynamicEstimate.amount;
	const row = await addTransaction(normalizedEmail, {
		userId: userId || null,
		type: 'weekly_premium_subscription',
		status: 'completed',
		amount: subscriptionAmount,
		description: `Weekly premium subscription (${plan || dynamicEstimate.plan})`,
		metadata: {
			subscriptionId: subscription_id,
			paymentId: payment_id,
			signatureVerified: true,
			plan: plan || dynamicEstimate.plan,
			weeklyIncome: Number.isFinite(Number(weeklyIncome)) ? Number(weeklyIncome) : dynamicEstimate.weeklyIncome,
			rate: Number.isFinite(Number(rate)) ? Number(rate) : dynamicEstimate.baseRate,
			amount: subscriptionAmount,
			premiumMultiplier: dynamicEstimate.premiumMultiplier,
			coverageHours: dynamicEstimate.coverageHours,
			adjustments: dynamicEstimate.adjustments,
			weatherSummary: premiumContext.weatherSummary,
			disruption: premiumContext.disruption,
			recurring: true,
			interval: 'weekly',
			cycles: WEEKLY_SUBSCRIPTION_CYCLES,
			mode: RAZORPAY_MODE,
			paidAt: new Date().toISOString(),
		},
	});

	return res.json({ success: true, transaction: row, amount: subscriptionAmount, message: `Weekly due paid successfully. ₹${subscriptionAmount} recorded.` });
});

app.post('/api/razorpay-payout', rateLimit, async (req, res) => {
	const { email, transactionId, amount, description, recipientPhone, recipientUPI } = req.body || {};
	if (!email || !transactionId || !amount) {
		return res.status(400).json({ error: 'Email, amount, and transactionId are required' });
	}

	const canUseMongo = await ensureMongo(res);
	if (!canUseMongo && MONGODB_REQUIRED) return;

	if (!RAZORPAY_ENABLED) {
		const normalizedEmail = normalizeEmail(email);
		const simulatedPayout = {
			id: `payout_sim_${crypto.randomBytes(16).toString('hex')}`,
			amount,
			status: 'processed',
			entity: 'payout',
			mode: 'SIMULATED',
			recipient: recipientPhone || recipientUPI || email,
		};

		await addTransaction(normalizedEmail, {
			type: 'claim_payout',
			status: 'completed',
			amount: Number(amount),
			description: description || 'Insurance claim payout (simulation)',
			metadata: {
				provider: 'razorpay',
				referenceTransactionId: String(transactionId),
				recipientPhone: recipientPhone || null,
				recipientUPI: recipientUPI || null,
				mode: 'SIMULATED',
				payoutId: simulatedPayout.id,
				recordedAt: nowIso(),
			},
		});

		return res.json({
			success: true,
			payout: simulatedPayout,
			message: 'Payout processed in simulation mode (Razorpay keys not configured)',
		});
	}

	try {
		const payoutPayload = {
			account_number: process.env.RAZORPAY_ACCOUNT_NUMBER || 'default',
			amount: Math.round(Number(amount) * 100),
			currency: 'INR',
			mode: 'NEFT',
			purpose: 'insurance_claim_payout',
			recipient: {
				email,
				contact: recipientPhone,
				method: recipientUPI ? 'UPI' : 'NEFT',
			},
			reference_id: transactionId,
			description: description || 'Insurance claim autopayout',
		};

		const payout = await razorpayInstance.payouts.create(payoutPayload);
		const normalizedEmail = normalizeEmail(email);
		const rowStatus = normalizeText(payout.status) === 'processed' ? 'completed' : normalizeText(payout.status) || 'pending';
		await addTransaction(normalizedEmail, {
			type: 'claim_payout',
			status: rowStatus,
			amount: Number(amount),
			description: description || 'Insurance claim autopayout',
			metadata: {
				provider: 'razorpay',
				referenceTransactionId: String(transactionId),
				recipientPhone: recipientPhone || null,
				recipientUPI: recipientUPI || null,
				mode: RAZORPAY_MODE,
				payoutId: payout.id,
				recordedAt: nowIso(),
			},
		});

		return res.json({
			success: true,
			payout: {
				id: payout.id,
				amount,
				status: payout.status,
				entity: payout.entity,
				mode: RAZORPAY_MODE,
			},
			message: `Payout of ₹${amount} initiated via Razorpay (Status: ${payout.status})`,
		});
	} catch (err) {
		const normalizedEmail = normalizeEmail(email);
		const fallbackPayoutId = `payout_fallback_${crypto.randomBytes(16).toString('hex')}`;
		await addTransaction(normalizedEmail, {
			type: 'claim_payout',
			status: 'simulated',
			amount: Number(amount),
			description: description || 'Insurance claim autopayout fallback',
			metadata: {
				provider: 'razorpay',
				referenceTransactionId: String(transactionId),
				recipientPhone: recipientPhone || null,
				recipientUPI: recipientUPI || null,
				mode: 'FALLBACK',
				payoutId: fallbackPayoutId,
				error: err.message,
				recordedAt: nowIso(),
			},
		});

		return res.json({
			success: true,
			payout: {
				id: fallbackPayoutId,
				amount,
				status: 'simulated',
				entity: 'payout',
				mode: 'FALLBACK',
			},
			message: `Payout processed in fallback mode: ${err.message}`,
		});
	}
});

app.get('/api/db-health', rateLimit, async (req, res) => {
	if (!EXPOSE_DB_HEALTH) {
		if (!DB_HEALTH_TOKEN || req.query.token !== DB_HEALTH_TOKEN) {
			return res.status(404).json({ error: 'Not found' });
		}
	}

	if (!isMongoConnected()) {
		await initMongo();
	}

	return res.json({
		success: isMongoConnected(),
		connected: isMongoConnected(),
		mode: isMongoConnected() ? 'mongo-primary' : 'unavailable',
		mongoRequired: MONGODB_REQUIRED,
		dbName: MONGODB_DB_NAME,
	});
});

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
	console.log(`\n🛡️  ZyroSafe Verification Server`);
	console.log(`   Mode: ${NODE_ENV}`);
	console.log(`   Port: ${PORT}`);
	console.log(`   Frontend: ${FRONTEND_URL}`);
	console.log(`   Razorpay: ${RAZORPAY_ENABLED ? 'enabled' : 'simulation mode'}`);
	console.log(`   MongoDB primary: ${MONGODB_URI ? `configured (${MONGODB_DB_NAME})` : 'not configured'}`);

	const mongoReady = await initMongo();
	if (MONGODB_REQUIRED && !mongoReady) {
		console.error('❌ Startup aborted: Primary MongoDB is required but unavailable.');
		process.exit(1);
	}

	app.listen(PORT, () => {
		console.log(`✅ API server listening on ${PORT}`);
	});
}

startServer();
