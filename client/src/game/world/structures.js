import { CylinderGeometry, Matrix4 } from 'three'

import {
  BENCH_HALF,
  PAD_COUNT,
  PAD_HEIGHT,
  PAD_RADIUS,
  PAD_YAW,
  padCenterX,
  padCenterZ,
  SHOP_SIGN,
  SHOP_SIGN_FACING,
  SHOP_STAGES,
} from '@shared/world'

import { STYLE } from '../materials'
import { venueOf } from '../sceneStyle'

/**
 * Static lobby structures, added to the world's shared BlockSet and prop builder so they
 * render in the same few draw calls as the grandstands.
 */

/**
 * Per-bar look, in pad order (matches PADS in shared/balance.js): the mat's base, top,
 * glowing ring and centre emblem, the bar frame's posts and its rubber grips, the gym
 * floor beyond it, and the colour of its labels. `beach` ones (Palm Beach's surf bars)
 * have surfboard posts and a surfboard and palm on top of their board.
 */
export const PAD_THEMES = [
  { base: '#1f5fc8', top: '#3f9cff', ring: '#9fe8ff', emblem: '#ffffff', rail: '#1d5fd6', court: '#2c4fa8', screen: '#5fd6ff', text: '#5fd6ff' },
  { base: '#b8222e', top: '#ff3b3b', ring: '#ffd21f', emblem: '#1d1f22', rail: '#c8323c', court: '#a8323c', screen: '#ffd21f', text: '#ff7a6a' },
  { base: '#d64a9a', top: '#ff8fd0', ring: '#ffffff', emblem: '#ffd23f', rail: '#d63f8f', court: '#b8467e', screen: '#ffffff', text: '#ff9cd6' },
  { base: '#1d3f8a', top: '#2f6fe0', ring: '#7fe2ff', emblem: '#ffd21f', rail: '#173b8f', court: '#26408a', screen: '#7fe2ff', text: '#7fb8ff' },
  { base: '#5a2a9a', top: '#8a4cff', ring: '#ff7ad9', emblem: '#ffffff', rail: '#6a2fd0', court: '#4a2a8a', screen: '#ff7ad9', text: '#c69bff' },
  { base: '#1a8ab8', top: '#7ff0ff', ring: '#ffffff', emblem: '#9b6bff', rail: '#14a3c9', court: '#1f7aa8', screen: '#ffffff', text: '#9fe8ff', style: STYLE.GLOW },
  { base: '#1b2266', top: '#2a1450', ring: '#c35cff', emblem: '#ffd21f', rail: '#2a1450', court: '#1b1f5c', screen: '#ffd21f', text: '#d39bff', style: STYLE.GALAXY },
  // Palm Beach's beach bars: sand and surf, then a deep-sea wave.
  { base: '#e8c27a', top: '#ffe29a', ring: '#3fd8ff', emblem: '#ff7a3a', rail: '#2fb8e0', court: '#d9b46a', screen: '#3fd8ff', text: '#5fe6ff', beach: true },
  { base: '#0b4f8a', top: '#1a8fd8', ring: '#7ff6ff', emblem: '#ffffff', rail: '#0a6fb8', court: '#0b3f72', screen: '#7ff6ff', text: '#7ff6ff', style: STYLE.GLOW, beach: true },
]

const LEG = '#3a3f4a'
const STEEL = '#c9d2de'
const DISC = new CylinderGeometry(1, 1, 1, 24)
const CYL = new CylinderGeometry(1, 1, 1, 12)

/** How high the bench's seat is over the mat (the trainee's pose sits on it: playerPose.benchPress). */
export const SEAT_HEIGHT = 0.45

/** A dumbbell lying along Z at (x, y, z): a steel handle and a weight each end. */
function addDumbbell(props, x, y, z, color, size = 1) {
  props.add(CYL, { position: [x, y, z], rotation: [Math.PI / 2, 0, 0], scale: [0.05 * size, 0.7 * size, 0.05 * size], color: STEEL })
  for (const s of [-1, 1]) {
    props.add(DISC, { position: [x, y, z + s * 0.3 * size], rotation: [Math.PI / 2, 0, 0], scale: [0.2 * size, 0.12 * size, 0.2 * size], color })
  }
}

/**
 * The training station on the podium: a long padded weight bench across it in the pad's
 * colours, where several players sit side by side (each where they stood: world.js
 * benchSeat) pressing dumbbells overhead, with a dumbbell rack at each end. The bench is
 * scenery: you walk through it.
 */
function buildBench(blocks, props, px, z, theme) {
  const top = PAD_HEIGHT
  const seat = top + SEAT_HEIGHT
  const length = BENCH_HALF * 2 + 0.7
  // A long bench across the mat: steel legs every metre or so, a long padded seat, and a
  // low backrest behind (west) - low, so the camera behind you still sees you.
  for (const dz of [-1, -0.34, 0.34, 1]) blocks.addOn(px + 0.05, top, z + dz * (length / 2 - 0.3), 0.5, SEAT_HEIGHT - 0.14, 0.12, LEG, STYLE.SMOOTH)
  blocks.addOn(px + 0.05, top + 0.1, z, 0.16, 0.08, length - 0.4, STEEL, STYLE.SMOOTH)
  blocks.addOn(px + 0.05, seat - 0.14, z, 0.66, 0.14, length, theme.rail, STYLE.SMOOTH)
  blocks.addOn(px + 0.05, seat - 0.03, z, 0.56, 0.04, length - 0.1, theme.top, STYLE.SMOOTH)
  for (const dz of [-1, 1]) blocks.addOn(px - 0.38, top, z + dz * (length / 2 - 0.3), 0.1, SEAT_HEIGHT + 0.55, 0.1, LEG, STYLE.SMOOTH)
  blocks.addOn(px - 0.36, seat + 0.05, z, 0.14, 0.5, length - 0.2, theme.rail, STYLE.SMOOTH)
  blocks.addOn(px - 0.28, seat + 0.1, z, 0.03, 0.4, length - 0.4, theme.ring, STYLE.GLOW)
  // A dumbbell rack at each end of the bench: a stand with glowing trim, two dumbbells.
  for (const s of [-1, 1]) {
    const rz = z + s * (length / 2 + 0.35)
    blocks.addOn(px + 0.6, top, rz, 0.4, 0.55, 0.9, '#2a2f3a', STYLE.SMOOTH)
    blocks.addOn(px + 0.6, top + 0.55, rz, 0.46, 0.05, 0.96, theme.ring, STYLE.GLOW)
    addDumbbell(props, px + 0.6, top + 0.72, rz - 0.22, theme.top, 0.55)
    addDumbbell(props, px + 0.6, top + 0.72, rz + 0.22, '#2a2f3a', 0.55)
  }
}

/**
 * The stations are written facing east (yaw PI/2: +X ahead, the bench along Z); this turns
 * them about their pad's centre to face PAD_YAW. Blocks go through a proxy that moves each
 * box and adds the turn to its yaw; props through the builder's transform.
 */
const STATION_TURN = PAD_YAW - Math.PI / 2
const _turn = new Matrix4()
const _move = new Matrix4()

function turnedBlocks(blocks, cx, cz, turn) {
  const c = Math.cos(turn)
  const s = Math.sin(turn)
  const proxy = {
    add(x, y, z, sx, sy, sz, color, style, rotY = 0, rotX = 0, rotZ = 0) {
      const dx = x - cx
      const dz = z - cz
      blocks.add(cx + dx * c + dz * s, y, cz - dx * s + dz * c, sx, sy, sz, color, style, rotY + turn, rotX, rotZ)
      return proxy
    },
    addOn(x, base, z, sx, sy, sz, color, style, rotY = 0) {
      return proxy.add(x, base + sy / 2, z, sx, sy, sz, color, style, rotY)
    },
  }
  return proxy
}

function stationTransform(cx, cz, turn) {
  return _turn
    .makeTranslation(cx, 0, cz)
    .multiply(_move.makeRotationY(turn))
    .multiply(new Matrix4().makeTranslation(-cx, 0, -cz))
}

/** Half the podium's size: its deck is the walkable square of world.js padRect. */
const DECK_HALF = PAD_RADIUS + 0.3

/**
 * A training podium: a wide base in the pad's dark colour, a slab on it in its bright
 * colour with a glowing frame set in the top, and two glowing emblem discs either side of
 * where you sit. Boxes go in `blocks`, the discs in `props`: no draw calls of their own.
 */
function buildPodium(blocks, props, px, z, theme) {
  const size = DECK_HALF * 2
  const slab = size - 0.6
  blocks.addOn(px, 0, z, size, PAD_HEIGHT - 0.14, size, theme.base, STYLE.SMOOTH)
  blocks.addOn(px, PAD_HEIGHT - 0.14, z, slab, 0.14, slab, theme.top, theme.style ?? STYLE.STUDS)
  // The glowing frame: 3 cm proud of the slab, the strips meeting without overlapping.
  const inner = slab / 2 - 0.3
  for (const s of [-1, 1]) {
    blocks.addOn(px + s * inner, PAD_HEIGHT, z, 0.14, 0.03, inner * 2 + 0.14, theme.ring, STYLE.GLOW)
    blocks.addOn(px, PAD_HEIGHT, z + s * inner, inner * 2 - 0.14, 0.03, 0.14, theme.ring, STYLE.GLOW)
  }
  for (const s of [-1, 1]) {
    props.add(CYL, { position: [px - 1.9, PAD_HEIGHT + 0.03, z + s * 1.6], scale: [0.46, 0.04, 0.46], color: theme.emblem === '#1d1f22' ? '#ffffff' : theme.emblem })
    props.add(CYL, { position: [px - 1.9, PAD_HEIGHT + 0.08, z + s * 1.6], scale: [0.26, 0.04, 0.26], color: theme.ring, style: STYLE.GLOW })
  }
}

/**
 * The training spots: a square podium in the pad's colours with its weight bench on it.
 */
export function buildPads(world, props) {
  for (let i = 0; i < PAD_COUNT; i += 1) {
    const theme = PAD_THEMES[i]
    const px = padCenterX(i)
    const z = padCenterZ(i)
    const blocks = turnedBlocks(world, px, z, STATION_TURN)
    props.transform = stationTransform(px, z, STATION_TURN)
    buildPodium(blocks, props, px, z, theme)
    buildBench(blocks, props, px, z, theme)
    props.transform = null
  }
}

const WHITE = '#f4f7fb'

/**
 * The arm shop: two open display stages (the stands on them are TireShop's) and the big
 * ARM SHOP sign behind, built like the start arch - white decks on a yellow band with
 * gold light strips round the edges. `detail` (off on LOW) adds the sign's bulbs.
 *
 * No two faces here share a plane: every layer stands a clear step proud of what it
 * sits on.
 */
export function buildShop(blocks, { detail = true, world = 0 } = {}) {
  const { band: YELLOW, strip: PALE, post: GOLD, panel: NAVY } = venueOf(world).shop
  for (const s of SHOP_STAGES) {
    const w = s.maxX - s.minX
    const d = s.maxZ - s.minZ
    const cx = (s.minX + s.maxX) / 2
    const cz = (s.minZ + s.maxZ) / 2
    blocks.addOn(cx, -0.1, cz, w, s.height + 0.1, d, WHITE)
    blocks.addOn(cx, 0, cz, w + 0.3, s.height * 0.5, d + 0.3, YELLOW)
    // Light strips along all four top edges, and a gold post at each corner.
    for (const side of [-1, 1]) {
      blocks.addOn(cx + side * (w / 2 - 0.25), s.height, cz, 0.35, 0.08, d - 1.4, PALE, STYLE.GLOW)
      blocks.addOn(cx, s.height, cz + side * (d / 2 - 0.25), w - 1.4, 0.08, 0.35, PALE, STYLE.GLOW)
      for (const end of [-1, 1]) {
        blocks.addOn(cx + side * (w / 2 - 0.35), s.height, cz + end * (d / 2 - 0.35), 0.6, 0.7, 0.6, GOLD, STYLE.GLOW)
      }
    }
  }

  // The sign: two striped legs, a navy panel in a yellow frame, a gold cap, its face
  // turned to the plaza (`f`).
  const { x, minZ, maxZ, top } = SHOP_SIGN
  const f = SHOP_SIGN_FACING
  const length = maxZ - minZ
  const midZ = (minZ + maxZ) / 2
  const bottom = top - 8.2
  for (const z of [minZ + 1.5, maxZ - 1.5]) blocks.addOn(x - 0.1 * f, 0, z, 0.9, bottom + 0.3, 0.9, YELLOW, STYLE.STRIPES)
  blocks.addOn(x, bottom, midZ, 0.6, top - bottom, length, YELLOW)
  blocks.addOn(x + 0.1 * f, bottom + 0.5, midZ, 0.6, top - bottom - 1, length - 1, NAVY, STYLE.SMOOTH)
  blocks.addOn(x, top, midZ, 0.9, 0.4, length + 0.4, GOLD, STYLE.GLOW)
  if (detail) {
    for (let z = minZ + 1; z <= maxZ - 0.99; z += 1.5) {
      blocks.add(x + 0.42 * f, bottom + 0.25, z, 0.16, 0.3, 0.3, Math.round(z) % 2 ? '#ffffff' : GOLD, STYLE.GLOW)
      blocks.add(x + 0.42 * f, top - 0.25, z + 0.75, 0.16, 0.3, 0.3, Math.round(z) % 2 ? GOLD : '#ffffff', STYLE.GLOW)
    }
  }
}
