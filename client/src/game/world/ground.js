import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

import { PATH_HALF, PLAZA, PORTALS, SHOP, TRACK_START_Z } from '@shared/world'

import { venueOf } from '../sceneStyle'

/**
 * The plaza floor: one big plane whose colours come from a tiny "ground map" texture
 * painted at one texel per world unit. The football field (pitch.js) - its mown bands, the
 * end zones, the white border, the running track and the navy sideline apron - the ball
 * shop's yard and the turf round the plaza are rectangles painted into it on whole units,
 * so every edge is crisp and falls on the stud-tile seams, and the whole floor is a single
 * draw call however many regions it has. (The field's lines and lettering are geometry and
 * decals over it: pitch.js, signs.js.)
 */

const MAP = { minX: -68, maxX: 72, minZ: -44, maxZ: PLAZA.maxZ + 12 }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the kick field's own floor takes over there. */
export const GROUND_NORTH_EDGE = TRACK_START_Z

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(r.minX - MAP.minX), Math.round(r.minZ - MAP.minZ), Math.round(r.maxX - r.minX), Math.round(r.maxZ - r.minZ))
  }
  const disc = (x, z, radius, color) => {
    ctx.fillStyle = color
    for (let dz = -radius; dz < radius; dz += 1) {
      for (let dx = -radius; dx < radius; dx += 1) {
        if ((dx + 0.5) ** 2 + (dz + 0.5) ** 2 <= radius * radius) {
          ctx.fillRect(Math.floor(x + dx - MAP.minX), Math.floor(z + dz - MAP.minZ), 1, 1)
        }
      }
    }
  }
  return { rect, disc }
}

/** The ground map for `world`'s venue (car park and turf, or sand). */
export function createGroundMap(maxTexture, world = 0) {
  const v = venueOf(world)
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')
  const { rect, disc } = painter(ctx)

  paintPark(rect, disc, v.beach ? PARKS.beach : v.palace ? PARKS.palace : PARKS.grass)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/** The lobby floor: grass (or sand at Shipwreck Cove) and a tiled walkway down the middle (the cliffs ring it). */
const PARKS = {
  grass: { grass: ['#5cc84a', '#68d456'], path: ['#a99cf0', '#b7abf7'], edge: '#ffffff', ring: '#6a5cff', portal: '#4f86ff', yard: '#ece8ff' },
  // The royal palace: a courtyard of pale flagstones in a big checker, a red carpet edged in gold.
  palace: { grass: ['#eadfc6', '#ddcfb0'], checker: true, path: ['#c41e3a', '#b51a35'], edge: '#f2c230', ring: '#8f1426', portal: '#4f86ff', yard: '#f7f0df' },
  // Shipwreck Cove: warm golden sand and a wooden boardwalk.
  beach: { grass: ['#f2cb8a', '#eabf7a'], path: ['#c48a52', '#b47a44'], edge: '#8a5a32', ring: '#ff8a5a', portal: '#16b8c4', yard: '#fbe6c4' },
}

function paintPark(rect, disc, PARK) {
  // Grass all round, in 4 m bands like big studded tiles.
  rect(MAP, PARK.grass[0])
  for (let z = MAP.minZ, k = 0; z < MAP.maxZ; z += 4, k += 1) {
    if (!PARK.checker) {
      rect({ minX: MAP.minX, maxX: MAP.maxX, minZ: z, maxZ: z + 4 }, PARK.grass[k % 2])
      continue
    }
    for (let x = MAP.minX, j = 0; x < MAP.maxX; x += 4, j += 1) rect({ minX: x, maxX: x + 4, minZ: z, maxZ: z + 4 }, PARK.grass[(j + k) % 2])
  }
  // The arm shop's tiled yard.
  rect(SHOP, PARK.yard)
  for (const p of PORTALS) {
    disc(p.x, p.z, 6, PARK.ring)
    disc(p.x, p.z, 5, PARK.portal)
  }
  // The blue path, white-edged, in light and dark 4 m bands.
  rect({ minX: -PATH_HALF - 1, maxX: PATH_HALF + 1, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ }, PARK.edge)
  for (let z = PLAZA.minZ, k = 0; z < PLAZA.maxZ; z += 4, k += 1) {
    rect({ minX: -PATH_HALF, maxX: PATH_HALF, minZ: z, maxZ: Math.min(PLAZA.maxZ, z + 4) }, PARK.path[k % 2])
  }
}

/** How far the ground runs out at Palm Beach before the ocean (Ocean.jsx) takes over. */
export const BEACH_EDGE = 118

/**
 * The ground plane, with UVs computed from world position so the map lands exactly
 * on the world grid. Outside the map, clamp-to-edge repeats the car park's (or the sand's)
 * colour. At Palm Beach it stops at BEACH_EDGE, and the sea runs on from there.
 */
export function createGroundGeometry(world = 0) {
  const reach = venueOf(world).beach ? BEACH_EDGE : 280
  const minX = -reach
  const maxX = reach
  const minZ = GROUND_NORTH_EDGE
  const maxZ = reach
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count), 1))
  return geometry
}
