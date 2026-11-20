import { Euler, Quaternion, Vector3 } from 'three'

import { ROLL_LAUNCH, spinRate } from '@shared/balance'
import { LAUNCH_POSTS, SLOPE_ANGLE, SPIN_BAR, TRACK_START_Z } from '@shared/world'

import { BODY } from '../playerPose'

/**
 * Geometry of a launch: one long, straight runway running north from the plaza's edge,
 * dead level (SLOPE_ANGLE is 0; the maths still allows a slope).
 *
 * Track metre `m` is measured along the runway from the start line (the plaza's north
 * edge). Before the start (m < 0) the ground is the plaza. Everything here is pure maths
 * and allocation-free, so the frame loop can call it freely.
 */

export const SIN = Math.sin(SLOPE_ANGLE)
export const COS = Math.cos(SLOPE_ANGLE)
export const TAN = Math.tan(SLOPE_ANGLE)

/** World z of track metre m. */
export const zAt = (m) => TRACK_START_Z - (m > 0 ? m * COS : m)
/** Height of the floor at track metre m. */
export const floorY = (m) => (m > 0 ? -m * SIN : 0)
/** Height of the track's floor plane under world z. */
export const slopeY = (z) => (z < TRACK_START_Z ? -(TRACK_START_Z - z) * TAN : 0)
/** Height of a surface parallel to the floor, `h` metres off it, under world z. */
export const surfaceY = (z, h) => slopeY(z) + h / COS

/** How a box lies on the track: tipped back by the slope angle. */
export const SLOPE_EULER_X = -SLOPE_ANGLE

/** World point at track metre m, `x` to the side and `h` off the floor. */
export function trackPoint(m, x, h, out) {
  if (m <= 0) return out.set(x, h, TRACK_START_Z - m)
  return out.set(x, -m * SIN + h * COS, TRACK_START_Z - m * COS - h * SIN)
}

const _e = new Euler()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()

/**
 * Matrix of a box lying on the track, given in track terms: centred `x` across, `h`
 * off the floor (to its centre) and at metre `m` (also its centre), sized `sx` across,
 * `sy` thick and `sz` along the track, leaning `lean` radians about its own long axis.
 */
export function slopeBoxMatrix(m, x, h, sx, sy, sz, lean, out) {
  trackPoint(m, x, h, _p)
  _q.setFromEuler(_e.set(m > 0 ? SLOPE_EULER_X : 0, 0, lean))
  return out.compose(_p, _q, _s.set(sx, sy, sz))
}

/** Same as slopeBoxMatrix, but as BlockSet.add arguments: [x, y, z, rotX]. */
export function slopeBoxPlacement(m, x, h) {
  trackPoint(m, x, h, _p)
  return [_p.x, _p.y, _p.z, m > 0 ? SLOPE_EULER_X : 0]
}

/** Metres a world z is along the track (negative in the plaza). */
export const meterAtZ = (z) => (z < TRACK_START_Z ? (TRACK_START_Z - z) / COS : TRACK_START_Z - z)

// --- A launch ---------------------------------------------------------------------

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// --- The spin bar ------------------------------------------------------------------

/**
 * Hanging from the bar, your middle (the pivot the body turns about) is HANG below it;
 * whirling at full speed the rubber arms stretch it out to HANG_FAST. Never so far the
 * feet touch the pad.
 */
export const HANG = 1.35
export const HANG_FAST = 1.8
/** How far your middle hangs below the bar, whirling at `rate` (radians a second). */
export const hangFor = (rate) => HANG + (HANG_FAST - HANG) * Math.min(1, Math.max(0, rate / spinRate(1)))
/** The bar's metre along the runway (it stands just short of the start line, so negative). */
export const BAR_METER = TRACK_START_Z - LAUNCH_POSTS.z
/**
 * Your middle at angle `spin` round the bar, hanging `hang` below it: metre along the
 * runway and height. Angle 0 hangs straight down; it runs down as the feet swing forward
 * under the bar. Writes `{ meter, y }` into `out`.
 */
export function barPoint(spin, hang, out) {
  out.meter = BAR_METER - hang * Math.sin(spin)
  out.y = SPIN_BAR.y - hang * Math.cos(spin)
  return out
}
/** Where you let go: this angle (mod a turn) - low in front, swinging up, feet first. */
export const RELEASE_SPIN = -0.6
/** The last whirl turns at least this far (radians), however you let go. */
const LAST_WHIRL = Math.PI * 1.5

/** Seconds into a launch that you fly clear of the bar: the last whirl takes the whole launch. */
export const KICK_HIT = ROLL_LAUNCH
/** The flight sets off from the release point: this far past the bar. */
export const PUSH_AHEAD = HANG_FAST * Math.sin(-RELEASE_SPIN)
/** Lying flat, how high your middle (the pivot you dive about) is off the ground. */
export const BODY_FLAT = 0.3
/** How big the flier reads to the trail and effects (they were sized for the ball). */
export const TIRE_SIZE = 0.6
/**
 * Somersaults in the air after letting go, by grade: a WEAK launch barely turns over, a
 * PERFECT one tumbles head over heels again and again. A rare throw adds more.
 */
const TUMBLES = { weak: 1, good: 2, great: 3, perfect: 4 }
const RARE_TUMBLES = { lucky: 1, secret: 2, mythic: 3 }
/** The tumbling is over this far into the flight (by distance); then the superhero glide. */
const TUMBLE_END = 0.62

/**
 * The flight takes LAND_T of the launch's time after the last whirl; the rest is
 * belly-flopping onto the turf, bouncing and getting up.
 */
const LAND_T = 0.86
/** Belly bounces on the turf after you slam down, over the first SETTLE of the time left. */
const BOUNCES = 2
const SETTLE = 0.6
/** Seconds to get up and start cheering, once you've stopped. */
const STAND_UP = 0.45

/**
 * How far along its distance (0-1) the flight is `t` of the way through: off the posts
 * fast, slowing as you go, still moving as you slam down at the end.
 */
const progress = (t) => {
  const x = clamp01(t)
  return 1.5 * x - 0.5 * x * x
}

/**
 * Seconds into a launch of `duration` (the snap included) at which you've flown `f`
 * (0-1) of the distance: 0.5 is the top of the arc, 1 the moment you slam down.
 */
export const kickTimeAt = (f, duration) => KICK_HIT + LAND_T * (1.5 - Math.sqrt(2.25 - 2 * clamp01(f))) * Math.max(0.1, duration - KICK_HIT)

/**
 * The flight: one high arc over the whole distance, slamming down exactly where the
 * authority says you stop - a splash of turf (Impact.jsx) - then a couple of belly
 * bounces and you get up to celebrate. The arc's peak grows with the distance (a short
 * hop stays low, a long one soars) and with how well you let go (KICK_ARC: a WEAK one
 * skims low, a PERFECT one soars high), capped so the runway stays in view below you.
 */
const KICK_ARC = { weak: 0.5, good: 0.85, great: 1.15, perfect: 1.45 }
export const flightPeak = (distance, hit = null) =>
  Math.min(44, (4 + 0.6 * Math.sqrt(Math.max(0, distance))) * (KICK_ARC[hit] ?? 1))

/** A fresh state for rideState to write into. */
export const createRideState = () => ({
  phase: 'launch',
  launch: 0,
  meter: 0,
  speed: 0,
  /** Height of your middle off the ground, less BODY_FLAT (0: lying on it). */
  air: 0,
  size: TIRE_SIZE,
  /** True while you're in the arc (until you first land). */
  airborne: false,
  /** 0 in the air; 1 once you've slammed down, then one more for every bounce after. */
  bounces: 0,
  /** How the body is turned head over heels about its middle (0 upright, PI/2 flying flat). */
  pitch: 0,
  /** A barrel roll about the way you're flying (radians). */
  roll: 0,
  /** Metres from your middle up to the bar while you still hold it, else -1. */
  grip: -1,
  /** How fast you're whirling round the bar (0-1), for the pose. */
  strain: 0,
  /** Pose weights: tucked in a somersault, flying like a superhero, sprawled where you landed, up and cheering. */
  tuck: 0,
  fly: 0,
  sprawl: 0,
  cheer: 0,
  /** Never true: nothing on the runway stops you. */
  crashed: false,
  x: 0,
  /** Your middle: the point the body turns about. */
  position: new Vector3(),
})

const _bar = { meter: 0, y: 0 }
const _whirl = { from: 0, to: 0, lead: 1 }

/**
 * The last whirl's start and end angles: from `spin` (where you were when the launch
 * started) round to the release angle at least LAST_WHIRL on, and how much of the turn
 * is at your starting speed (`lead`: 0-1; the rest speeds up into the release).
 */
function lastWhirl(ride) {
  const from = Number.isFinite(ride.spin) ? ride.spin : 0
  const rate = Number.isFinite(ride.spinRate) && ride.spinRate > 0 ? ride.spinRate : spinRate(0.8)
  const turn = Math.PI * 2
  // The first release angle at least LAST_WHIRL (and a launch's worth at this speed) on.
  const least = Math.max(LAST_WHIRL, rate * KICK_HIT)
  const to = RELEASE_SPIN - turn * Math.ceil((RELEASE_SPIN - (from - least)) / turn - 1e-9)
  const span = Math.max(1e-3, from - to)
  _whirl.from = from
  _whirl.to = to
  _whirl.lead = Math.min(1, (rate * KICK_HIT) / span)
  return _whirl
}

/**
 * Everything about a launch `elapsed` seconds in - yours, or another player's replayed
 * from the same numbers, so both fly identically. `ride` is `{ startX, distance,
 * duration, hit, rare, spin, spinRate }` (duration includes the last whirl; `spin` and
 * `spinRate` are the angle and speed round the bar the launch started from - another
 * player's aren't sent, so theirs start from hanging); `lane` is a sideways offset so
 * fliers don't overlap. Writes into `out` (see createRideState):
 *   phase    'launch' (the last whirl round the bar) | 'ride' | 'stopped'
 *   meter    metres along the runway; speed in m/s along it
 *   position your middle; pitch and roll say how the body lies
 */
export function rideState(elapsed, ride, lane, out) {
  const whirl = lastWhirl(ride)
  barPoint(whirl.to, HANG_FAST, _bar)
  const start = _bar.meter
  const startAir = _bar.y - BODY_FLAT
  const end = Math.max(start + 1, ride.distance)
  const flightTime = Math.max(0.1, ride.duration - KICK_HIT)
  const tumbles = (TUMBLES[ride.hit] ?? 2) + (RARE_TUMBLES[ride.rare] ?? 0)
  let meter
  let speed = 0
  let air
  out.airborne = false
  out.crashed = false
  out.bounces = 0
  out.grip = -1
  out.strain = 0
  out.tuck = 0
  out.fly = 0
  out.sprawl = 0
  out.cheer = 0
  out.roll = 0
  if (elapsed < KICK_HIT) {
    // The last whirl: round the bar at the speed you were going, faster and faster, the
    // arms stretching out, until you're flung off the front.
    out.phase = 'launch'
    const u = clamp01(elapsed / KICK_HIT)
    out.launch = u
    const h = whirl.lead * u + (1 - whirl.lead) * u * u
    const spin = whirl.from + (whirl.to - whirl.from) * h
    const hang = HANG + (HANG_FAST - HANG) * Math.min(1, 0.6 + 0.4 * u)
    barPoint(spin, hang, _bar)
    meter = _bar.meter
    air = _bar.y - BODY_FLAT
    speed = ((whirl.from - whirl.to) * (whirl.lead + 2 * (1 - whirl.lead) * u) * hang) / KICK_HIT
    out.pitch = spin
    out.grip = hang
    out.strain = 1
  } else {
    const t = (elapsed - KICK_HIT) / flightTime
    out.launch = 1
    out.phase = t >= 1 ? 'stopped' : 'ride'
    const peak = flightPeak(end - start, ride.hit)
    if (t < LAND_T) {
      const f = progress(t / LAND_T)
      meter = start + (end - start) * f
      speed = ((end - start) * (1.5 - t / LAND_T)) / (LAND_T * flightTime)
      air = startAir * (1 - f) + peak * 4 * f * (1 - f)
      out.airborne = true
      // Flung off feet first, somersaulting head over heels - fast off the bar, slowing -
      // then opening out into a superhero glide, nose up, then down into the landing.
      const glide = Math.PI / 2 - 0.3 + 0.55 * f
      const tumbleTo = Math.PI / 2 - 0.3 + 0.55 * TUMBLE_END - Math.PI * 2 * tumbles
      const g = clamp01(f / TUMBLE_END)
      const eased = 1 - (1 - g) * (1 - g) * (1 - g)
      out.pitch = f < TUMBLE_END ? whirl.to + (tumbleTo - whirl.to) * eased : glide
      const open = smooth(TUMBLE_END * 0.55, TUMBLE_END, f)
      out.tuck = 1 - open
      out.fly = open
      // A PERFECT launch barrel-rolls once in the glide too; the rest just sway.
      out.roll = ride.hit === 'perfect' ? Math.PI * 2 * smooth(TUMBLE_END, 0.85, f) : Math.sin(f * 9) * 0.14 * open
    } else {
      // Down on the turf: belly bounces, each lower, then lying there a moment.
      meter = end
      const v = (t - LAND_T) / (1 - LAND_T) / SETTLE
      air = v < 1 ? peak * 0.06 * (1 - v) * Math.abs(Math.sin(Math.PI * BOUNCES * v)) : 0
      out.bounces = v < 1 ? 1 + Math.min(BOUNCES - 1, Math.floor(v * BOUNCES)) : BOUNCES
      out.pitch = Math.PI / 2
      out.sprawl = 1
    }
    if (t >= 1) {
      // Up on your feet to celebrate.
      const stand = smooth(0, STAND_UP, elapsed - ride.duration)
      out.pitch = (Math.PI / 2) * (1 - stand)
      air = (BODY.pivot - BODY_FLAT) * stand
      out.sprawl = 1 - stand
      out.cheer = stand
    }
  }
  // Ease from where you launched onto your own line down the runway.
  const settle = clamp01((meter - start) / 40)
  const x = ride.startX * (1 - settle) + lane * settle
  out.meter = meter
  out.speed = speed
  out.air = air
  out.x = x
  out.size = TIRE_SIZE
  trackPoint(meter, x, BODY_FLAT + air, out.position)
  return out
}

/** Each other player flies down their own line of the runway, so fliers don't overlap. */
export function laneFor(sid) {
  let h = 2166136261
  for (let i = 0; i < sid.length; i += 1) h = Math.imul(h ^ sid.charCodeAt(i), 16777619)
  return (((h >>> 0) % 5) - 2) * 3
}

const _ax = new Vector3(1, 0, 0)
const _ay = new Vector3(0, 1, 0)
const _az = new Vector3(0, 0, 1)
const _qa = new Quaternion()
const _qb = new Quaternion()

/**
 * The body's turn for ride state `st`, facing down the runway (-Z): turned about the
 * vertical to face it, barrel-rolled about the way it's going, then dived forward
 * about its middle. Applied to an avatar that faces +Z.
 */
export function flierTurn(st, out) {
  out.setFromAxisAngle(_ay, Math.PI)
  out.multiply(_qa.setFromAxisAngle(_az, st.roll))
  return out.multiply(_qb.setFromAxisAngle(_ax, st.pitch))
}
