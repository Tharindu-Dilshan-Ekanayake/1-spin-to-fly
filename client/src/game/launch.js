import { spinMeterAt, spinRate } from '@shared/balance'

/**
 * Your spin on the SPIN BAR, before the authority hears about it. Walk under the bar (or
 * press SPIN by it) and you jump up and grab it (`gripping`), and start whirling round it.
 * The spin meter's marker runs up and down (shared/balance.js spinMeterAt) and the higher
 * it is the faster you spin; TAP TO FLY lets go and sends the launch (net/actions.roll)
 * graded on where the marker was. You keep whirling until the server's answer starts the
 * launch (roll/rollControl.beginRoll), which carries on from exactly this angle and speed.
 *
 * Plain module state, written by the HUD and the player and read every frame by the
 * camera and the avatar - never React state, never per-frame network traffic.
 *
 * The angle runs DOWN: the feet swing forward under the bar, up in front, over the top
 * and down behind - the way that flings you off the front, feet first.
 */
export const launch = {
  /** On the bar, spinning, the meter running. */
  gripping: false,
  /** Spinning by itself (Auto Launch): lets go at the top by itself. */
  auto: false,
  /** Set when you grab: the player moves you under the bar on its next frame. */
  snap: false,
  /** The meter now (0-1), and performance.now() you grabbed the bar. */
  charge: 0,
  grabbedAt: 0,
  /** Your angle round the bar (radians; 0 hanging straight down) and how fast it turns. */
  spin: 0,
  rate: 0,
  /** Let go and waiting for the authority: when. */
  released: false,
  releasedAt: 0,
  lastNow: 0,
}

/** No answer this long after letting go (off the pad, busy): drop off the bar. */
const RELEASE_TIMEOUT_MS = 1500
/** The first swings up from hanging still take this long to reach the meter's pace. */
const WIND_UP_S = 0.5
/** How quickly the spin follows the meter (1/s). */
const RATE_FOLLOW = 7

/** Grabs the bar (`auto`: and lets go at the top by itself). */
export function grab(auto = false) {
  const now = performance.now()
  launch.gripping = true
  launch.auto = auto
  launch.snap = true
  launch.released = false
  launch.charge = 0
  launch.grabbedAt = now
  launch.spin = 0
  launch.rate = 0
  launch.lastNow = now
}

/**
 * Moves the meter and the spin on to `now`. Called every frame by the player while on the
 * bar (and while let go, until the launch takes over). Returns the meter (0-1).
 */
export function updateSpin(now) {
  if (launch.released && now - launch.releasedAt > RELEASE_TIMEOUT_MS) cancelPull()
  if (!launch.gripping && !launch.released) return 0
  const dt = Math.min(0.05, Math.max(0, (now - launch.lastNow) / 1000))
  launch.lastNow = now
  const held = (now - launch.grabbedAt) / 1000
  if (launch.gripping) launch.charge = spinMeterAt(held)
  const windUp = Math.min(1, held / WIND_UP_S)
  // Let go, you keep whirling at full tilt until the launch takes over.
  const want = launch.released ? Math.max(launch.rate, spinRate(1) * 0.9) : spinRate(launch.charge) * windUp
  launch.rate += (want - launch.rate) * (1 - Math.exp(-RATE_FOLLOW * dt))
  launch.spin -= launch.rate * dt
  return launch.charge
}

/** Lets go: returns the meter at that moment (what the launch is graded on). */
export function letGo(now = performance.now()) {
  const charge = launch.charge
  launch.gripping = false
  launch.auto = false
  launch.released = true
  launch.releasedAt = now
  return charge
}

/** The authority's launch has started from the spin: hands over the angle and speed. */
export function consumePull() {
  const state = { spin: launch.spin, rate: launch.rate, live: launch.gripping || launch.released }
  launch.gripping = false
  launch.auto = false
  launch.released = false
  launch.charge = 0
  launch.rate = 0
  return state
}

/** Drops off the bar without launching (CANCEL, a panel opened, no answer came). */
export function cancelPull() {
  launch.gripping = false
  launch.auto = false
  launch.released = false
  launch.charge = 0
  launch.rate = 0
  launch.spin = 0
}

/** Whether you're on the bar at all: spinning, or let go and waiting. */
export const isPulling = () => launch.gripping || launch.released
