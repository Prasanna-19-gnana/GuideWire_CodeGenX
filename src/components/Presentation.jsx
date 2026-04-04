import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, ChevronRight, CloudRain, ThermometerSun,
  ShieldAlert, Activity, CheckCircle, Zap, Landmark,
  Ban, Shield
} from 'lucide-react';

const SLIDE_COUNT = 5;

/* ──────────────────────────────── RAIN BACKGROUND ──────────────────────────────── */
function RainBackground() {
  const drops = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 1.5 + Math.random() * 2,
      opacity: 0.15 + Math.random() * 0.25,
      width: 1 + Math.random() * 1.5,
      height: 20 + Math.random() * 40,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {drops.map(d => (
        <div
          key={d.id}
          className="absolute rounded-full bg-blue-400/40"
          style={{
            left: `${d.left}%`,
            width: `${d.width}px`,
            height: `${d.height}px`,
            opacity: d.opacity,
            animation: `rain-fall ${d.duration}s ${d.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────── FLOATING PARTICLES ──────────────────────────────── */
function FloatingParticles({ color = 'blue' }) {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 8,
    })), []);

  const colorMap = {
    blue: 'bg-blue-400/20',
    teal: 'bg-teal-400/20',
    red: 'bg-red-400/20',
    emerald: 'bg-emerald-400/20',
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className={`absolute rounded-full ${colorMap[color] || colorMap.blue}`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animation: `float ${p.duration}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────── PRESENTATION ROOT ──────────────────────────────── */
export default function Presentation({ onComplete }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
        if (active < SLIDE_COUNT - 1) setActive(p => p + 1);
        else onComplete();
      } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        if (active > 0) setActive(p => p - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onComplete]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050810]">
      {/* Ambient gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/[0.04] rounded-full blur-[100px]" />
      </div>

      {/* ─── SLIDE 1: INTRO ─── */}
      <Slide isActive={active === 0}>
        <RainBackground />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={active === 0 ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
          >
            <div className="w-28 h-28 mx-auto rounded-full glass-strong flex items-center justify-center glow-blue">
              <Shield className="w-14 h-14 text-blue-400" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ y: 40, opacity: 0 }}
            animate={active === 0 ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-7xl md:text-[6.5rem] font-heading font-extrabold tracking-tight leading-none"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400">
              ZyroSafe
            </span>
          </motion.h1>
          <motion.p
            initial={{ y: 30, opacity: 0 }}
            animate={active === 0 ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl md:text-2xl text-gray-400 mt-6 font-light max-w-xl"
          >
            Income protection for every delivery partner.
          </motion.p>
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={active === 0 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActive(1)}
            className="mt-12 px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full font-semibold text-lg flex items-center gap-3 border border-blue-400/20 shadow-lg shadow-blue-500/20"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </motion.button>
        </div>
      </Slide>

      {/* ─── SLIDE 2: PROBLEM ─── */}
      <Slide isActive={active === 1}>
        <FloatingParticles color="red" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full max-w-6xl mx-auto px-6">
          <motion.h2
            initial={{ y: 30, opacity: 0 }}
            animate={active === 1 ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-heading font-bold mb-16 text-center"
          >
            The <span className="text-red-400">Invisible</span> Tax
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-16">
            <ProblemCard
              icon={<CloudRain className="w-9 h-9" />}
              title="Rain & Floods"
              desc="Deliveries slow to a halt"
              color="cyan"
              delay={0.1}
              isActive={active === 1}
            />
            <ProblemCard
              icon={<ThermometerSun className="w-9 h-9" />}
              title="Extreme Heat"
              desc="Unsafe outdoor conditions"
              color="orange"
              delay={0.25}
              isActive={active === 1}
            />
            <ProblemCard
              icon={<Ban className="w-9 h-9" />}
              title="Curfews & Strikes"
              desc="Movement blocked entirely"
              color="red"
              delay={0.4}
              isActive={active === 1}
            />
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={active === 1 ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="glass rounded-3xl px-12 py-8 text-center border-red-500/15 glow-red"
          >
            <p className="text-lg text-gray-400 mb-3">Delivery partners lose up to</p>
            <div className="flex items-baseline justify-center gap-2">
              <AnimatedCounter target={20} isActive={active === 1} className="text-6xl md:text-7xl font-extrabold text-red-400 font-heading" />
              <span className="text-4xl text-red-400/70 font-heading font-bold">–</span>
              <AnimatedCounter target={30} isActive={active === 1} className="text-6xl md:text-7xl font-extrabold text-red-400 font-heading" />
              <span className="text-5xl text-red-400 font-heading font-bold">%</span>
            </div>
            <p className="text-lg text-red-300/70 mt-3">of weekly income due to disruptions</p>
          </motion.div>
        </div>
      </Slide>

      {/* ─── SLIDE 3: SOLUTION ─── */}
      <Slide isActive={active === 2}>
        <FloatingParticles color="teal" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full max-w-5xl mx-auto px-6 text-center">
          <motion.h2
            initial={{ y: 30, opacity: 0 }}
            animate={active === 2 ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-heading font-bold mb-6"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-400 text-glow">
              Parametric Insurance
            </span>
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={active === 2 ? { y: 0, opacity: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl md:text-4xl text-gray-300 font-light mb-20 leading-relaxed"
          >
            No claims. No paperwork.<br />
            <span className="text-white font-medium">Instant payout.</span>
          </motion.p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 w-full">
            <SolutionStep n="1" title="Signal Detected" sub="API Trigger (e.g. >45mm)" delay={0.3} isActive={active === 2} />
            <motion.div
              initial={{ opacity: 0 }} animate={active === 2 ? { opacity: 1 } : {}}
              transition={{ delay: 0.45 }}
              className="hidden md:block"
            >
              <ChevronRight className="w-8 h-8 text-teal-600" />
            </motion.div>
            <SolutionStep n="2" title="Auto-Validation" sub="Zero-Trust Fraud Check" delay={0.5} isActive={active === 2} />
            <motion.div
              initial={{ opacity: 0 }} animate={active === 2 ? { opacity: 1 } : {}}
              transition={{ delay: 0.65 }}
              className="hidden md:block"
            >
              <ChevronRight className="w-8 h-8 text-teal-600" />
            </motion.div>
            <SolutionStep n="3" title="Instant Deposit" sub="Calculated on Lost Wages" delay={0.7} isActive={active === 2} />
          </div>
        </div>
      </Slide>

      {/* ─── SLIDE 4: SYSTEM FLOW ─── */}
      <Slide isActive={active === 3}>
        <FloatingParticles color="blue" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full max-w-6xl mx-auto px-6">
          <motion.h2
            initial={{ y: 30, opacity: 0 }}
            animate={active === 3 ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-heading font-bold mb-20 text-center"
          >
            Intelligent <span className="text-blue-400">Pipeline</span>
          </motion.h2>

          <div className="relative w-full flex items-center justify-between max-w-5xl">
            {/* Animated connection line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={active === 3 ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ delay: 0.3, duration: 1.2, ease: 'easeInOut' }}
              className="absolute top-1/2 left-[8%] right-[8%] h-[2px] -translate-y-1/2 origin-left z-0"
              style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6, #14b8a6, #10b981)' }}
            />

            <PipelineNode icon={<CloudRain size={22} />} label="Detection" delay={0.4} isActive={active === 3} />
            <PipelineArrow delay={0.55} isActive={active === 3} />
            <PipelineNode icon={<ShieldAlert size={22} />} label="Validation" delay={0.6} isActive={active === 3} />
            <PipelineArrow delay={0.75} isActive={active === 3} />
            <PipelineNode icon={<Activity size={22} />} label="Fraud Check" delay={0.8} isActive={active === 3} />
            <PipelineArrow delay={0.95} isActive={active === 3} />
            <PipelineNode icon={<CheckCircle size={22} />} label="Decision" delay={1.0} isActive={active === 3} />
            <PipelineArrow delay={1.15} isActive={active === 3} />
            <PipelineNode icon={<Landmark size={22} />} label="Payout" delay={1.2} isActive={active === 3} highlight />
          </div>
        </div>
      </Slide>

      {/* ─── SLIDE 5: DASHBOARD PREVIEW ─── */}
      <Slide isActive={active === 4}>
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
          <motion.h2
            initial={{ y: 30, opacity: 0 }}
            animate={active === 4 ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="text-5xl md:text-6xl font-heading font-bold mb-4 text-center"
          >
            Ready to see it <span className="text-blue-400">live</span>?
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={active === 4 ? { y: 0, opacity: 1 } : {}}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-lg text-gray-500 max-w-lg text-center mb-14"
          >
            Interactive simulations, real-time risk scoring, and instant payouts — all in one platform.
          </motion.p>

          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={active === 4 ? { y: 0, opacity: 1 } : {}}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-5 items-end"
          >
            {/* Left card — disruption alert preview */}
            <div className="glass rounded-2xl p-5 w-56 transform -rotate-6 translate-y-6 opacity-40 scale-90">
              <div className="h-3 w-16 bg-gray-600/30 rounded mb-4" />
              <div className="h-12 w-full bg-red-500/15 border border-red-500/20 rounded-xl flex items-center gap-2 px-3">
                <Zap size={14} className="text-red-400" />
                <div className="h-2 w-16 bg-red-400/20 rounded" />
              </div>
              <div className="h-2 w-24 bg-gray-600/20 rounded mt-3" />
            </div>

            {/* Center card — payout highlight */}
            <div className="glass-strong rounded-3xl p-8 w-80 shadow-[0_30px_60px_rgba(0,0,0,0.5)] z-10 border-white/10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
                  <span className="text-emerald-400 font-bold text-2xl font-heading">₹</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Payout Ready</p>
                  <p className="text-3xl font-bold font-heading">₹ 360.00</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onComplete}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all"
              >
                Launch Platform
              </motion.button>
            </div>

            {/* Right card — risk score preview */}
            <div className="glass rounded-2xl p-5 w-56 transform rotate-6 translate-y-6 opacity-40 scale-90">
              <div className="h-3 w-16 bg-gray-600/30 rounded mb-4" />
              <div className="mx-auto w-20 h-20 rounded-full border-[3px] border-emerald-500/40 flex items-center justify-center">
                <span className="text-emerald-400 font-bold text-lg font-heading">15</span>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ─── NAV DOTS ─── */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-2.5 z-50">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`rounded-full transition-all duration-300 ease-out ${
              active === i
                ? 'w-7 h-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                : 'w-2 h-2 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────── HELPER COMPONENTS ──────────────────────────────── */

function Slide({ children, isActive }) {
  return (
    <motion.div
      animate={{ opacity: isActive ? 1 : 0 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: isActive ? 10 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      {children}
    </motion.div>
  );
}

function ProblemCard({ icon, title, desc, color, delay, isActive }) {
  const colors = {
    cyan: 'text-cyan-400 border-cyan-500/10 group-hover:border-cyan-500/30',
    orange: 'text-orange-400 border-orange-500/10 group-hover:border-orange-500/30',
    red: 'text-red-400 border-red-500/10 group-hover:border-red-500/30',
  };
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={isActive ? { y: 0, opacity: 1 } : {}}
      transition={{ delay, duration: 0.5 }}
      className={`group glass rounded-3xl p-7 flex flex-col items-center text-center cursor-default border ${colors[color]} transition-all duration-300 hover:bg-white/[0.03]`}
    >
      <div className={`mb-5 p-4 rounded-2xl bg-white/[0.03] ${colors[color]}`}>{icon}</div>
      <h3 className="text-xl font-bold mb-2 font-heading">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </motion.div>
  );
}

function AnimatedCounter({ target, isActive, className }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!isActive) { setVal(0); return; }
    let raf;
    const dur = 1200;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, isActive]);
  return <span className={className}>{val}</span>;
}

function SolutionStep({ n, title, sub, delay, isActive }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={isActive ? { y: 0, opacity: 1 } : {}}
      transition={{ delay, duration: 0.5 }}
      className="flex flex-col items-center group"
    >
      <div className="w-16 h-16 rounded-2xl glass-strong flex items-center justify-center text-2xl font-bold font-heading mb-4 group-hover:scale-110 transition-transform glow-teal border-teal-500/10">
        {n}
      </div>
      <h4 className="text-lg font-semibold mb-1">{title}</h4>
      <p className="text-xs text-gray-500 max-w-[140px]">{sub}</p>
    </motion.div>
  );
}

function PipelineNode({ icon, label, delay, isActive, highlight }) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={isActive ? { scale: 1, opacity: 1 } : {}}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`relative z-10 flex flex-col items-center justify-center p-5 rounded-2xl w-28 h-28 transition-all ${
        highlight
          ? 'bg-emerald-500/15 border border-emerald-500/30 glow-teal'
          : 'glass border-white/5'
      }`}
    >
      <div className={`mb-2 ${highlight ? 'text-emerald-400' : 'text-blue-400'}`}>{icon}</div>
      <span className="text-xs font-semibold tracking-wide">{label}</span>
    </motion.div>
  );
}

function PipelineArrow({ delay, isActive }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={isActive ? { opacity: 0.4, scale: 1 } : {}}
      transition={{ delay, duration: 0.3 }}
      className="z-10"
    >
      <ArrowRight className="w-6 h-6 text-indigo-400" />
    </motion.div>
  );
}
