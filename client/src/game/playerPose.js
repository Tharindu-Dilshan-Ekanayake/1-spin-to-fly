/**
 * The player's body language, shared by the Bloxity avatar and the blocky stand-in so
 * both move the same way.
 *
 * `computePose` turns the motion state into joint angles and arm stretches; each avatar
 * applies them to its own limbs. Angles are radians in character space (the character
 * faces +Z, its left side is +X), about each joint's pivot:
 *   swing - about X: negative swings a hanging limb forward (arm up in front, knee up);
 *           on the spine and neck, which point up, negative bends them back
 *   sway  - about Z: positive moves a limb towards +X
 *   twist - about Y: positive turns the right shoulder forward
 * `lift` raises (or, to keep bent legs on the ground, lowers) the body, in metres.
 * `stretchL` / `stretchR` are how long each arm is against its rest length: the rubber
 * arms this game is about (1 = normal, 3 = three times as long).
 */

export const POSED_BONES = [
  'Spine1',
  'Neck1',
  'ArmL1',
  'ArmL2',
  'ArmR1',
  'ArmR2',
  'LegL1',
  'LegL2',
  'LegR1',
  'LegR2',
]

/** Written by `computePose` every frame; one shared result, never reallocated. */
export const pose = {
  lift: 0,
  stretchL: 1,
  stretchR: 1,
  bones: Object.fromEntries(POSED_BONES.map((name) => [name, { swing: 0, sway: 0, twist: 0 }])),
}

/**
 * The 1.8 m character's measurements, for aiming the arms at things (launch posts, a
 * pull-up bar): shoulder height and how far out from the middle, arm length (shoulder
 * to palm), and the pivot the body turns about when it dives (its middle). Measured on
 * Bloxity's player.glb fitted to 1.8 m (the shoulder joint sits at 1.35 m, 0.56 m out,
 * and the arm reaches 0.675 m to the bottom of the hand). Avatars whose arms are a
 * different length rescale the stretch (avatarRig.animateRig).
 */
export const BODY = { shoulderY: 1.35, shoulderX: 0.56, arm: 0.63, pivot: 0.9 }

/** The hands' spread on the spin bar (each this far out from the middle). */
export const GRIP = { x: 0.5 }


/** Sway sign that moves a limb away from the body, per side. */
const OUT_L = 1
const OUT_R = -1

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Adds to a joint, scaled by weight `w`. */
function add(name, swing, sway, twist, w) {
  const b = pose.bones[name]
  b.swing += swing * w
  b.sway += sway * w
  b.twist += twist * w
}

/**
 * Points both arms from the shoulders along (out, up, fwd) - metres in the upright
 * character's frame, `out` away from the body - stretching them to reach that far.
 * `parentSwing` is how far the arms' frame is already turned about X (the spine's bend
 * plus the whole body's dive), so the arm still ends up where it was aimed.
 */
function aimArms(out, up, fwd, parentSwing, w) {
  const len = Math.max(0.05, Math.hypot(out, up, fwd))
  const sway = Math.asin(Math.min(1, Math.max(-1, out / len)))
  const swing = Math.atan2(-fwd, -up) - parentSwing
  add('ArmL1', swing, sway * OUT_L, 0, w)
  add('ArmR1', swing, sway * OUT_R, 0, w)
  // The rubber hand reaches on past the arm's end: its palm, not its wrist, on the target.
  const extra = (Math.max(0.05, len - HAND_REACH) / BODY.arm - 1) * w
  pose.stretchL += extra
  pose.stretchR += extra
}

/** Relaxed stance: knees soft, breathing, a little hunched (the arms are rubberArms'). */
function stance(w, time) {
  const breath = Math.sin(time * 1.8)
  add('LegL1', -0.04, 0.06 * OUT_L, 0, w)
  add('LegL2', 0.08, 0, 0, w)
  add('LegR1', 0.04, 0.06 * OUT_R, 0, w)
  add('LegR2', 0.08, 0, 0, w)
  add('Spine1', 0.04 + breath * 0.015, 0, 0, w)
  add('Neck1', -0.04, 0, 0, w)
  pose.lift += (-0.01 + breath * 0.006) * w
}

/**
 * Walk to sprint: the legs swing and the body bobs once per step (the arms drag along
 * the ground: rubberArms). `phase` advances faster with speed, so the steps quicken.
 */
function stride(phase, ratio) {
  const cycle = Math.sin(phase)
  const leg = 0.85 * ratio
  add('LegL1', cycle * leg, 0, 0, 1)
  add('LegR1', -cycle * leg, 0, 0, 1)
  // Knees fold on the back swing only.
  add('LegL2', Math.max(0, -cycle) * 1.1 * ratio, 0, 0, 1)
  add('LegR2', Math.max(0, cycle) * 1.1 * ratio, 0, 0, 1)
  add('Spine1', (0.06 + 0.1 * ratio) * ratio, 0, cycle * 0.12 * ratio, 1)
  pose.lift += (Math.abs(Math.cos(phase)) * 0.05 - 0.015) * ratio
}

// --- Rubber arm physics -------------------------------------------------------------

/** The arms' springs: stiffness and damping (underdamped: they overshoot and wobble). */
const ARM_K = 70
const ARM_C = 6.5
/** Physics steps at most this long, so a slow frame can't blow the springs up. */
const ARM_STEP = 1 / 60
/** How far past the end of the arm a rubber hand grips (its palm). */
const HAND_REACH = 0.2
/** Arms fling up and out to this length in the air (times their own). */
const AIR_REACH = 1.7

/**
 * Springy arms: hanging from the shoulders at their own length. Each arm's swing is a
 * damped spring chasing where it wants to be (swinging against your stride, trailing a
 * little the faster you move), so the arms lag, overshoot and wobble when you start,
 * stop or land. In the air they fling up and out, and flop back down when you land. The
 * springs' state lives on `motion` (one per avatar).
 */
function rubberArms(motion, ratio, phase, grounded, w) {
  const time = motion.time ?? 0
  // How grown the arms are (0-1: armStyles.armGrowth): short at first, floor-length later.
  const grow = motion.grow ?? 1
  const st = (motion.arms ??= { t: time, l: 0.2, r: 0.2, vl: 0, vr: 0, out: 0.2, vOut: 0, contact: 1 })
  let dt = time - st.t
  st.t = time
  // Back from another pose (or a long pause): pick up from where the arms want to be.
  if (dt <= 0 || dt > 0.25) dt = 0
  // Arms swing against the stride, trailing a little more the faster you go.
  const drag = 0.04 + 0.3 * ratio
  const swing = Math.sin(phase) * 0.65 * ratio
  const tl = grounded ? drag + swing : -0.5
  const tr = grounded ? drag - swing : -0.5
  const tOut = grounded ? 0.1 + 0.06 * ratio : 0.9
  while (dt > 0) {
    const h = Math.min(dt, ARM_STEP)
    dt -= h
    st.vl += (ARM_K * (tl - st.l) - ARM_C * st.vl) * h
    st.vr += (ARM_K * (tr - st.r) - ARM_C * st.vr) * h
    st.vOut += (ARM_K * (tOut - st.out) - ARM_C * st.vOut) * h
    st.l += st.vl * h
    st.r += st.vr * h
    st.out += st.vOut * h
    st.contact += ((grounded ? 1 : 0) - st.contact) * Math.min(1, h * 12)
  }
  st.l = Math.min(1.2, Math.max(-1.3, st.l))
  st.r = Math.min(1.2, Math.max(-1.3, st.r))
  st.out = Math.min(1.2, Math.max(0.05, st.out))
  // Arms at their own length on the ground (a touch longer the better your arms), flung
  // out a little longer in the air.
  const reach = () => st.contact * (1 + 0.1 * grow) + (1 - st.contact) * (1.12 + (AIR_REACH - 1.12) * grow)
  add('ArmL1', st.l, st.out * OUT_L, 0, w)
  add('ArmR1', st.r, st.out * OUT_R, 0, w)
  pose.stretchL += (reach(st.l) - 1) * w
  pose.stretchR += (reach(st.r) - 1) * w
}

/**
 * In the air: one knee up on the way up; falling, the legs straighten and reach down for
 * the ground. (The arms are rubberArms': flung up and out.)
 */
function airborne(vy) {
  const f = smooth(0, 1, clamp01((2 - vy) / 9))
  add('LegL1', lerp(-1.3, -0.35, f), 0.08 * OUT_L, 0, 1)
  add('LegL2', lerp(1.6, 0.25, f), 0, 0, 1)
  add('LegR1', lerp(0.25, -0.1, f), 0.08 * OUT_R, 0, 1)
  add('LegR2', lerp(0.5, 0.2, f), 0, 0, 1)
  add('Spine1', lerp(0.15, -0.06, f), 0, 0, 1)
}

/**
 * Seated dumbbell presses on a training bench (`phase` advances one rep every
 * TRAIN_INTERVAL): sitting on the seat (SEAT lower than standing), thighs level, shins
 * down, a dumbbell in each hand (the rubber arms carry them: armStyles), pushed up from
 * the shoulders to overhead - quick up, slower down - the head tipping back to watch.
 */
const SEAT_DROP = 0.36
function benchPress(phase, w) {
  // 0 at the shoulders, 1 pressed overhead.
  const c = 0.5 - 0.5 * Math.cos(phase)
  const up = Math.pow(c, 0.8)
  pose.lift -= SEAT_DROP * w
  add('LegL1', -1.45, 0.12 * OUT_L, 0, w)
  add('LegR1', -1.45, 0.12 * OUT_R, 0, w)
  add('LegL2', 1.45, 0, 0, w)
  add('LegR2', 1.45, 0, 0, w)
  add('Spine1', -0.04 - 0.06 * up, 0, 0, w)
  add('Neck1', -0.08 - 0.14 * up, 0, 0, w)
  aimArms(0.34 - 0.04 * up, 0.14 + 0.56 * up, 0.12 - 0.06 * up, -0.04 - 0.06 * up, w)
}

/**
 * Whirling round the spin bar: both hands on it, `hang` metres up from your middle (the
 * holder turns the whole body round the bar), arms stretched up to it like rubber, body
 * long and legs together - piking at the knees and hips as you swing through, more the
 * faster you go (`speed` 0-1), the legs whipping behind like a gymnast's.
 */
function hanging(hang, speed, time, w) {
  const whip = Math.sin(time * 11) * 0.12 * speed
  add('Spine1', -0.08 - 0.1 * speed, 0, 0, w)
  add('Neck1', -0.25, 0, 0, w)
  add('LegL1', -0.25 * speed + whip, 0.03 * OUT_L, 0, w)
  add('LegR1', -0.25 * speed + whip, 0.03 * OUT_R, 0, w)
  add('LegL2', 0.15 + 0.35 * speed, 0, 0, w)
  add('LegR2', 0.15 + 0.35 * speed, 0, 0, w)
  // The hands stay on the bar: the arms reach it from the shoulders, straight up.
  const up = Math.max(BODY.arm * 0.95, hang - (BODY.shoulderY - BODY.pivot))
  aimArms(GRIP.x - BODY.shoulderX, up, 0, -0.08 - 0.1 * speed, w)
}

/**
 * Somersaulting through the air (the holder turns the body head over heels): knees hugged
 * to the chest, rubber arms wrapped round the shins, chin tucked - a cannonball.
 */
function tucked(time, w) {
  const wobble = Math.sin(time * 9) * 0.06
  add('Spine1', 0.55, 0, 0, w)
  add('Neck1', 0.35, 0, 0, w)
  add('LegL1', -2.1, 0.12 * OUT_L, 0, w)
  add('LegR1', -2.1, 0.12 * OUT_R, 0, w)
  add('LegL2', 2.2, 0, 0, w)
  add('LegR2', 2.2, 0, 0, w)
  add('ArmL1', -0.9 + wobble, 0.25 * OUT_L, 0, w)
  add('ArmR1', -0.9 - wobble, 0.25 * OUT_R, 0, w)
  add('ArmL2', -1.2, 0, 0, w)
  add('ArmR2', -1.2, 0, 0, w)
  pose.lift += 0.25 * w
}

/**
 * Flying like a superhero (the holder lies the body down head first): both arms
 * stretched out ahead - longer than ever, wobbling like rubber - legs straight out
 * behind and fluttering, back arched and head up to see where you're going. A PERFECT
 * launch reaches even further.
 */
function flying(time, reach, w) {
  const flutter = Math.sin(time * 14) * 0.08
  const wobble = Math.sin(time * 7.3) * 0.12
  add('ArmL1', -3.0, -0.1 * OUT_L, 0, w)
  add('ArmR1', -3.0, -0.1 * OUT_R, 0, w)
  add('LegL1', 0.12 + flutter, 0.1 * OUT_L, 0, w)
  add('LegR1', 0.12 - flutter, 0.1 * OUT_R, 0, w)
  add('LegL2', 0.1, 0, 0, w)
  add('LegR2', 0.1, 0, 0, w)
  add('Spine1', -0.12, 0, 0, w)
  add('Neck1', -0.75, 0, 0, w)
  pose.stretchL += (reach - 1 + wobble) * w
  pose.stretchR += (reach - 1 - wobble) * w
}

/** Belly-down where you landed: arms and legs splayed out like a starfish, head up. */
function sprawled(time, w) {
  add('ArmL1', -2.4, 0.9 * OUT_L, 0, w)
  add('ArmR1', -2.4, 0.9 * OUT_R, 0, w)
  add('LegL1', 0.1, 0.35 * OUT_L, 0, w)
  add('LegR1', 0.1, 0.35 * OUT_R, 0, w)
  add('Neck1', -0.6, 0, 0, w)
  const settle = Math.sin(time * 9) * 0.05
  pose.stretchL += (0.25 + settle) * w
  pose.stretchR += (0.25 - settle) * w
}

/** Arms up and waving, bouncing on the spot: the celebration once you've landed. */
function cheering(time, w) {
  const wave = Math.sin(time * 10) * 0.28
  add('ArmL1', -2.7 + wave, 0.38 * OUT_L, 0, w)
  add('ArmR1', -2.7 - wave, 0.38 * OUT_R, 0, w)
  add('ArmL2', -0.25, 0, 0, w)
  add('ArmR2', -0.25, 0, 0, w)
  add('LegL1', -0.12, 0.06 * OUT_L, 0, w)
  add('LegR1', -0.12, 0.06 * OUT_R, 0, w)
  add('LegL2', 0.22, 0, 0, w)
  add('LegR2', 0.22, 0, 0, w)
  add('Spine1', -0.1, 0, 0, w)
  add('Neck1', -0.15, 0, 0, w)
  // Waving arms boing up long and back.
  const boing = 0.3 + Math.abs(Math.sin(time * 5)) * 0.4
  pose.stretchL += boing * w
  pose.stretchR += boing * w
  pose.lift += Math.abs(Math.sin(time * 7)) * 0.16 * w
}

/**
 * @param {{ time?: number, speed?: number, maxSpeed?: number, grounded?: boolean,
 *   vy?: number, stride?: number, run?: number, grip?: number, strain?: number,
 *   pitch?: number, fly?: number, reach?: number, sprawl?: number, cheer?: number,
 *   emote?: string|null }} motion
 *   `run` (0-1) is pressing dumbbells on a training bench (`stride` is the rep's phase);
 *   the name is the template's, and what other players are told ('run').
 *   `grip` is how far up from your middle the spin bar is while you hold it (below 0:
 *   not holding); `strain` (0-1) how fast you're whirling round it. The holder turns the
 *   body round the bar itself.
 *   `tuck` (0-1) is somersaulting in the air, `fly` (0-1) the superhero glide, its arms
 *   `reach` times their length; `sprawl` (0-1) lying where you landed and `cheer` (0-1)
 *   up and celebrating.
 *   `emote` is a Boxity emote id to play over this pose, or null. It isn't posed here:
 *   the Bloxity avatar blends the emote clip on top of this pose (avatarRig.updateEmote),
 *   so the same motion object drives both. `emoteFromAnim(r.anim)` in bloxity/emotes.js
 *   turns another player's synced anim ('emote:<id>') into this field.
 */
export function computePose(motion) {
  const {
    time = 0,
    speed = 0,
    maxSpeed = 6,
    grounded = true,
    vy = 0,
    stride: phase = time * 5,
    run = 0,
    grip = -1,
    strain = 0,
    tuck = 0,
    fly = 0,
    reach = 1.4,
    sprawl = 0,
    cheer = 0,
  } = motion
  for (const name of POSED_BONES) {
    const b = pose.bones[name]
    b.swing = 0
    b.sway = 0
    b.twist = 0
  }
  pose.lift = 0
  pose.stretchL = 1
  pose.stretchR = 1

  // A launch: whirling round the bar, somersaulting, flying, sprawled, cheering.
  if (grip >= 0) {
    hanging(grip, strain, time, 1)
    return pose
  }
  if (tuck > 0 || fly > 0 || sprawl > 0 || cheer > 0) {
    if (tuck > 0) tucked(time, tuck)
    if (fly > 0) flying(time, reach, fly)
    if (sprawl > 0) sprawled(time, sprawl)
    if (cheer > 0) cheering(time, cheer)
    const rest = clamp01(1 - tuck - fly - sprawl - cheer)
    if (rest > 0) stance(rest, time)
    return pose
  }
  if (run > 0 && grounded) {
    benchPress(phase, clamp01(run))
    return pose
  }
  const ratio = grounded ? clamp01(speed / Math.max(maxSpeed, 0.001)) : 0
  if (grounded) {
    const still = 1 - smooth(0.05, 0.4, ratio)
    stance(still, time)
    if (ratio > 0.02) stride(phase, ratio)
  } else {
    airborne(vy)
  }
  rubberArms(motion, ratio, phase, grounded, 1)
  return pose
}
