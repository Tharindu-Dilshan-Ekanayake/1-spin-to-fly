import { ConeGeometry, CylinderGeometry, SphereGeometry } from 'three'

import { PLAZA, ROLL_ARCH } from '@shared/world'

import { STYLE } from '../materials'
import { SCOREBOARD } from './terrain'

/**
 * World 1's lobby as an ancient royal palace (venue `palace`):
 *   - the palace itself across the south end, behind the leaderboards: a broad flight of
 *     steps, a colonnade of white columns with gold capitals under a frieze and a stepped
 *     pediment, the great hall behind with its doors and tall windows, a wing either side
 *     with banners and a round tower at its end, and the central keep rising over it all
 *     with the royal board (the game's name: lobbyLabels' scoreboard label) on its face,
 *     turrets on its corners and a golden dome on a drum, a spire and a flag on top;
 *   - a crenellated curtain wall round the courtyard, with round towers at its corners
 *     and halfway along each side, and two tall gate towers flanking the runway's mouth.
 *
 * Boxes go in the world's block set (cut stone: STYLE.STONE), round parts in its props:
 * no draw calls of their own and nothing per frame. Everything stands outside the plaza
 * (the walls in the strip between it and the cliffs, the palace beyond its south edge, in
 * a bay the cliffs leave open: sceneStyle VENUES hills.clear). `detail` (off on LOW) drops the merlons on the walls,
 * the banners and the smaller trims.
 */

const STONE_LIGHT = '#f2e8cf'
const STONE = '#e6d6b4'
const STONE_DARK = '#cdb88e'
const MARBLE = '#fbf7ec'
const GOLD = '#f2c230'
const GOLD_GLOW = '#ffd95a'
const ROOF = '#b3262f'
const ROYAL = '#8f1426'
const ROYAL_DARK = '#5e0c18'
const GLASS = '#1f2c62'
const WOOD = '#5a2a14'

const CYL = new CylinderGeometry(1, 1, 1, 16)
const CONE = new ConeGeometry(1, 1, 16)
const DOME = new SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2)
const BALL = new SphereGeometry(1, 12, 8)

/** The palace's front (its lowest step's leading edge) and the floor its rooms stand on. */
const FRONT_Z = PLAZA.maxZ + 2.2
const FLOOR = 1.05

/** A flag on a pole from (x, y, z), flying east. */
function addFlag(blocks, x, y, z, color = ROYAL) {
  blocks.addOn(x, y, z, 0.16, 4.2, 0.16, GOLD, STYLE.SMOOTH)
  blocks.addOn(x + 1.25, y + 2.7, z, 2.3, 1.4, 0.08, color, STYLE.SMOOTH)
  blocks.addOn(x + 1.25, y + 3.1, z, 2.3, 0.16, 0.1, GOLD, STYLE.SMOOTH)
}

/**
 * A round tower at (x, z): a stone drum `height` tall of radius `r`, a gold band and a
 * ring of merlons round its top, a red cone roof with a gold finial and a flag.
 */
function addTower(blocks, props, x, z, r, height, { merlons = true, flag = true } = {}) {
  props.add(CYL, { position: [x, height / 2, z], scale: [r, height, r], color: STONE, style: STYLE.STONE })
  props.add(CYL, { position: [x, height + 0.2, z], scale: [r + 0.35, 0.4, r + 0.35], color: STONE_DARK, style: STYLE.STONE })
  props.add(CYL, { position: [x, height * 0.62, z], scale: [r + 0.06, 0.35, r + 0.06], color: GOLD })
  if (merlons) {
    const n = Math.max(6, Math.round(r * 2.6))
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2
      blocks.add(x + Math.cos(a) * (r + 0.1), height + 0.95, z + Math.sin(a) * (r + 0.1), 0.6, 1.1, 0.9, STONE, STYLE.STONE, -a)
    }
  }
  const roof = r * 1.9
  props.add(CONE, { position: [x, height + 0.4 + roof / 2, z], scale: [r * 0.95, roof, r * 0.95], color: ROOF })
  props.add(BALL, { position: [x, height + 0.6 + roof, z], scale: 0.38, color: GOLD })
  if (flag) addFlag(blocks, x, height + 0.8 + roof, z)
}

/**
 * A straight run of curtain wall from (x0, z0) to (x1, z1) (along X or Z), `height` tall:
 * a stone wall with a darker plinth and coping, merlons along the top when `detail`.
 */
function addWall(blocks, x0, z0, x1, z1, { height = 5, detail = true } = {}) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
  const length = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0)
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const sx = (l, t) => (alongX ? l : t)
  const sz = (l, t) => (alongX ? t : l)
  blocks.addOn(cx, 0, cz, sx(length, 2.2), 0.8, sz(length, 2.2), STONE_DARK, STYLE.STONE)
  blocks.addOn(cx, 0.8, cz, sx(length, 1.7), height - 0.8, sz(length, 1.7), STONE, STYLE.STONE)
  blocks.addOn(cx, height, cz, sx(length + 0.2, 2.0), 0.3, sz(length + 0.2, 2.0), STONE_DARK, STYLE.STONE)
  if (!detail) return
  for (let s = 1; s < length - 0.5; s += 2.2) {
    const x = alongX ? Math.min(x0, x1) + s : cx
    const z = alongX ? cz : Math.min(z0, z1) + s
    blocks.addOn(x, height + 0.3, z, sx(1.1, 1.8), 1.1, sz(1.1, 1.8), STONE_LIGHT, STYLE.STONE)
  }
}

/** A row of tall windows on a face at z (facing north), centred at each x. */
function addWindows(blocks, xs, base, z, h = 5) {
  for (const x of xs) {
    blocks.addOn(x, base - 0.25, z - 0.06, 2.6, h + 0.75, 0.2, GOLD, STYLE.SMOOTH)
    blocks.addOn(x, base, z - 0.14, 2, h, 0.2, GLASS, STYLE.WINDOWS)
    blocks.addOn(x, base + h + 0.5, z - 0.12, 1.2, 0.5, 0.2, GOLD_GLOW, STYLE.GLOW)
  }
}

/** A royal banner hanging on a north face at (x, top, z): red cloth, gold trim, a crest. */
function addBanner(blocks, x, top, z, length = 6) {
  blocks.addOn(x, top - 0.2, z - 0.1, 2.4, 0.2, 0.2, GOLD, STYLE.SMOOTH)
  blocks.addOn(x, top - length, z - 0.15, 1.9, length - 0.2, 0.1, ROYAL, STYLE.SMOOTH)
  blocks.addOn(x, top - length, z - 0.2, 1.9, 0.35, 0.1, GOLD, STYLE.SMOOTH)
  blocks.add(x, top - length * 0.4, z - 0.22, 0.8, 0.8, 0.08, GOLD_GLOW, STYLE.GLOW, 0, 0, Math.PI / 4)
}

function buildPalace(blocks, props, { detail }) {
  const z0 = FRONT_Z
  // The steps up from the courtyard, and the podium the whole palace stands on.
  for (let i = 0; i < 3; i += 1) blocks.addOn(0, i * 0.35, z0 + i * 0.8 + 0.4, 56 - i * 2, 0.35, 0.8 + (2 - i) * 0.02, i % 2 ? STONE : STONE_LIGHT, STYLE.STONE)
  blocks.addOn(0, 0, z0 + 13.2, 80, FLOOR, 21, STONE_DARK, STYLE.STONE)

  // The great hall.
  const hallZ0 = z0 + 4.6
  const hallZ1 = z0 + 20
  blocks.addOn(0, FLOOR, (hallZ0 + hallZ1) / 2, 46, 13, hallZ1 - hallZ0, STONE_LIGHT, STYLE.STONE)
  blocks.addOn(0, FLOOR + 13, (hallZ0 + hallZ1) / 2, 47.4, 0.6, hallZ1 - hallZ0 + 1.4, STONE_DARK, STYLE.STONE)
  blocks.addOn(0, FLOOR + 13.6, (hallZ0 + hallZ1) / 2, 44, 1.2, hallZ1 - hallZ0 - 1, ROOF, STYLE.STRIPES)
  // Its doors: tall dark wood in a gold frame under a glowing lintel, and the windows.
  blocks.addOn(0, FLOOR, hallZ0 - 0.08, 7.4, 9.4, 0.2, GOLD, STYLE.SMOOTH)
  blocks.addOn(0, FLOOR, hallZ0 - 0.16, 6.2, 8.6, 0.2, WOOD, STYLE.STRIPES)
  blocks.addOn(0, FLOOR + 4.1, hallZ0 - 0.26, 0.16, 0.8, 0.2, GOLD_GLOW, STYLE.GLOW)
  blocks.addOn(0, FLOOR + 9.6, hallZ0 - 0.14, 8.2, 0.6, 0.3, GOLD_GLOW, STYLE.GLOW)
  addWindows(blocks, [-17, -11, 11, 17], FLOOR + 2.2, hallZ0, 6)

  // The colonnade before it: white marble columns on stone bases with gold capitals.
  const colZ = z0 + 2.7
  for (let x = -20; x <= 20.01; x += 4) {
    blocks.addOn(x, FLOOR, colZ, 1.6, 0.5, 1.6, STONE_DARK, STYLE.STONE)
    props.add(CYL, { position: [x, FLOOR + 0.5 + 4.9, colZ], scale: [0.55, 9.8, 0.55], color: MARBLE })
    props.add(CYL, { position: [x, FLOOR + 0.75, colZ], scale: [0.7, 0.3, 0.7], color: GOLD })
    blocks.addOn(x, FLOOR + 10.3, colZ, 1.7, 0.6, 1.7, GOLD, STYLE.SMOOTH)
  }
  // The frieze over the columns, a glowing gold band along it, and the stepped pediment.
  const top = FLOOR + 10.9
  blocks.addOn(0, top, (colZ + hallZ0) / 2 - 0.2, 46, 1.6, hallZ0 - colZ + 2.6, STONE_LIGHT, STYLE.STONE)
  blocks.addOn(0, top + 0.6, colZ - 1.12, 44, 0.35, 0.1, GOLD_GLOW, STYLE.GLOW)
  const steps = [30, 22, 14, 6]
  steps.forEach((w, i) => {
    const y = top + 1.6 + i * 1.1
    blocks.addOn(0, y, colZ + 0.6, w, 1.1, 2.6, i === steps.length - 1 ? GOLD : STONE_LIGHT, STYLE.STONE)
    blocks.addOn(0, y + 0.2, colZ - 0.72, w - 1.4, 0.7, 0.1, ROYAL, STYLE.SMOOTH)
  })
  props.add(BALL, { position: [0, top + 1.6 + steps.length * 1.1 + 0.6, colZ + 0.6], scale: 0.6, color: GOLD })

  // The two wings, each with banners and windows, and a round tower at its end.
  for (const side of [-1, 1]) {
    const cx = side * 30.5
    const wz0 = z0 + 6.6
    const wz1 = z0 + 19
    blocks.addOn(cx, FLOOR, (wz0 + wz1) / 2, 15, 10, wz1 - wz0, STONE, STYLE.STONE)
    blocks.addOn(cx, FLOOR + 10, (wz0 + wz1) / 2, 16.2, 0.5, wz1 - wz0 + 1.2, STONE_DARK, STYLE.STONE)
    blocks.addOn(cx, FLOOR + 10.5, (wz0 + wz1) / 2, 14, 1, wz1 - wz0 - 1, ROOF, STYLE.STRIPES)
    addWindows(blocks, [cx - 3.6, cx + 3.6], FLOOR + 2, wz0, 5)
    if (detail) {
      addBanner(blocks, cx - 6.4, FLOOR + 9.6, wz0, 6.5)
      addBanner(blocks, cx + 6.4, FLOOR + 9.6, wz0, 6.5)
      addBanner(blocks, cx, FLOOR + 9.6, wz0, 2.4)
    }
    addTower(blocks, props, side * 39.5, z0 + 8, 3.4, 20)
  }

  // The keep: a tall stone tower behind the hall with the royal board on its face (the
  // scoreboard label floats just in front of it), turrets on its corners, and the dome.
  const { x: bx, z: bz, y: by, width, height } = SCOREBOARD
  const keepZ0 = bz + 0.6
  const keepZ1 = keepZ0 + 10
  const keepTop = by + height + 3.6
  blocks.addOn(0, FLOOR, (keepZ0 + keepZ1) / 2, width + 4, keepTop - FLOOR, keepZ1 - keepZ0, STONE_LIGHT, STYLE.STONE)
  blocks.addOn(0, keepTop, (keepZ0 + keepZ1) / 2, width + 5, 0.5, keepZ1 - keepZ0 + 1, STONE_DARK, STYLE.STONE)
  // The board: a gold frame round deep royal red, gold studs along its top.
  blocks.addOn(bx, by - 0.4, keepZ0 - 0.15, width + 1.6, height + 2, 0.3, GOLD, STYLE.SMOOTH)
  blocks.addOn(bx, by + 0.3, keepZ0 - 0.35, width, height + 0.6, 0.3, ROYAL_DARK, STYLE.SMOOTH)
  blocks.addOn(bx, by + 0.6, keepZ0 - 0.55, width - 0.8, 0.25, 0.1, GOLD_GLOW, STYLE.GLOW)
  blocks.addOn(bx, by + height + 0.2, keepZ0 - 0.55, width - 0.8, 0.25, 0.1, GOLD_GLOW, STYLE.GLOW)
  // Windows down the keep either side of the board, and its merlons.
  for (const side of [-1, 1]) {
    for (let y = FLOOR + 15; y < by - 2; y += 4) blocks.addOn(side * 6, y, keepZ0 - 0.12, 1.6, 2.6, 0.2, GLASS, STYLE.WINDOWS)
  }
  for (let x = -width / 2 - 1.5; x <= width / 2 + 1.51; x += 2.5) {
    blocks.addOn(x, keepTop + 0.5, keepZ0 - 0.2, 1.2, 1.3, 0.9, STONE, STYLE.STONE)
  }
  for (const sx of [-1, 1]) {
    for (const z of [keepZ0, keepZ1]) addTower(blocks, props, sx * (width / 2 + 2), z, 1.7, keepTop + 3.5, { merlons: false, flag: false })
  }
  // The drum and the golden dome, a spire and the royal flag.
  const dz = (keepZ0 + keepZ1) / 2
  props.add(CYL, { position: [0, keepTop + 0.5 + 2, dz], scale: [7, 4, 7], color: STONE_LIGHT, style: STYLE.STONE })
  props.add(CYL, { position: [0, keepTop + 0.5 + 4.2, dz], scale: [7.4, 0.5, 7.4], color: GOLD })
  props.add(DOME, { position: [0, keepTop + 4.9, dz], scale: [6.6, 7.4, 6.6], color: GOLD })
  props.add(CONE, { position: [0, keepTop + 4.9 + 7.4 + 2, dz], scale: [0.9, 4.6, 0.9], color: GOLD })
  props.add(BALL, { position: [0, keepTop + 4.9 + 7.4 + 4.5, dz], scale: 0.55, color: GOLD_GLOW, style: STYLE.GLOW })
  addFlag(blocks, 0, keepTop + 4.9 + 7.4 + 4.8, dz)
}

/** The curtain wall round the courtyard, its towers, and the gate towers at the runway. */
function buildWalls(blocks, props, { detail }) {
  // The walls stand in the strip between the courtyard's edge and the cliffs (the north
  // ones over the rims either side of the runway's mouth), and the towers just outside
  // it, so nothing round stands where anyone can walk.
  const w = PLAZA.minX - 2
  const e = PLAZA.maxX + 2
  const n = PLAZA.minZ - 0.3
  const s = PLAZA.maxZ + 2.4
  const gate = ROLL_ARCH.x + 5
  const palaceHalf = 43
  addWall(blocks, w, n, w, s, { detail })
  addWall(blocks, e, n, e, s, { detail })
  addWall(blocks, w, s, -palaceHalf, s, { detail })
  addWall(blocks, palaceHalf, s, e, s, { detail })
  addWall(blocks, w, n, -gate, n, { detail })
  addWall(blocks, gate, n, e, n, { detail })
  const r = 3
  const corners = [
    [PLAZA.minX - r - 0.2, PLAZA.minZ - r - 0.2],
    [PLAZA.maxX + r + 0.2, PLAZA.minZ - r - 0.2],
    [PLAZA.minX - r - 0.2, s + 0.6],
    [PLAZA.maxX + r + 0.2, s + 0.6],
  ]
  for (const [x, z] of corners) addTower(blocks, props, x, z, r, 10, { flag: detail })
  for (const x of [PLAZA.minX - 2.6, PLAZA.maxX + 2.6]) addTower(blocks, props, x, (PLAZA.minZ + PLAZA.maxZ) / 2, 2.4, 8.5, { flag: false })
  // The gate towers, tall either side of the runway's mouth.
  for (const side of [-1, 1]) addTower(blocks, props, side * gate, PLAZA.minZ - 3.6, 3.4, 15)
}

/** Builds World 1's royal palace into `blocks` and `props`. */
export function buildRoyalPalace(blocks, props, { density = 1 } = {}) {
  const detail = density >= 0.5
  buildPalace(blocks, props, { detail })
  buildWalls(blocks, props, { detail })
}
