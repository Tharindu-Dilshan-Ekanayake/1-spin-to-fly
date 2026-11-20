import { Vector3 } from 'three'

import { comboBonus, HIT_GRADES, rareThrowById } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { ROLL_RETURN } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { fadeThrough } from '../../ui/fade'
import { burst, fireBurst } from '../fx/fxQueue'
import { spawnScattered } from '../fx/popups'
import { consumePull } from '../launch'
import { runtime } from '../runtime'
import { zones } from '../worldLook'
import { showHit } from './hudLink'
import { BAR_METER, createRideState, flightPeak, KICK_HIT, PUSH_AHEAD, rideState, kickTimeAt } from './path'

/** How long the "+$N" result shows over you, landed, before you're back. */
const RESULT_HOLD_MS = 2600
/** The skid sound starts this long before a normal stop. */
const SKID_SOUND_LEAD = 0.9

/**
 * The launch currently playing (the template's "roll"), read every frame by the camera,
 * the runway, your avatar and the effects. Everything about it is known when it starts
 * (the authority already resolved the distance and the Cash), so the client just plays it
 * back: no per-frame network traffic.
 *
 * It's a ride state (see path.rideState: phase, meter, air, pitch, roll, grip, the pose
 * weights, position...) plus the launch's numbers. Your logical position stays on the
 * LAUNCH PAD while you fly (that's what the server checks); only your avatar and the
 * camera go down the runway.
 */
export const roll = {
  ...createRideState(),
  active: false,
  /** True once you've landed and the result is showing. */
  stopped: false,
  startedAt: 0,
  distance: 0,
  duration: 1,
  wins: 0,
  prize: 0,
  discovered: [],
  /** Zone index of the wall that stopped it, or -1. */
  blocked: -1,
  /** How many stages it flies into past the first. */
  broken: 0,
  best: false,
  tireId: 'bicycle',
  /** How well you let go (HIT_GRADES id), or null for Auto Launch. */
  hit: null,
  /** How far to the side you launched from: where you hung on the bar. */
  startX: 0,
  /** Your angle and speed round the bar when the launch started: the last whirl goes on from there. */
  spin: 0,
  spinRate: 0,
  /** A rare throw ('lucky' | 'secret' | 'mythic') or null. */
  rare: null,
  /** PERFECTs in a row with this launch (0: not a PERFECT), and its lucky gift or null. */
  combo: 0,
  gift: null,
  /** performance.now() of the last landing, take-off and wall hit, for dust, shake and sound. */
  landedAt: 0,
  tookOffAt: 0,
  hitAt: 0,
  /** performance.now() when you shot past the posts. */
  kickedAt: 0,
  /**
   * A graded hit's hit-stop: when it started (performance.now(), 0 if none this kick),
   * how long it lasts, how strong the camera's zoom, punch and shake are (0-1), and the
   * roll clock's lag when it started (the freeze is measured from it).
   */
  freezeAt: 0,
  freezeMs: 0,
  freezePower: 0,
  freezeLag: 0,
  /** How fast the launch's clock runs during the freeze (a rare throw's cutscene: slow motion). */
  freezeRate: 0.06,
  /**
   * You slamming down at the end of the arc: when (performance.now()), where, and how
   * high you fell from - what the turf splash and its spray of grass need.
   */
  impactAt: 0,
  impact: new Vector3(),
  impactMeter: 0,
  impactPeak: 0,
  frameKey: -1,
  /**
   * Slow motion: ms the roll's clock is behind real time. Every wall smashed slows the
   * ball (and the camera on it) for a moment, so you see the planks burst; the clock
   * catches up again a little faster than real time afterwards, and is always caught up
   * before the ball stops, so the kick ends exactly when the authority said.
   */
  lag: 0,
  lastNow: 0,
}

/** How long each smash's slow motion lasts, how slow, and how fast the clock catches up. */
const SLOW_MS = 220
const SLOW_RATE = 0.25
/** How fast the roll's clock runs during a hit-stop: all but frozen. */
const FREEZE_RATE = 0.06
const CATCH_UP = 0.4

let timers = []

function clearTimers() {
  for (const id of timers) clearTimeout(id)
  timers = []
}

/**
 * Moves the roll on to this frame. Idempotent per frame (keyed on the renderer's
 * clock), so the camera, walls and effects all see exactly the same state however many
 * of them ask.
 */
export function advanceRoll(clockTime) {
  if (!roll.active || roll.frameKey === clockTime) return roll
  roll.frameKey = clockTime
  const now = performance.now()
  const wasAirborne = roll.airborne
  const wasCrashed = roll.crashed
  const wasWaiting = roll.phase === 'launch'
  const wasBounces = roll.bounces
  const dt = roll.lastNow ? Math.min(now - roll.lastNow, 100) : 0
  roll.lastNow = now
  if (now - roll.freezeAt < roll.freezeMs) {
    // From the clock, not summed frame by frame: frame steps are capped, so on a slow
    // device a summed freeze would mostly slip away.
    roll.lag = roll.freezeLag + (now - roll.freezeAt) * (1 - roll.freezeRate)
  } else if (now - roll.hitAt < SLOW_MS && !roll.crashed) roll.lag += dt * (1 - SLOW_RATE)
  else roll.lag = Math.max(0, roll.lag - dt * CATCH_UP)
  // All caught up by half a second before the stop.
  const left = roll.duration - (now - roll.startedAt) / 1000
  roll.lag = Math.min(roll.lag, Math.max(0, left - 0.5) * 400)
  rideState((now - roll.startedAt - roll.lag) / 1000, roll, 0, roll)
  if (wasWaiting && roll.phase !== 'launch') {
    roll.kickedAt = now
    blastOff(now)
  }
  if (!wasAirborne && roll.airborne) {
    roll.tookOffAt = now
    sfx.jumpWhoosh()
  } else if (wasAirborne && !roll.airborne) {
    // Slammed down from the top of the arc: the runway cracks open (Impact.jsx), the
    // camera jolts, a moment of slow motion, and a boom.
    roll.landedAt = now
    roll.hitAt = now
    roll.impactAt = now
    roll.impact.copy(roll.position)
    roll.impactMeter = roll.meter
    roll.impactPeak = flightPeak(roll.distance - BAR_METER - PUSH_AHEAD, roll.hit)
    sfx.groundSmash(Math.min(1, roll.impactPeak / 32))
  }
  // Each belly bounce on the turf after it: a thud, softer every time.
  if (roll.bounces > wasBounces && wasBounces > 0) sfx.bounce(roll.bounces - 1)
  if (!wasCrashed && roll.crashed) {
    roll.hitAt = now
    sfx.wallBlock()
  }
  return roll
}

/**
 * How each grade of launch looks and sounds as you shoot past the posts: its burst
 * (FireBurst kind), confetti, how long time stands still and how hard the camera reacts
 * (0-1). The rest - the title - follows the grade too.
 */
const HIT_FX = {
  // No freeze (freezeMs 0): time standing still at launch read as the game sticking.
  perfect: { fire: 'perfect', palette: 'gold', count: 60, speed: 12, freezeMs: 0, power: 1 },
  great: { fire: 'great', palette: 'power', count: 34, speed: 9, freezeMs: 0, power: 0.65 },
  good: { fire: 'good', palette: 'confetti', count: 16, speed: 6, freezeMs: 0, power: 0.35 },
  weak: { fire: null, palette: null, count: 0, speed: 0, freezeMs: 0, power: 0 },
}

/**
 * A rare throw's cutscene: time slows right down as you leave the bar - a long beat of
 * slow motion with the camera zooming in on you (Roll.jsx, from roll.freezePower) - while
 * its title card slams onto the screen (HitFlash.jsx) and a burst in its colours flies
 * off you; then you rocket away with the lens punching wide. SECRET and MYTHIC throws
 * linger longer, burst bigger and ring louder.
 */
const RARE_FX = {
  lucky: { ms: 900, rate: 0.25, palette: 'gold', count: 70, fire: 'perfect' },
  secret: { ms: 1150, rate: 0.2, palette: 'power', count: 90, fire: 'great' },
  mythic: { ms: 1400, rate: 0.15, palette: 'confetti', count: 120, fire: 'perfect' },
}

/**
 * Flung off the bar: the grade the spin meter gave the launch, straight away, so you see
 * why you fly as far as you do. GOOD, GREAT and PERFECT each get their own moment, bigger
 * every step - a burst flies off you (sparkles, an electric-blue blast, a column of fire)
 * and the grade's title slams onto the screen (HitFlash.jsx); then you blast away with
 * the lens punching wide and the camera shaking (Roll.jsx). A WEAK one just flops off.
 * A rare throw plays its cutscene instead (RARE_FX).
 */
function blastOff(now) {
  const grade = HIT_GRADES.find((g) => g.id === roll.hit)
  const rare = rareThrowById(roll.rare)
  const p = roll.position
  // The freeze starts the moment you left the bar on the launch's clock, not at whichever
  // frame noticed: on a slow frame you'd be well away by then.
  const leftAt = Math.min(now, roll.startedAt + roll.lag + KICK_HIT * 1000)
  if (rare) {
    const fx = RARE_FX[rare.id]
    roll.freezeAt = leftAt
    roll.freezeMs = fx.ms
    roll.freezeRate = fx.rate
    roll.freezePower = 1
    roll.freezeLag = roll.lag
    burst({ x: p.x, y: p.y, z: p.z, count: fx.count, palette: fx.palette, speed: 13 })
    fireBurst(p.x, p.y, p.z, fx.fire)
    showHit(rare.id)
    sfx.gradeHit('perfect')
    sfx.reveal()
    timers.push(setTimeout(() => sfx.perfectRelease(1), fx.ms))
    return
  }
  if (!grade) return
  const fx = HIT_FX[grade.id]
  if (fx.count) burst({ x: p.x, y: p.y, z: p.z, count: fx.count, palette: fx.palette, speed: fx.speed })
  // PERFECTs in a row: the combo and the Cash it adds.
  if (grade.id === 'perfect' && roll.combo >= 2) {
    timers.push(setTimeout(() => spawnScattered(`PERFECT COMBO x${roll.combo}! +${Math.round((comboBonus(roll.combo) - 1) * 100)}% CASH`, { scale: 1.25 }), 450))
  }
  if (grade.id === 'weak') {
    spawnScattered(grade.label, { scale: 1.3 })
    sfx.weakHit()
    return
  }
  roll.freezeAt = leftAt
  roll.freezeMs = fx.freezeMs
  roll.freezeRate = FREEZE_RATE
  roll.freezePower = fx.power
  roll.freezeLag = roll.lag
  fireBurst(p.x, p.y, p.z, fx.fire)
  showHit(grade.id)
  sfx.gradeHit(grade.id)
  timers.push(setTimeout(() => sfx.perfectRelease(fx.power), fx.freezeMs))
}

/**
 * Starts a launch the authority already resolved, from wherever you were round the bar:
 * one last whirl, faster and faster, and you're flung off the front.
 */
export function beginRoll(result) {
  clearTimers()
  const game = getGame()
  // Where you were round the bar, and how fast (a launch without a spin starts from hanging).
  const spun = consumePull()
  Object.assign(roll, {
    active: true,
    stopped: false,
    startedAt: performance.now(),
    distance: result.distance,
    duration: result.duration,
    wins: result.wins,
    prize: result.prize || 0,
    discovered: result.discovered || [],
    blocked: result.blocked ?? -1,
    broken: result.broken || 0,
    best: result.best,
    tireId: result.tireId || game.profile.equippedTire,
    hit: result.hit ?? null,
    startX: runtime.player.position.x,
    spin: spun.live ? spun.spin : 0,
    spinRate: spun.live ? spun.rate : 0,
    rare: result.rare || null,
    combo: result.combo || 0,
    gift: result.gift || null,
    landedAt: 0,
    tookOffAt: 0,
    hitAt: 0,
    kickedAt: 0,
    freezeAt: 0,
    freezeMs: 0,
    freezePower: 0,
    freezeRate: FREEZE_RATE,
    impactAt: 0,
    frameKey: -1,
    lag: 0,
    lastNow: 0,
  })
  rideState(0, roll, 0, roll)
  runtime.player.frozen = true
  // Square up to the runway.
  runtime.player.yaw = Math.PI
  runtime.camera.mode = 'roll'
  // The HUD's switch to the flight (a React update and a restyle) in a task of its own,
  // not the frame the launch starts in: together they made that one frame stick on slow
  // phones. The flight itself is already under way from the runtime state above.
  const started = {
    distance: result.distance,
    wins: result.wins,
    prize: result.prize || 0,
    blocked: result.blocked ?? -1,
    duration: result.duration,
    best: result.best,
    giftWins: result.gift?.wins || 0,
    rare: result.rare || null,
  }
  timers.push(setTimeout(() => game.startRoll(started), 0))

  // The last whirl's whoosh, then the swoosh of being flung off the bar.
  sfx.rubberSnap(1)
  timers.push(setTimeout(() => sfx.rollStart(), KICK_HIT * 1000))
  // A cartoon whistle as you fall from the top of the arc, ending as you slam down.
  const apex = kickTimeAt(0.5, result.duration)
  const land = kickTimeAt(1, result.duration)
  timers.push(setTimeout(() => sfx.fallWhistle(land - apex), apex * 1000))
  timers.push(setTimeout(() => sfx.rollStop(), Math.max(0, result.duration - SKID_SOUND_LEAD) * 1000))
  timers.push(
    setTimeout(() => {
      roll.stopped = true
      sfx.wins()
      const f = roll.position
      burst({ x: f.x, y: f.y + 1.8, z: f.z, count: 50, palette: 'gold', speed: 9 })
      game.endRoll()
      // A stage reached for the first time ever: its name and the prize, once.
      const stages = zones()
      for (const zi of roll.discovered) {
        game.showToast(`NEW STAGE: ${stages[zi].name}! +$${formatNumber(stages[zi].discover)}`)
      }
      // A lucky gift: a present bursting open over you, and what was in it.
      const gift = roll.gift
      if (gift) {
        timers.push(
          setTimeout(
            () => {
              sfx.reveal()
              burst({ x: f.x, y: f.y + 2.4, z: f.z, count: 70, palette: 'confetti', speed: 11 })
              const what = gift.wins ? `+$${formatNumber(gift.wins)}` : gift.label
              game.showToast(`LUCKY GIFT! ${gift.wins ? `${gift.label}: ${what}` : what}`)
            },
            roll.discovered.length ? 1600 : 500,
          ),
        )
      }
      timers.push(setTimeout(() => fadeThrough(finishRoll), RESULT_HOLD_MS))
    }, result.duration * 1000),
  )
}

/**
 * Back at the start, just short of the launch pad, camera behind you. With Auto Launch
 * on you stay on the pad instead, so the next launch goes straight away.
 */
export function finishRoll() {
  clearTimers()
  roll.active = false
  roll.stopped = false
  runtime.flightFocus = null
  const player = runtime.player
  const { passes, settings } = getGame().profile
  if (!(passes.autoRoll && settings.autoRoll)) player.position.set(ROLL_RETURN.x, 0, ROLL_RETURN.z)
  player.yaw = Math.PI
  player.frozen = false
  runtime.camera.mode = 'follow'
  runtime.camera.yaw = 0
  runtime.camera.snap = true
  getGame().clearRollResult()
}
