'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface Props {
  onOpen: () => void;
  /** Первые буквы имён — рисуются монограммой на сургучной печати */
  brideInitial?: string;
  groomInitial?: string;
}

export default function WeddingEnvelope({ onOpen, brideInitial = 'О', groomInitial = 'С' }: Props) {
  const [open, setOpen] = useState(false);
  const FLAP_DURATION = 2.8;


  // Light-brown palette matching floral site theme
  const RED_HI   = 'oklch(0.78 0.07 57)';   // light warm beige-brown
  const RED_MID  = 'oklch(0.68 0.08 53)';   // medium brown
  const RED_LO   = 'oklch(0.58 0.08 50)';   // deeper brown
  const RED_DEEP = 'oklch(0.42 0.07 48)';   // dark brown background
  const SEAM     = 'oklch(0.34 0.06 46)';   // fold line
  const INNER    = 'oklch(0.28 0.05 44)';

  const paper = '/envelope/paper-texture.jpg';
  const seal  = '/envelope/wax-seal.png';

  function handleClick() {
    if (open) return;
    setOpen(true);
    // Reveal the template after flap animation completes
    setTimeout(() => onOpen(), (FLAP_DURATION + 0.4) * 1000);
  }

  return (
    <div
      className="relative h-screen w-full overflow-hidden select-none cursor-pointer"
      style={{
        background: RED_DEEP,
        boxShadow: [
          '0 6px 0 0 oklch(0.36 0.06 46)',
          '0 10px 0 0 oklch(0.30 0.05 44)',
          '0 13px 0 0 oklch(0.24 0.04 42)',
          '0 18px 40px 0 rgba(0,0,0,0.55)',
          '0 40px 80px 0 rgba(0,0,0,0.3)',
        ].join(', '),
      }}
      onClick={handleClick}
    >
      {/* Film grain */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 30, opacity: 0.13, mixBlendMode: 'overlay',
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 25,
        background: 'radial-gradient(ellipse 85% 75% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />

      {/* ── ENVELOPE BASE ── */}
      <div className="absolute inset-0" style={{ zIndex: 5 }}>
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse 90% 80% at 50% 50%, ${RED_MID} 0%, ${RED_LO} 60%, ${RED_DEEP} 100%)`,
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${paper})`, backgroundSize: 'cover',
          mixBlendMode: 'multiply', opacity: 0.45,
        }} />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="ev-shadeTL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="20%" stopColor={RED_DEEP} stopOpacity="0" />
              <stop offset="100%" stopColor={RED_DEEP} stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="ev-shadeTR" x1="1" y1="0" x2="0" y2="1">
              <stop offset="20%" stopColor={RED_DEEP} stopOpacity="0" />
              <stop offset="100%" stopColor={RED_DEEP} stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <polygon points="0,0 50,50 0,100"  fill="url(#ev-shadeTL)" />
          <polygon points="100,0 50,50 100,100" fill="url(#ev-shadeTR)" />
          <line x1="0" y1="0" x2="50" y2="50" stroke={SEAM} strokeWidth="0.12" strokeOpacity="0.35" />
          <line x1="100" y1="0" x2="50" y2="50" stroke={SEAM} strokeWidth="0.12" strokeOpacity="0.35" />
          <line x1="0" y1="100" x2="50" y2="50" stroke={SEAM} strokeWidth="0.12" strokeOpacity="0.35" />
          <line x1="100" y1="100" x2="50" y2="50" stroke={SEAM} strokeWidth="0.12" strokeOpacity="0.35" />
        </svg>

        <motion.div
          className="absolute inset-x-0 top-0 h-1/2"
          style={{ zIndex: 4,
            background: `linear-gradient(180deg, ${INNER} 0%, ${RED_DEEP} 80%)`,
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ delay: 0.8, duration: 1.2 }}
        />
      </div>

      {/* ── ANIMATED FLAP ── */}
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2"
        initial={{ rotateX: 0 }}
        animate={{ rotateX: open ? -90 : 0 }}
        transition={{ duration: FLAP_DURATION, ease: [0.45, 0.05, 0.2, 1] }}
        style={{
          zIndex: 10,
          transformOrigin: '50% 0%',
          transformStyle: 'preserve-3d',
          filter: open
            ? 'drop-shadow(0 30px 40px rgba(0,0,0,0.65))'
            : 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))',
          transition: 'filter 0.8s',
        }}
      >
        {/* Front face */}
        <svg viewBox="0 0 100 50" preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          style={{ backfaceVisibility: 'hidden', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}>
          <defs>
            <pattern id="ev-fp" patternUnits="userSpaceOnUse" width="100" height="50">
              <image href={paper} x="0" y="0" width="100" height="50" preserveAspectRatio="xMidYMid slice" />
            </pattern>
            <linearGradient id="ev-fg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RED_HI} />
              <stop offset="55%" stopColor={RED_MID} />
              <stop offset="100%" stopColor={RED_LO} />
            </linearGradient>
            <radialGradient id="ev-fs" cx="35%" cy="18%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="0.20" />
              <stop offset="70%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ev-fl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="30%" stopColor={RED_DEEP} stopOpacity="0" />
              <stop offset="100%" stopColor={RED_DEEP} stopOpacity="0.18" />
            </linearGradient>
            <linearGradient id="ev-fr" x1="1" y1="0" x2="0" y2="1">
              <stop offset="30%" stopColor={RED_DEEP} stopOpacity="0" />
              <stop offset="100%" stopColor={RED_DEEP} stopOpacity="0.18" />
            </linearGradient>
            <linearGradient id="ev-ft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="60%" stopColor={RED_DEEP} stopOpacity="0" />
              <stop offset="100%" stopColor={RED_DEEP} stopOpacity="0.38" />
            </linearGradient>
          </defs>
          <rect width="100" height="50" fill="url(#ev-fg)" />
          <rect width="100" height="50" fill="url(#ev-fp)" opacity="0.45" style={{ mixBlendMode: 'multiply' as const }} />
          <polygon points="0,0 50,50 50,0" fill="url(#ev-fl)" />
          <polygon points="100,0 50,50 50,0" fill="url(#ev-fr)" />
          <rect width="100" height="50" fill="url(#ev-ft)" />
          <rect width="100" height="50" fill="url(#ev-fs)" />
          <line x1="0" y1="0" x2="50" y2="50" stroke={SEAM} strokeWidth="0.14" strokeOpacity="0.3" />
          <line x1="100" y1="0" x2="50" y2="50" stroke={SEAM} strokeWidth="0.14" strokeOpacity="0.3" />
        </svg>

        {/* Back face */}
        <svg viewBox="0 0 100 50" preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}>
          <defs>
            <pattern id="ev-fbp" patternUnits="userSpaceOnUse" width="100" height="50">
              <image href={paper} x="0" y="0" width="100" height="50" preserveAspectRatio="xMidYMid slice" />
            </pattern>
            <linearGradient id="ev-fbi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RED_LO} />
              <stop offset="100%" stopColor={RED_MID} />
            </linearGradient>
          </defs>
          <rect width="100" height="50" fill="url(#ev-fbi)" />
          <rect width="100" height="50" fill="url(#ev-fbp)" opacity="0.5" style={{ mixBlendMode: 'multiply' as const }} />
        </svg>

        {/* ── WAX SEAL — child of flap, moves with it ── */}
        <motion.div
          className="pointer-events-none absolute left-1/2"
          style={{
            top: '100%',
            translateX: '-50%',
            translateY: '-50%',
            translateZ: 2,
            rotate: -4,
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
          }}
          animate={
            open
              ? { rotateX: -28, rotateY: 6, scale: 1.08, y: -18 }
              : { rotateX: 0,   rotateY: 0, scale: 1,    y: 0   }
          }
          transition={{ duration: FLAP_DURATION, ease: [0.45, 0.05, 0.2, 1] }}
        >
          <img
            src={seal}
            alt=""
            style={{
              width: 'min(44vh, 520px)',
              display: 'block',
              // tint seal to #7a3a2e (warm dark brownish-red)
              filter: [
                'sepia(1)',
                'hue-rotate(-20deg)',
                'saturate(1.2)',
                'brightness(0.9)',
                'drop-shadow(0 2px 3px rgba(255,200,160,0.15))',
                'drop-shadow(0 6px 12px rgba(0,0,0,0.45))',
                'drop-shadow(0 20px 28px rgba(0,0,0,0.28))',
              ].join(' '),
            }}
          />

          {/* ── МОНОГРАММА: SVG с emboss-фильтром, цвет = воск печати ── */}
          <svg
            aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
            viewBox="0 0 100 100"
          >
            <defs>
              {/* emboss: bump-map по альфе букв → направленный свет сверху-слева */}
              <filter id="wax-emboss" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="blur" />
                {/* диффузный свет — даёт объём, тёплый */}
                <feDiffuseLighting in="blur" surfaceScale="5" diffuseConstant="0.7" lightingColor="rgb(110,82,60)" result="diffuse">
                  <fePointLight x="25" y="18" z="55" />
                </feDiffuseLighting>
                <feComposite in="diffuse" in2="SourceAlpha" operator="in" result="diffClip" />
                {/* слабый блик — только намёк */}
                <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.35" specularExponent="22" lightingColor="rgb(140,108,80)" result="specular">
                  <fePointLight x="25" y="18" z="55" />
                </feSpecularLighting>
                <feComposite in="specular" in2="SourceAlpha" operator="in" result="specClip" />
                {/* базовый цвет = тот же тёмный воск */}
                <feFlood floodColor="rgb(40,31,24)" result="waxColor" />
                <feComposite in="waxColor" in2="SourceAlpha" operator="in" result="waxBase" />
                {/* смешиваем: база + диффуз (объём) + чуть блика */}
                <feBlend in="waxBase" in2="diffClip" mode="screen" result="withDiff" />
                <feBlend in="withDiff" in2="specClip" mode="screen" result="lit" />
                {/* тень */}
                <feDropShadow dx="0.3" dy="0.5" stdDeviation="0.4" floodColor="rgba(0,0,0,0.75)" />
              </filter>
            </defs>
            <text
              x="50" y="55"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="'Marck Script', cursive"
              fontSize="26"
              filter="url(#wax-emboss)"
              fill="rgb(40,31,24)"
              letterSpacing="1"
            >
              {brideInitial}{groomInitial}
            </text>
          </svg>
        </motion.div>
      </motion.div>

      {/* Hint */}
      <AnimatePresence>
        {!open && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} exit={{ opacity: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="absolute bottom-10 left-0 right-0 text-center text-[10px] uppercase tracking-[0.5em]"
            style={{ zIndex: 22, color: 'oklch(0.88 0.04 60)', fontFamily: "'Cormorant Garamond', serif" }}>
            Tap to open
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
