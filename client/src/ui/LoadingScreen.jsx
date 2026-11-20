import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import StrokeText from './StrokeText'

const TIPS = [
  'Sit on a training bench and lift - you gain Strength even while AFK!',
  'More Strength = you fly further, and every metre pays Cash!',
  'Press LAUNCH when the marker is at the very top for a PERFECT launch: x1.5 distance, x1.6 Cash!',
  'Some throws are LUCKY (x2), SECRET (x3) or even MYTHIC (x5)! PERFECT timing doubles your odds.',
  'Rebirth at max level for x2, x3, x4... Strength and a higher level cap.',
  'The further you fly, the more each metre pays.',
  'Spend Cash on stronger arms, pets and better training benches.',
  'Pets multiply all the Strength you gain.',
  'Play with friends: every player in your server adds +10% Cash, up to +30%!',
  'Got a code? Redeem it in Settings for free rewards!',
  'Every pair of arms looks different - collect all 24!',
]

/**
 * The loading screen's backdrop in plain CSS (no image to download): a bright blue sky
 * with the sun's glow, rolling green hills, and the rainbow runway running off towards
 * them in perspective (its stripes narrowing to the horizon). Layers, top first. The
 * clouds drifting over it are their own elements (index.css .pp-load-cloud).
 */
const SKY_BACKDROP = [
  'radial-gradient(circle at 78% 18%, rgba(255,255,240,0.95) 0 3%, rgba(255,246,200,0.45) 7%, transparent 18%)',
  'radial-gradient(ellipse 60% 22% at 18% 74%, #3fb84a 0 60%, transparent 61%)',
  'radial-gradient(ellipse 70% 26% at 84% 76%, #36ad43 0 60%, transparent 61%)',
  'linear-gradient(180deg, #2f8bff 0%, #6fc0ff 38%, #c8ecff 64%, #8fe08a 64.2%, #45c43c 72%, #2f9f36 100%)',
].join(', ')

/** The runway, a trapezoid of rainbow bands narrowing towards the hills. */
const RUNWAY_STYLE = {
  clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
  background:
    'repeating-linear-gradient(180deg, #ff5a5a 0 9%, #ff9a2e 9% 18%, #ffd93a 18% 27%, #5fdc4a 27% 36%, #3fd6e8 36% 45%, #4f86ff 45% 54%, #a465ff 54% 63%, #ff6bd0 63% 72%)',
}

/**
 * The game's mark, animated: two posts and a steel bar, a little blocky player whirling
 * round it (index.css .pp-load-spinner), sparkles flying off.
 */
function SpinLogo() {
  return (
    <svg viewBox="0 0 200 170" width="200" height="170" aria-hidden="true" className="pp-load-logo">
      <rect x="18" y="60" width="16" height="104" rx="3" fill="#23262f" stroke="#111" strokeWidth="4" />
      <rect x="166" y="60" width="16" height="104" rx="3" fill="#23262f" stroke="#111" strokeWidth="4" />
      <rect x="16" y="140" width="20" height="8" fill="#ffd21f" />
      <rect x="164" y="140" width="20" height="8" fill="#ffd21f" />
      <rect x="20" y="64" width="160" height="10" rx="5" fill="#e8eef6" stroke="#111" strokeWidth="4" />
      <g className="pp-load-spinner">
        {/* Hands on the bar, body hanging below it: turned round the bar's middle. */}
        <rect x="92" y="70" width="6" height="22" rx="2" fill="#ffcf9e" stroke="#111" strokeWidth="2.5" />
        <rect x="102" y="70" width="6" height="22" rx="2" fill="#ffcf9e" stroke="#111" strokeWidth="2.5" />
        <rect x="88" y="90" width="24" height="18" rx="3" fill="#ffcf9e" stroke="#111" strokeWidth="3" />
        <rect x="86" y="106" width="28" height="28" rx="3" fill="#ff4a4a" stroke="#111" strokeWidth="3" />
        <rect x="88" y="132" width="11" height="24" rx="2" fill="#3a6bff" stroke="#111" strokeWidth="3" />
        <rect x="101" y="132" width="11" height="24" rx="2" fill="#3a6bff" stroke="#111" strokeWidth="3" />
      </g>
      <g className="pp-load-sparkles" fill="#fff6a0" stroke="#111" strokeWidth="2">
        <path d="M150 28l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" />
        <path d="M44 20l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" />
      </g>
    </svg>
  )
}

/**
 * Full-screen loading overlay. Progress is drei's asset loader progress, blended with a
 * time-based creep so a single large download never looks frozen, and it only reaches
 * 100% when the game reports ready (avatar in place, first frame drawn).
 *
 * @param {{ done: boolean }} props
 */
export function LoadingScreen({ done }) {
  const { progress } = useProgress()
  const [creep, setCreep] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])

  useEffect(() => {
    if (done) return undefined
    const id = setInterval(() => setCreep((c) => Math.min(90, c + (90 - c) * 0.06)), 120)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    if (!done) return undefined
    const id = setTimeout(() => setHidden(true), 450)
    return () => clearTimeout(id)
  }, [done])

  if (hidden) return null
  const shown = done ? 100 : Math.max(creep, Math.min(95, progress * 0.95))

  return (
    <div
      className="pp-font absolute inset-0 z-[100] flex flex-col items-center justify-center gap-6 overflow-hidden transition-opacity duration-500"
      style={{ opacity: done ? 0 : 1, background: SKY_BACKDROP }}
    >
      {/* Drifting clouds, and the runway running off to the horizon. */}
      <div className="pp-load-cloud" style={{ top: '10%', animationDuration: '38s' }} />
      <div className="pp-load-cloud" style={{ top: '22%', animationDuration: '52s', animationDelay: '-20s', transform: 'scale(0.7)' }} />
      <div className="pp-load-cloud" style={{ top: '6%', animationDuration: '60s', animationDelay: '-41s', transform: 'scale(1.2)' }} />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0" style={{ height: '36%', ...RUNWAY_STYLE }} />

      <div className="relative flex flex-col items-center gap-6">
        <SpinLogo />

        {/* The game's name: 1 SPIN over a big rainbow TO FLY!, tilted like a sticker. */}
        <h1 className="m-0 flex flex-col items-center text-center leading-none" style={{ transform: 'rotate(-3deg)' }}>
          <span style={{ fontSize: 'clamp(40px, 9vw, 96px)' }}>
            <StrokeText stroke="0.16em" gradient="linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #ffe36b 56%, #ffb21e 100%)">
              1 SPIN
            </StrokeText>
          </span>
          <span style={{ fontSize: 'clamp(46px, 11vw, 124px)', marginTop: '-0.1em' }}>
            <StrokeText
              stroke="0.15em"
              gradient="linear-gradient(90deg, #ff4a4a 0%, #ff9a1e 18%, #ffe23a 36%, #4be05a 54%, #2fd0ff 72%, #b05cff 90%, #ff5fd2 100%)"
            >
              TO FLY!
            </StrokeText>
          </span>
          <span className="text-base md:text-xl" style={{ marginTop: '0.45em' }}>
            <StrokeText stroke={5}>SPIN • LAUNCH • FLY • REBIRTH</StrokeText>
          </span>
        </h1>

        <div className="w-[min(560px,84vw)]">
          <div className="relative h-10 overflow-hidden rounded-2xl border-4 border-black bg-black/45 shadow-[0_6px_0_rgba(0,0,0,0.3)]">
            <div
              // Scaled, not resized: it moves while the game is starting up, and a transform
              // never needs a layout.
              className="pp-load-fill h-full origin-left rounded-xl transition-transform duration-200"
              style={{ transform: `scaleX(${shown / 100})` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-lg md:text-xl">
              <StrokeText stroke={5}>{done ? 'READY!' : `LOADING ${Math.round(shown)}%`}</StrokeText>
            </div>
          </div>
          <p className="mt-4 text-center text-base md:text-lg">
            <StrokeText stroke={4} gradient="linear-gradient(180deg, #fff6a0 0%, #ffc21f 100%)">
              TIP:
            </StrokeText>{' '}
            <StrokeText stroke={4}>{tip}</StrokeText>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen
