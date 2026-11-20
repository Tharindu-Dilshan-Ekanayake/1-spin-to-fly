import { CylinderGeometry, SphereGeometry } from 'three'

import { LAUNCH_POSTS, LAUNCH_STAND, ROLL_ARCH, ROLL_ZONE, SPIN_BAR } from '@shared/world'

import { STYLE } from '../materials'
import { venueOf } from '../sceneStyle'

/** The LAUNCH PAD strip: the one gameplay yellow, the same in every world. */
const STRIP = '#ffd21f'
/** The spin bar's posts and steel. */
const POST = '#23262f'
const STEEL = '#dfe6ef'
const SPARK = '#4fd8ff'

const DISC = new CylinderGeometry(1, 1, 1, 28)
/** The bar itself: a long thin steel tube (one shared geometry, laid along X). */
const TUBE = new CylinderGeometry(1, 1, 1, 12)
const BALL = new SphereGeometry(1, 16, 12)

/** Height of the arch's beam, and the sign hung on its face. */
const ARCH_TOP = 11
export const ARCH_SIGN = { width: 12, height: 3, y: ARCH_TOP - 1.6, faceZ: ROLL_ARCH.z + 1.05 }

/** A lightning bolt in three slanted bars, on the arch's face at (x, y). */
function addBolt(blocks, x, y, z, flip, color) {
  blocks.add(x + 0.35 * flip, y + 0.75, z, 0.7, 0.2, 0.18, color, STYLE.GLOW, 0, 0, 0.9 * flip)
  blocks.add(x, y, z, 1.4, 0.2, 0.18, color, STYLE.GLOW, 0, 0, 0)
  blocks.add(x - 0.35 * flip, y - 0.75, z, 0.7, 0.2, 0.18, color, STYLE.GLOW, 0, 0, 0.9 * flip)
}

/**
 * The start of the runway: the yellow LAUNCH PAD across its mouth (painted with its name,
 * see signs.js) with navy chevrons pointing down the runway, a glowing pad at each end,
 * and a big yellow-and-navy start arch over it with a SPIN & FLY sign between lightning
 * bolts, crowned by a giant spin bar - in the venue's colours (turquoise and teal with
 * coral at Shipwreck Cove); the strip itself is the same yellow everywhere. In the middle
 * of the pad stands the SPIN BAR you grab (LAUNCH_POSTS, SPIN_BAR): two tall towers and a
 * steel bar, a glowing ring on the spot under it, rainbow chevrons leading up to it.
 *
 * Boxes go into the world's block set and the round parts into its props, so the whole
 * thing rides in those two draw calls. `detail` (off on LOW) adds the bulbs.
 *
 * No two faces here share a plane: every layer stands a clear step proud of what it
 * sits on (flush faces flicker, worst on phones' coarser depth buffers).
 */
export function buildRollZone(blocks, props, { detail = true, world = 0 } = {}) {
  const c = venueOf(world).arch
  const { minX, maxX, minZ, maxZ } = ROLL_ZONE
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const w = maxX - minX
  const d = maxZ - minZ

  // The strip: a navy border with the yellow fill raised on it, running right up to the
  // field's edge.
  blocks.addOn(cx, 0, cz + 0.3, w + 1.2, 0.05, d + 0.6, c.base)
  blocks.addOn(cx, 0.05, cz + 0.3, w, 0.05, d - 0.2, STRIP)
  // Chevrons on the strip, pointing down the runway.
  for (const x of [-9, 9]) {
    for (const side of [-1, 1]) {
      blocks.add(x + side * 0.7, 0.12, cz, 2.2, 0.04, 0.6, c.base, STYLE.SMOOTH, side * 0.75)
    }
  }
  // Glowing pads at both ends.
  for (const side of [-1, 1]) {
    const x = side * (w / 2 + 1.4)
    props.add(DISC, { position: [x, 0.08, cz + 0.3], scale: [2, 0.12, 2.6], color: '#ffffff' })
    props.add(DISC, { position: [x, 0.15, cz + 0.3], scale: [1.6, 0.06, 2.2], color: STRIP, style: STYLE.GLOW })
  }

  // The SPIN BAR: two tall dark block towers either side of the runway's middle, each
  // banded in glowing yellow, with a long polished steel bar between them at SPIN_BAR.y,
  // glowing caps where it meets them and blue spark rings that the whirl lights up.
  const barY = SPIN_BAR.y
  for (const side of [-1, 1]) {
    const x = LAUNCH_POSTS.x + side * LAUNCH_POSTS.halfGap
    const z = LAUNCH_POSTS.z
    blocks.addOn(x, 0.1, z, 1.3, 0.3, 1.3, c.base, STYLE.SMOOTH)
    blocks.addOn(x, 0.4, z, 0.9, barY + 0.7, 0.9, POST, STYLE.STUDS)
    blocks.addOn(x, barY - 0.55, z, 0.98, 0.32, 0.98, STRIP, STYLE.GLOW)
    blocks.addOn(x, 1.1, z, 0.98, 0.2, 0.98, STRIP, STYLE.GLOW)
    blocks.addOn(x, barY + 1.1, z, 1.1, 0.25, 1.1, c.crest, STYLE.SMOOTH)
    props.add(DISC, { position: [x - side * 0.5, barY, z], rotation: [0, 0, Math.PI / 2], scale: [0.2, 0.1, 0.2], color: '#ffffff', style: STYLE.GLOW })
    props.add(DISC, { position: [x - side * 0.85, barY, z], rotation: [0, 0, Math.PI / 2], scale: [0.16, 0.06, 0.16], color: SPARK, style: STYLE.GLOW })
  }
  props.add(TUBE, {
    position: [LAUNCH_POSTS.x, barY, LAUNCH_POSTS.z],
    rotation: [0, 0, Math.PI / 2],
    scale: [0.075, LAUNCH_POSTS.halfGap * 2 - 0.8, 0.075],
    color: STEEL,
    style: STYLE.SMOOTH,
  })
  // Where you stand to grab it: a glowing strip right under the bar, all along it - step
  // on it anywhere and you jump up and grab the bar there.
  const grabLength = SPIN_BAR.reach * 2 + 0.8
  blocks.addOn(LAUNCH_POSTS.x, 0.1, LAUNCH_STAND.z, grabLength + 0.4, 0.05, 1.9, '#ffffff', STYLE.SMOOTH)
  blocks.addOn(LAUNCH_POSTS.x, 0.15, LAUNCH_STAND.z, grabLength, 0.04, 1.5, SPARK, STYLE.GLOW)
  // Glowing chevrons leading up to it from the plaza, in three lanes across it.
  const CHEVRONS = ['#ff4a4a', '#ff9a1e', '#ffe23a', '#4be05a', '#2fd0ff', '#b05cff']
  for (const laneX of [-7, 0, 7]) {
    for (let i = 0; i < 3; i += 1) {
      const z = LAUNCH_STAND.z + 3 + i * 2.6
      for (const side of [-1, 1]) {
        blocks.add(laneX + side * 0.5, 0.15, z, 1.3, 0.06, 0.3, CHEVRONS[i % CHEVRONS.length], STYLE.GLOW, -side * 0.75)
      }
    }
  }

  // The start arch: striped pillars either side, a beam across the top carrying the
  // sign and a gold crest, and a glowing orb on each pillar.
  const archZ = ROLL_ARCH.z
  const span = ROLL_ARCH.x * 2
  for (const side of [-1, 1]) {
    const x = side * ROLL_ARCH.x
    blocks.addOn(x, 0, archZ, 2.2, 0.8, 2.2, c.base)
    blocks.addOn(x, 0.8, archZ, 1.6, ARCH_TOP - 0.8, 1.6, c.pillar, STYLE.STRIPES)
    blocks.addOn(x, ARCH_TOP + 1.3, archZ, 2.1, 2.1, 2.1, c.crest, STYLE.GLOW)
    if (detail) {
      for (let y = 1.8; y < ARCH_TOP - 0.6; y += 1.1) {
        blocks.add(x, y, archZ + 0.88, 0.3, 0.3, 0.16, Math.round(y) % 2 ? '#ffffff' : c.base, STYLE.GLOW)
      }
    }
  }
  blocks.addOn(0, ARCH_TOP - 0.2, archZ, span + 1, 1.5, 1.3, c.pillar, STYLE.STRIPES)
  blocks.addOn(0, ARCH_TOP - 0.45, archZ, span - 1.4, 0.25, 1.4, c.glow, STYLE.GLOW)
  blocks.addOn(0, ARCH_TOP + 1.3, archZ, span - 4, 0.3, 1, c.base, STYLE.SMOOTH)
  // The sign: a gold-framed navy panel, lettering painted on (signs.js), a lightning bolt
  // either side.
  blocks.addOn(0, ARCH_SIGN.y - ARCH_SIGN.height / 2 - 0.15, archZ + 0.75, ARCH_SIGN.width + 0.6, ARCH_SIGN.height + 0.3, 0.3, c.crest)
  blocks.addOn(0, ARCH_SIGN.y - ARCH_SIGN.height / 2, archZ + 0.8, ARCH_SIGN.width, ARCH_SIGN.height, 0.3, c.base, STYLE.SMOOTH)
  for (const side of [-1, 1]) addBolt(blocks, side * (ARCH_SIGN.width / 2 + 2.1), ARCH_SIGN.y - ARCH_SIGN.height / 2, archZ + 0.78, side, c.crest)
  if (detail) {
    for (let x = -ROLL_ARCH.x + 1.5; x <= ROLL_ARCH.x - 1.49; x += 1) {
      if (Math.abs(x) < ARCH_SIGN.width / 2 + 0.7) continue
      blocks.add(x, ARCH_TOP + 0.95, archZ + 0.73, 0.3, 0.3, 0.16, Math.round(x) % 2 ? c.crest : '#ffffff', STYLE.GLOW)
      blocks.add(x + 0.5, ARCH_TOP + 0.15, archZ + 0.73, 0.3, 0.3, 0.16, Math.round(x) % 2 ? '#ffffff' : c.crest, STYLE.GLOW)
    }
  }

  // The crown: a giant spin bar on the beam - two posts and a steel bar - in front of a
  // glowing gold ring, a white star flung off its top.
  const baseY = ARCH_TOP + 1.4
  for (const side of [-1, 1]) blocks.addOn(side * 2.4, baseY, archZ, 0.9, 4.2, 0.9, POST, STYLE.SMOOTH)
  props.add(TUBE, { position: [0, baseY + 3.6, archZ + 0.2], rotation: [0, 0, Math.PI / 2], scale: [0.22, 5, 0.22], color: STEEL, style: STYLE.SMOOTH })
  props.add(DISC, { position: [0, baseY + 3.6, archZ - 0.6], rotation: [Math.PI / 2, 0, 0], scale: [3.4, 0.3, 3.4], color: c.crest, style: STYLE.GLOW })
  props.add(BALL, { position: [1.8, baseY + 6.4, archZ + 0.3], scale: [0.7, 0.7, 0.7], color: '#ffffff', style: STYLE.GLOW })
}
