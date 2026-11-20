import { hash2 } from '@shared/rng'
import { CANYON_HALF_WIDTH, PLAZA } from '@shared/world'

import { STYLE } from '../materials'
import { SCOREBOARD } from './terrain'

/**
 * The valley walls round the lobby: blocky cliffs in the venue's style (Green Valley:
 * STYLE.HILL, checkered dirt under a grass cap; Shipwreck Cove: sandstone mesas) - one
 * box per column on a 4 m grid, stepping up in
 * terraces the further they stand from the plaza: low ledges just past its edge, cliffs
 * 36 m high further out, each terrace a colour further along the venue's rock ramp
 * (peach, coral, pink, lilac, periwinkle in the Candy Canyon; sandstone at Palm Beach).
 * The runway's mouth is left open to the north (Lane.jsx carries the mesas on down it).
 * Now and then something grows on a terrace: lollipops and gumdrops in the Candy Canyon,
 * palms at Palm Beach.
 *
 * Everything goes into the world's block set: no draw calls of its own, nothing to do per
 * frame. `density` (the preset's decorDensity) thins the decor and, on LOW, coarsens the
 * grid to 8 m columns (a quarter of the boxes).
 */

/** The open ground the mesas keep clear of: the plaza and everything round its edge. */
const OPEN = { minX: PLAZA.minX - 4, maxX: PLAZA.maxX + 4, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ + 4 }
/** The runway's valley floor, north of the plaza, left open for it. */
const VALLEY_HALF = CANYON_HALF_WIDTH + 6
/** How far out the mesas go, from the middle. */
const REACH = { x: 116, south: PLAZA.maxZ + 112, north: -104 }

const CANDY = ['#ff5fa8', '#ffd21f', '#4be0c0', '#b05cff', '#ff8a3a', '#5fb8ff']
/** Green Valley's trees: leaves (now and then blossom), trunks, flowers. */
const MEADOW = { leaves: ['#3fbf47', '#4fd055', '#2fa83e'], blossom: ['#ff8fc8', '#ffb347'], trunk: '#7a4a24', flowers: ['#ff5f8a', '#ffd21f', '#ffffff', '#b05cff'] }
const PALM = { trunk: '#b4884f', leaves: ['#3fbf5a', '#54d36a'] }
/** The palace gardens on the terraces: cypresses, clipped topiary, urns of flowers. */
const GARDEN = { dark: ['#1f7a3a', '#26893f'], hedge: ['#3aa84a', '#46b955'], urn: '#e8d8b6', flowers: ['#ff4f7a', '#ffd21f', '#ffffff', '#b05cff'] }

/** Metres from (x, z) to the nearest open ground (the plaza, or the runway's valley). */
function openDistance(x, z) {
  const dx = Math.max(OPEN.minX - x, 0, x - OPEN.maxX)
  const dz = Math.max(OPEN.minZ - z, 0, z - OPEN.maxZ)
  const plaza = Math.hypot(dx, dz)
  const valley = z < OPEN.minZ ? Math.max(0, Math.abs(x) - VALLEY_HALF) : Infinity
  return Math.min(plaza, valley)
}

/** Under the scoreboard on the south mesas: kept below its screen. */
const underScoreboard = (x, z) =>
  Math.abs(x - SCOREBOARD.x) < SCOREBOARD.width / 2 + 3 && Math.abs(z - SCOREBOARD.z) < 4

/**
 * Something growing on a terrace at (x, top, z): a giant lollipop (a white stick, a candy
 * disc striped white, turned to face a random way), a stack of gumdrops, or a palm.
 */
function addDecor(blocks, x, top, z, k, kind) {
  if (kind === 'meadow') {
    const r = hash2(k, 31)
    if (r < 0.6) {
      // A round leafy tree: a trunk, a big leaf block and a smaller one on top.
      const h = 2.4 + hash2(k, 32) * 1.6
      const leaf = hash2(k, 35) > 0.85 ? MEADOW.blossom[Math.floor(hash2(k, 36) * 2)] : MEADOW.leaves[Math.floor(hash2(k, 37) * 3)]
      blocks.addOn(x, top, z, 0.8, h, 0.8, MEADOW.trunk, STYLE.SMOOTH)
      blocks.addOn(x, top + h, z, 3.4, 2.4, 3.4, leaf, STYLE.STUDS)
      blocks.addOn(x, top + h + 2.4, z, 2.2, 1.4, 2.2, leaf, STYLE.STUDS)
    } else if (r < 0.85) {
      // A bush.
      blocks.addOn(x, top, z, 2.4, 1.4, 2.0, MEADOW.leaves[Math.floor(hash2(k, 37) * 3)], STYLE.STUDS)
    } else {
      // A patch of flowers: little coloured blocks on stems.
      for (let i = 0; i < 4; i += 1) {
        const fx = x + (hash2(k, 40 + i) - 0.5) * 2.4
        const fz = z + (hash2(k, 50 + i) - 0.5) * 2.4
        blocks.addOn(fx, top, fz, 0.12, 0.6, 0.12, '#2fa83e', STYLE.SMOOTH)
        blocks.addOn(fx, top + 0.6, fz, 0.4, 0.3, 0.4, MEADOW.flowers[(k + i) % MEADOW.flowers.length], STYLE.SMOOTH)
      }
    }
    return
  }
  if (kind === 'garden') {
    const r = hash2(k, 31)
    if (r < 0.5) {
      // A cypress: tall, narrow and dark, tapering to a point.
      const h = 4.5 + hash2(k, 32) * 2.5
      const leaf = GARDEN.dark[Math.floor(hash2(k, 37) * 2)]
      blocks.addOn(x, top, z, 0.4, 0.6, 0.4, MEADOW.trunk, STYLE.SMOOTH)
      blocks.addOn(x, top + 0.6, z, 1.5, h * 0.55, 1.5, leaf, STYLE.STUDS)
      blocks.addOn(x, top + 0.6 + h * 0.55, z, 1.0, h * 0.3, 1.0, leaf, STYLE.STUDS)
      blocks.addOn(x, top + 0.6 + h * 0.85, z, 0.5, h * 0.15, 0.5, leaf, STYLE.STUDS)
    } else if (r < 0.8) {
      // Clipped topiary: a hedge cube with a smaller tier on top.
      const leaf = GARDEN.hedge[Math.floor(hash2(k, 37) * 2)]
      blocks.addOn(x, top, z, 2.2, 1.6, 2.2, leaf, STYLE.STUDS)
      blocks.addOn(x, top + 1.6, z, 1.3, 1.1, 1.3, leaf, STYLE.STUDS)
    } else {
      // A stone urn spilling flowers.
      blocks.addOn(x, top, z, 0.9, 0.4, 0.9, GARDEN.urn, STYLE.SMOOTH)
      blocks.addOn(x, top + 0.4, z, 1.3, 0.8, 1.3, GARDEN.urn, STYLE.SMOOTH)
      blocks.addOn(x, top + 1.2, z, 1.1, 0.5, 1.1, GARDEN.flowers[k % GARDEN.flowers.length], STYLE.STUDS)
    }
    return
  }
  if (kind === 'palm') {
    const h = 4 + hash2(k, 32) * 2.5
    blocks.addOn(x, top, z, 0.7, h, 0.7, PALM.trunk, STYLE.STRIPES)
    blocks.addOn(x, top + h, z, 4.2, 0.6, 1.2, PALM.leaves[0], STYLE.STUDS)
    blocks.addOn(x, top + h + 0.1, z, 1.2, 0.6, 4.2, PALM.leaves[1], STYLE.STUDS)
    return
  }
  const color = CANDY[Math.floor(hash2(k, 35) * CANDY.length)]
  if (hash2(k, 31) < 0.55) {
    const h = 3.6 + hash2(k, 32) * 2.4
    blocks.addOn(x, top, z, 0.35, h, 0.35, '#ffffff', STYLE.SMOOTH)
    blocks.add(x, top + h + 1.4, z, 3, 3, 0.7, color, STYLE.STRIPES, 0, hash2(k, 36) * Math.PI, Math.PI / 4)
  } else {
    blocks.addOn(x, top, z, 3.2, 1.6, 3.2, color, STYLE.STUDS)
    blocks.addOn(x, top + 1.6, z, 2.2, 1.2, 2.2, CANDY[(CANDY.indexOf(color) + 2) % CANDY.length], STYLE.STUDS)
    blocks.addOn(x, top + 2.8, z, 1.1, 0.8, 1.1, '#ffffff', STYLE.STUDS)
  }
}

/**
 * Builds the mesas into `blocks` in `venue`'s colours (sceneStyle VENUES: `hills`).
 * Returns how many columns and decor pieces went in (for tests/debug).
 */
export function buildHills(blocks, { density = 1, venue } = {}) {
  const look = venue?.hills ?? { rock: ['#ffa27e', '#ff8aa8', '#f08ad8', '#c08cff', '#94a2ff'], trees: 'candy' }
  const cell = density < 0.5 ? 8 : 4
  const decorChance = density >= 0.75 ? 0.07 : density >= 0.5 ? 0.05 : 0.035
  let columns = 0
  let trees = 0
  for (let gx = -REACH.x; gx < REACH.x; gx += cell) {
    for (let gz = REACH.north; gz < REACH.south; gz += cell) {
      const x = gx + cell / 2
      const z = gz + cell / 2
      const d = openDistance(x, z)
      if (d < 2) continue
      // A bay the venue keeps open (Shipwreck Cove's wreck lies in it).
      if (look.clear?.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)) continue
      // Terraces 4 m apart in height, every ~9 m out, with a little noise so the edges
      // wander; never higher than 36 m.
      const k = Math.floor(gx / 4) * 977 + Math.floor(gz / 4)
      const n = hash2(Math.floor(gx / 8), Math.floor(gz / 8))
      const step = Math.min(9, 1 + Math.floor(d / 9 + n * 1.3))
      let h = 4 * step
      if (underScoreboard(x, z)) h = Math.min(h, 20)
      const rock = look.rock[Math.min(look.rock.length - 1, Math.floor((step - 1) / 2))]
      blocks.addOn(x, 0, z, cell, h, cell, rock, look.cap ?? STYLE.MESA)
      columns += 1
      // Decor now and then on a terrace near enough to be seen.
      if (d < 70 && hash2(k, 30) < decorChance * (cell / 4) ** 2) {
        addDecor(blocks, x + (hash2(k, 33) - 0.5) * (cell - 3.4), h, z + (hash2(k, 34) - 0.5) * (cell - 3.4), k, look.trees)
        trees += 1
      }
    }
  }
  return { columns, trees }
}
