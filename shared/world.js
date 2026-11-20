/**
 * Lobby layout: every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a pad or the roll zone is.
 *
 * Units are roughly metres in the lobby (the avatar is 1.8 tall) and yards down the kick field. +X is east, -Z is north, which is
 * "forward" from spawn and the way down the track.
 *
 * Seen from spawn: the kick zone and the field beyond it straight ahead (north), the
 * treadmills along the right (east) side, the ball shop on the left (west),
 * the eggs in a row back on the left, the Volcano egg front right, the leaderboards
 * behind. Grandstands ring the whole plaza, like a football stadium.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

/**
 * The lobby is a wide, short valley: you spawn near its south edge and a path runs north,
 * 55 m, to the SPIN BAR at the mouth of the runway. Everything else is a short walk to
 * either side. The east wing holds training and pets: the benches in a staggered 3 x 3
 * block at its south end, by the leaderboards, and the eggs in rows at its north end,
 * towards the spin bar. The west wing is the arm shop, with the free reward by the spawn.
 * The leaderboards stand right behind the spawn.
 */
export const SPAWN = { x: 0, z: 18 }

/** The flat, walkable plaza. Hills surround it on every side but the track. */
export const PLAZA = { minX: -44, maxX: 56, minZ: -40, maxZ: 34 }
/** The path down its middle (half its width). */
export const PATH_HALF = 5

// --- The track ----------------------------------------------------------------------

/**
 * The start of the field: the plaza's north edge, where the kick field starts. Track metre
 * m is m yards along the field from here.
 */
export const TRACK_START_Z = PLAZA.minZ
/** How steeply the kick field drops away from the start: 0, dead level all the way. */
export const SLOPE_ANGLE = 0
/** Half the width of the canyon floor. */
export const CANYON_HALF_WIDTH = 16

/** The yellow LAUNCH PAD (the template's roll zone) at the runway's mouth: launches go from here. */
export const ROLL_ZONE = { minX: -12.5, maxX: 12.5, minZ: -40, maxZ: -32.5 }
/** Where you're put back after a launch: on the pad, just behind the bar, close enough to press SPIN again. */
export const ROLL_RETURN = { x: 0, z: -34.6 }

/**
 * The SPIN BAR: a long steel bar on two tall posts right across the launch pad, `SPIN_BAR.y`
 * up, the posts `halfGap` either side of the runway's middle - long enough for a full
 * server (16 players) to spin side by side. Walk under it anywhere along its length
 * (`SPIN_BAR.reach` either side of the middle) and you jump up and grab it there, then
 * swing round and round it - faster and faster - and let go to be flung down the runway.
 * You stay right under the bar the whole time, so the server's launch check is simply "on
 * the launch pad". LAUNCH_STAND is the bar's middle (labels, the tutorial arrow).
 */
export const LAUNCH_POSTS = { x: 0, z: -37.2, halfGap: 11 }
export const SPIN_BAR = { y: 3.8, reach: LAUNCH_POSTS.halfGap - 1.1 }
export const LAUNCH_STAND = { x: LAUNCH_POSTS.x, z: LAUNCH_POSTS.z }
/** How far in front of or behind the bar you can be to grab it (SPIN button). */
export const GRAB_RADIUS = 3.5
/** Where along the bar you hang if you grab it standing at x: right above you, inside the posts. */
export const barGrabX = (x) => Math.min(LAUNCH_POSTS.x + SPIN_BAR.reach, Math.max(LAUNCH_POSTS.x - SPIN_BAR.reach, x))
export const nearLaunchPosts = (x, z, margin = 0) =>
  Math.abs(z - LAUNCH_STAND.z) <= GRAB_RADIUS + margin && Math.abs(x - LAUNCH_POSTS.x) <= SPIN_BAR.reach + 1 + margin
/** The start arch's pillars, either side of the zone. */
export const ROLL_ARCH = { x: 15.5, z: -37 }

/** Walkable ground; the controller clamps the player into it. Nothing past the start. */
export const WALKABLE = [PLAZA]

// --- Training pads ------------------------------------------------------------------

/**
 * The training benches stand in two straight columns on the east wing, every one facing
 * west, towards the red carpet that runs from the lobby up to the stage. Each column
 * counts from right to left as you look at it from the carpet (south to north, from the
 * leaderboards up towards the eggs): five benches in the column by the carpet, four in the
 * one behind. Each is a raised square podium (the pad: standing on it is training) with a
 * weight bench across it and a dumbbell rack at each end, and its multiplier label floating
 * above. Nothing stands round a podium (only the locked ones are walled off), so you walk
 * straight onto any of them from the carpet.
 */
/** Seven benches, then Shipwreck Cove's two at the far end of the back column. */
export const PAD_COUNT = 9
/** Radius of a pad's top: standing within it is training. */
export const PAD_RADIUS = 2.7
/** The pads' tops, a step up from the plaza. */
export const PAD_HEIGHT = 0.5
/** Each column's x, and the benches' z along it, right to left (south to north), 8 m apart. */
const PAD_COLUMNS = [
  { x: 17, zs: [26, 18, 10, 2, -6] },
  { x: 43, zs: [26, 18, 10, 2] },
]
const PAD_SPOTS = PAD_COLUMNS.flatMap((column) => column.zs.map((z) => ({ x: column.x, z })))

export const padCenterX = (index) => PAD_SPOTS[index].x
export const padCenterZ = (index) => PAD_SPOTS[index].z

/**
 * Each pull-up bar is higher than the last: the first hangs just over your head, the best
 * ones tower - so the later you train, the more your rubber arms have to stretch.
 */
export const padBarHeight = (index) => 2.6 + 0.62 * Math.max(0, index)

/** Which way trainees face: west, towards the carpet (yaw 0 faces +Z, south; PI/2 east). */
export const PAD_YAW = -Math.PI / 2
/** That way as a unit vector on the ground, and the trainee's right hand. */
const AHEAD = { x: Math.round(Math.sin(PAD_YAW)), z: Math.round(Math.cos(PAD_YAW)) }
const RIGHT = { x: -AHEAD.z, z: AHEAD.x }

/**
 * A point `ahead` metres in front of pad `index`'s centre (the way its trainees face) and
 * `right` metres to their right, in world x/z. The stations are built in this frame.
 */
export const padPoint = (index, ahead, right = 0) => ({
  x: padCenterX(index) + AHEAD.x * ahead + RIGHT.x * right,
  z: padCenterZ(index) + AHEAD.z * ahead + RIGHT.z * right,
})

/**
 * The training bench on each pad runs across the mat (left to right of the trainee), long
 * enough for several players to sit side by side: you sit where you stand along it, no
 * further than BENCH_HALF from the pad's middle. Writes the seat's x/z into `out`.
 */
export const BENCH_HALF = 1.9
export function benchSeat(index, x, z, out = { x: 0, z: 0 }) {
  const cx = padCenterX(index)
  const cz = padCenterZ(index)
  const along = Math.min(BENCH_HALF, Math.max(-BENCH_HALF, (x - cx) * RIGHT.x + (z - cz) * RIGHT.z))
  out.x = cx + RIGHT.x * along
  out.z = cz + RIGHT.z * along
  return out
}

/** The square round pad `index`: its raised deck (walkable, and a wall while locked). */
export function padRect(index) {
  const cx = padCenterX(index)
  const cz = padCenterZ(index)
  const r = PAD_RADIUS + 0.3
  return { minX: cx - r, maxX: cx + r, minZ: cz - r, maxZ: cz + r }
}

// --- Ball shop ----------------------------------------------------------------------

/**
 * The arm shop: an open-air yard on the west wing with two display stages, the first
 * twelve pairs on the low front one and the next twelve on the higher back one, and a big
 * ARM SHOP sign behind. Both stages are low enough to walk straight onto.
 */
export const SHOP = { minX: -38, maxX: -12, minZ: -18, maxZ: 22 }
export const SHOP_STAGES = [
  { minX: -24, maxX: -13.5, minZ: -17, maxZ: 21, height: 0.5 },
  { minX: -37, maxX: -26.5, minZ: -17, maxZ: 21, height: 1 },
]
/** The sign along the back (west) edge, facing the plaza, high enough to clear the labels. */
export const SHOP_SIGN = { x: -38.6, minZ: -14, maxZ: 18, top: 16 }
/** Which way the sign faces: +1 east (towards the plaza). */
export const SHOP_SIGN_FACING = 1
export const STAND_SIZE = 4

/** Rows of display stands, nearest the plaza first: two rows on each stage. */
const STAND_ROWS_X = [-16, -21.5, -29, -34.5]
/** Stands per row, and how far apart along it. */
const STANDS_PER_ROW = 6
const STAND_PITCH = 7

/**
 * Twenty-four stands, six to a row. `row` (0-3, front to back) lets the labels above
 * them step up so nearer ones don't hide farther ones.
 */
export const TIRE_STANDS = Array.from({ length: 24 }, (_, i) => {
  const row = Math.floor(i / STANDS_PER_ROW)
  return {
    index: i,
    row,
    x: STAND_ROWS_X[row],
    z: (SHOP.minZ + SHOP.maxZ) / 2 - (STAND_PITCH * (STANDS_PER_ROW - 1)) / 2 + (i % STANDS_PER_ROW) * STAND_PITCH,
    y: SHOP_STAGES[row < 2 ? 0 : 1].height,
  }
})

export const standRect = (stand) => ({
  minX: stand.x - STAND_SIZE / 2,
  maxX: stand.x + STAND_SIZE / 2,
  minZ: stand.z - STAND_SIZE / 2,
  maxZ: stand.z + STAND_SIZE / 2,
})

// --- Eggs, showcases, leaderboards --------------------------------------------------

/**
 * The eggs stand on the training side too, at its north end towards the spin bar: a row of
 * four from the path outwards with the Sphinx at its end, and the two big eggs in a second
 * row behind it.
 */
export const EGG_STANDS = [
  { eggId: 'basic', x: 14, z: -14 },
  { eggId: 'meadow', x: 22, z: -14 },
  { eggId: 'sunset', x: 30, z: -14 },
  { eggId: 'unicorn', x: 38, z: -14 },
  { eggId: 'volcano', x: 20, z: -26, big: true },
  // Shipwreck Cove's egg, the Volcano egg's twin (hatches there only; in World 1 it stands
  // locked, a taste of what's through the portal).
  { eggId: 'beach', x: 32, z: -26, big: true },
]
export const EGG_TRIGGER_RADIUS = 4.2

/** Limited premium pet on display, at the end of the egg column. */
export const SPHINX_STAND = { x: 47, z: -14 }

/** Four boards in a row right behind the spawn. */
export const LEADERBOARDS = [
  { id: 'rebirths', x: -18, z: 31.5 },
  { id: 'wins', x: -6, z: 31.5 },
  { id: 'distance', x: 6, z: 31.5 },
  { id: 'playtime', x: 18, z: 31.5 },
]

/** The world portal beside the start arch, to the west. Name and Wins in balance.js. */
export const PORTALS = [{ id: 'world2', x: -28, z: -34, radius: 3.4 }]

export const FREE_REWARD = { x: -9, z: 26, radius: 3 }

/**
 * Palm Beach's Secret Star (balance SECRET_STAR): tucked away behind the middle of the
 * leaderboards at the back of the plaza, where the camera never looks unless you go
 * round. Picked up within `radius`, in Palm Beach only.
 */
export const STAR = { x: -6, z: 33.2, y: 1.4, radius: 1.8 }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
})

/** Solid, never-changing obstacles. Locked pads add their own walls at runtime. */
export const STATIC_COLLIDERS = [
  // The ball shop's sign.
  { minX: SHOP_SIGN.x - 0.5, maxX: SHOP_SIGN.x + 0.5, minZ: SHOP_SIGN.minZ - 0.5, maxZ: SHOP_SIGN.maxZ + 0.5 },
  // Egg pedestals.
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.1 : 1.6, s.big ? 2.1 : 1.6)),
  box(SPHINX_STAND.x, SPHINX_STAND.z, 3, 3),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  // Each portal ring's base; the swirl itself is walk-through.
  ...PORTALS.flatMap((p) => [box(p.x - p.radius, p.z, 0.6, 0.8), box(p.x + p.radius, p.z, 0.6, 0.8)]),
  // The spin bar's two posts (the bar itself is overhead).
  box(LAUNCH_POSTS.x - LAUNCH_POSTS.halfGap, LAUNCH_POSTS.z, 0.45, 0.45),
  box(LAUNCH_POSTS.x + LAUNCH_POSTS.halfGap, LAUNCH_POSTS.z, 0.45, 0.45),
  // The start arch's pillars.
  box(-ROLL_ARCH.x, ROLL_ARCH.z, 1, 1),
  box(ROLL_ARCH.x, ROLL_ARCH.z, 1, 1),
  // The canyon's rims either side of its mouth.
  { minX: PLAZA.minX, maxX: -CANYON_HALF_WIDTH - 1, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
  { minX: CANYON_HALF_WIDTH + 1, maxX: PLAZA.maxX, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
]

/** Raised floors the player stands on, as rects with a height. */
export const PLATFORMS = [
  ...SHOP_STAGES.map((s) => ({ ...s })),
  ...Array.from({ length: PAD_COUNT }, (_, i) => ({ ...padRect(i), height: PAD_HEIGHT })),
]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Whether (x, z) is on training pad `index`'s top, give or take `margin`. */
export const onPad = (index, x, z, margin = 0) => Math.hypot(x - padCenterX(index), z - padCenterZ(index)) <= PAD_RADIUS + margin

/** Index of the training pad under (x, z), or -1. */
export function padAt(x, z, margin = 0) {
  for (let i = 0; i < PAD_COUNT; i += 1) {
    if (onPad(i, x, z, margin)) return i
  }
  return -1
}

export const inRollZone = (x, z, margin = 0) => inRect(ROLL_ZONE, x, z, margin)

/** The portal whose swirl (x, z) is in, give or take `margin`, or null. */
export function portalAt(x, z, margin = 0) {
  for (const p of PORTALS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius + margin) return p
  }
  return null
}

/**
 * Whether a move from `from` to `to` is the hop back after a roll: off the roll zone
 * onto ROLL_RETURN. Faster than walking, so the server's speed check lets exactly this
 * one through.
 */
export const isRollReturn = (from, to) =>
  inRollZone(from.x, from.z, 2) && Math.hypot(to.x - ROLL_RETURN.x, to.z - ROLL_RETURN.z) < 2.5

/** Index of the tire stand under (x, z), or -1. */
export function standAt(x, z) {
  for (const stand of TIRE_STANDS) {
    if (inRect(standRect(stand), x, z)) return stand.index
  }
  return -1
}

/** The egg stand within reach of (x, z), or null. */
export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Fastest a player can legitimately move, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
