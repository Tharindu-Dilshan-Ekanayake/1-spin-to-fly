import { CylinderGeometry, SphereGeometry } from 'three'

import { PATH_HALF } from '@shared/world'

import { STYLE } from '../materials'

/**
 * Shipwreck Cove's dressing round the lobby (World 2 only), for its sunset beach:
 *   - the wreck the cove is named for: an old pirate ship run aground on the sand just
 *     west of the plaza (in a bay the cliffs leave open for it: sceneStyle VENUES
 *     `hills.clear`), keeled over, its mast snapped and its sail torn, a lantern still
 *     glowing in the stern, barrels and a treasure chest spilt beside it;
 *   - tiki torches flickering either side of the boardwalk all the way up to the spin bar;
 *   - beach umbrellas, surfboards and beach balls in the free corners of the plaza.
 *
 * Boxes go in the world's block set and the round parts in its props: no draw calls of
 * their own, nothing done per frame. Everything stands where nobody walks (the wreck is
 * beyond the plaza's edge) or is small enough to brush past. `density` thins it on LOW.
 */

const WOOD = '#6a4424'
const WOOD_LIGHT = '#8a5a32'
const WOOD_DARK = '#3e2614'
const SAIL = '#f2e2bf'
const FLAME = '#ff8a1f'
const FLAME_CORE = '#ffd84a'
const CORAL = '#ff6f61'
const TURQUOISE = '#16b8c4'

const CYL = new CylinderGeometry(1, 1, 1, 12)
const BALL = new SphereGeometry(1, 12, 8)

/** Where the wreck lies (beyond the plaza's west edge), and which way its bow points. */
export const WRECK = { x: -58, z: -26, turn: 0.55 }

/** A point `lx` along the wreck and `lz` across it, in the world. */
function wreckPoint(lx, lz) {
  const c = Math.cos(WRECK.turn)
  const s = Math.sin(WRECK.turn)
  return [WRECK.x + lx * c + lz * s, WRECK.z - lx * s + lz * c]
}

/** One box of the wreck, in its own frame: keeled over by `roll` about its length. */
function wreckBox(blocks, lx, y, lz, sx, sy, sz, color, style = STYLE.SMOOTH, roll = 0.2, pitch = 0) {
  const [x, z] = wreckPoint(lx, lz)
  blocks.add(x, y, z, sx, sy, sz, color, style, WRECK.turn, roll, pitch)
}

function buildWreck(blocks, props) {
  // The hull, half sunk in the sand and keeled over: a long dark keel, lighter planking
  // along its sides, the bow raised at the front and the stern cabin at the back.
  wreckBox(blocks, 0, 0.9, 0, 14, 2.6, 4.6, WOOD, STYLE.STUDS)
  for (const side of [-1, 1]) wreckBox(blocks, 0, 2.35, side * 2.15, 13, 0.5, 0.35, WOOD_LIGHT)
  wreckBox(blocks, 6.8, 2.4, 0, 2.6, 2.6, 3.8, WOOD_LIGHT, STYLE.STUDS, 0.2, -0.25)
  wreckBox(blocks, -5.4, 3.0, 0, 3.6, 2.6, 4.2, WOOD_LIGHT, STYLE.STUDS)
  wreckBox(blocks, -5.4, 4.45, 0, 3.9, 0.3, 4.5, WOOD_DARK)
  // Its stern lantern, still glowing, and the cabin's windows.
  wreckBox(blocks, -7.3, 3.4, 0, 0.12, 0.7, 2.6, '#ffb347', STYLE.GLOW)
  // Holes stove in its side.
  wreckBox(blocks, 1.5, 1.3, 2.36, 1.6, 1.1, 0.12, WOOD_DARK)
  wreckBox(blocks, -2.4, 1.0, 2.36, 1.1, 0.8, 0.12, WOOD_DARK)
  // The mast, snapped and leaning, its yard and the torn sail hanging off it, and a
  // tattered black flag at the top.
  wreckBox(blocks, 0.6, 5.2, 0, 0.6, 8.4, 0.6, WOOD_DARK, STYLE.SMOOTH, 0.42)
  wreckBox(blocks, 0.6, 6.9, -1.6, 0.35, 0.35, 5.2, WOOD_DARK, STYLE.SMOOTH, 0.42)
  wreckBox(blocks, 0.75, 5.2, -1.95, 0.12, 3.2, 3.6, SAIL, STYLE.SMOOTH, 0.5, 0.15)
  wreckBox(blocks, 0.6, 9.35, -3.0, 0.08, 0.9, 1.4, '#1b1b1f', STYLE.SMOOTH, 0.42)
  // Barrels and a treasure chest spilt on the sand, gold glinting in it.
  const [bx, bz] = wreckPoint(3.5, 4.2)
  props.add(CYL, { position: [bx, 0.55, bz], scale: [0.5, 1.1, 0.5], color: WOOD_LIGHT })
  props.add(CYL, { position: [bx + 1.2, 0.4, bz + 0.6], rotation: [Math.PI / 2, 0.6, 0], scale: [0.45, 1, 0.45], color: WOOD_LIGHT })
  const [cx, cz] = wreckPoint(-1.5, 4.4)
  blocks.addOn(cx, 0, cz, 1.6, 0.9, 1.1, WOOD, STYLE.SMOOTH, WRECK.turn)
  blocks.addOn(cx, 0.9, cz, 1.4, 0.25, 0.9, '#ffd21f', STYLE.GLOW, WRECK.turn)
  blocks.add(cx, 1.35, cz - 0.4, 1.6, 0.18, 0.9, WOOD_LIGHT, STYLE.SMOOTH, WRECK.turn, -0.9)
}

/** A tiki torch at (x, z): a bamboo pole, a bowl, a flickering flame. */
function addTorch(blocks, props, x, z) {
  blocks.addOn(x, 0, z, 0.22, 2.3, 0.22, '#a8743a', STYLE.STRIPES)
  blocks.addOn(x, 2.3, z, 0.55, 0.3, 0.55, WOOD_DARK, STYLE.SMOOTH)
  props.add(BALL, { position: [x, 2.85, z], scale: [0.26, 0.42, 0.26], color: FLAME, style: STYLE.GLOW })
  props.add(BALL, { position: [x, 2.8, z], scale: [0.14, 0.26, 0.14], color: FLAME_CORE, style: STYLE.GLOW })
}

/** A beach umbrella with a towel under it at (x, z). */
function addUmbrella(blocks, props, x, z, color, turn) {
  blocks.addOn(x, 0, z, 0.14, 2.7, 0.14, '#ffffff', STYLE.SMOOTH)
  props.add(CYL, { position: [x, 2.75, z], rotation: [0, turn, 0], scale: [1.7, 0.18, 1.7], color })
  props.add(CYL, { position: [x, 2.88, z], rotation: [0, turn, 0], scale: [0.9, 0.12, 0.9], color: '#ffffff' })
  blocks.addOn(x + 1.1, 0, z + 0.4, 1.0, 0.04, 2.0, color === CORAL ? TURQUOISE : CORAL, STYLE.STRIPES, turn)
}

/** A surfboard stuck upright in the sand. */
function addSurfboard(props, x, z, color, turn) {
  props.add(BALL, { position: [x, 1.2, z], rotation: [0, turn, 0.08], scale: [0.14, 1.25, 0.42], color })
  props.add(BALL, { position: [x, 1.2, z], rotation: [0, turn, 0.08], scale: [0.15, 1.05, 0.08], color: '#ffffff' })
}

/** A beach ball, half red half white, lying in the sand. */
function addBeachBall(props, x, z) {
  props.add(BALL, { position: [x, 0.42, z], scale: 0.42, color: CORAL })
  props.add(BALL, { position: [x, 0.44, z], scale: [0.43, 0.43, 0.2], color: '#ffffff' })
}

/** Builds Shipwreck Cove's lobby dressing into `blocks` and `props`. */
export function buildSunsetCove(blocks, props, { density = 1 } = {}) {
  buildWreck(blocks, props)
  // Torches either side of the boardwalk, from the spawn up to the spin bar.
  const step = density >= 0.5 ? 12 : 24
  for (let z = -28; z <= 8; z += step) {
    for (const side of [-1, 1]) addTorch(blocks, props, side * (PATH_HALF + 1.7), z)
  }
  // Umbrellas, surfboards and beach balls in the plaza's free south corners.
  addUmbrella(blocks, props, -28, 28, CORAL, 0.3)
  addUmbrella(blocks, props, 32, 29.5, TURQUOISE, 2.2)
  if (density >= 0.5) {
    addUmbrella(blocks, props, -38, 29, TURQUOISE, 1.1)
    addSurfboard(props, -33, 31.5, '#ffd27a', 0.4)
    addSurfboard(props, 53, 31, CORAL, 2.0)
    addBeachBall(props, -24, 30.5)
    addBeachBall(props, 26.5, 31.5)
  }
}
