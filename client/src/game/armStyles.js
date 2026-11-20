import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { armGrowth } from '@shared/balance'

import { useQuality } from '../store/quality'
import { glowTime } from './glow'

/**
 * How every pair of arms in the shop looks (shared/balance.js TIRES - the ids are the
 * template's, the names are arms). They climb from plain colours, through polished
 * metals, to cut gems, and every pair but the starter shines twice over: from inside (the
 * arm's own paint glows - `glow`) and outside (its aura - `aura`). Drawn by one GLSL
 * function (ARM_GLSL), the same on your Bloxity avatar's rubber arms and the shop's
 * standing pairs. No textures: everything is maths on the arm's rest-pose position, so
 * facets and bands stretch with the arm when it stretches like rubber.
 *
 *   pattern  what ARM_GLSL draws (ARM_PATTERN)
 *   a, b, c  main, shadow and highlight colours
 *   glow     how much it shines from within (0-1); kept up on LOW too, it costs nothing
 *   skin     the starter arms: no glow, no aura
 *   trail    the colour of your flight's trail, speed lines and stand trim
 *   aura     [kind (AURA), strength, size] of the glow round them; auraA / auraB its
 *            two colours (default: trail and c)
 */

export const ARM_PATTERN = {
  /** One colour, lighter at the shoulder, glowing softly from within. */
  PLAIN: 0,
  /** Polished metal: bands, fine brushed lines, a shine sweeping down the arm. */
  METAL: 1,
  /** A cut gem: facets each their own shade, bright edges, twinkling sparkles. */
  GEM: 2,
  /** A rainbow gem: the facets cycle through every colour. */
  PRISM: 3,
}

const P = ARM_PATTERN

/**
 * One piece of an arm: a box with rounded edges (radius `r`) - or, on LOW, a plain box:
 * seen small on a phone they look the same, at a tenth of the triangles (24 shop pairs and
 * every avatar's arms add up).
 */
const armBox = (w, h, d, r) => (useQuality.getState().level === 'LOW' ? new BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, r))

export const ARM_STYLES = {
  // Plain colours.
  bicycle: { pattern: P.PLAIN, a: '#ffd86b', b: '#e3ad42', c: '#fff2b0', skin: true, trail: '#ffd86b', aura: [0, 0] },
  mountain: { pattern: P.PLAIN, a: '#ffffff', b: '#c3cedd', c: '#ffffff', glow: 0.3, trail: '#ffffff', aura: [6, 0.9], auraA: '#ffffff', auraB: '#cfe6ff' },
  wood: { pattern: P.PLAIN, a: '#ff3b3b', b: '#b3121e', c: '#ffb0a0', glow: 0.35, trail: '#ff6a5a', aura: [2, 0.9], auraA: '#ff2a14', auraB: '#ffb21f' },
  stone: { pattern: P.PLAIN, a: '#ff8a1f', b: '#bf4f00', c: '#ffd27a', glow: 0.35, trail: '#ffa64f', aura: [9, 0.9], auraA: '#ff3b00', auraB: '#ffd21f' },
  cookie: { pattern: P.PLAIN, a: '#ffe23a', b: '#c99f00', c: '#fff6b0', glow: 0.35, trail: '#fff06a', aura: [3, 0.9], auraA: '#ffe23a', auraB: '#ffffff' },
  pizza: { pattern: P.PLAIN, a: '#3fe05a', b: '#11922a', c: '#b6ff9a', glow: 0.35, trail: '#7dff8a', aura: [5, 0.9], auraA: '#1fd14a', auraB: '#d9ff7a' },
  donut: { pattern: P.PLAIN, a: '#2f8bff', b: '#1239a8', c: '#a8dcff', glow: 0.35, trail: '#6fb4ff', aura: [3, 0.95], auraA: '#2f8bff', auraB: '#ffffff' },
  watermelon: { pattern: P.PLAIN, a: '#a64cff', b: '#561ba8', c: '#f0c8ff', glow: 0.35, trail: '#c58cff', aura: [4, 0.95], auraA: '#8a3cff', auraB: '#ff8ff0' },
  monster: { pattern: P.PLAIN, a: '#34343f', b: '#0d0d12', c: '#9a9ab8', glow: 0.18, trail: '#b0b0ff', aura: [4, 1], auraA: '#5a3cff', auraB: '#c8b8ff' },
  // Metals.
  mint: { pattern: P.METAL, a: '#d89050', b: '#74400f', c: '#ffe0b8', glow: 0.15, trail: '#e8a060', aura: [2, 0.95], auraA: '#ff6a1f', auraB: '#ffd8a0' },
  silver: { pattern: P.METAL, a: '#e8eef6', b: '#7f8b9b', c: '#ffffff', glow: 0.15, trail: '#e8f0ff', aura: [3, 1], auraA: '#bfe0ff', auraB: '#ffffff' },
  ice: { pattern: P.METAL, a: '#ffc81a', b: '#a06400', c: '#fff6c0', glow: 0.25, trail: '#ffd21f', aura: [2, 1], auraA: '#ffb21f', auraB: '#fff6c0' },
  gold: { pattern: P.METAL, a: '#f0f5f9', b: '#93a7b6', c: '#ffffff', glow: 0.25, trail: '#dff4ff', aura: [6, 1.05], auraA: '#bfe8ff', auraB: '#ffffff' },
  lava: { pattern: P.METAL, a: '#a3afc2', b: '#373f4f', c: '#d6f0ff', glow: 0.2, trail: '#8fc0ff', aura: [3, 1.05], auraA: '#4f8fff', auraB: '#e0f0ff' },
  platinum: { pattern: P.METAL, a: '#ffb4a4', b: '#a8604f', c: '#fff0ea', glow: 0.25, trail: '#ffb0a0', aura: [2, 1.05], auraA: '#ff5a8a', auraB: '#ffd0e0' },
  // Gems.
  emerald: { pattern: P.GEM, a: '#2bd17a', b: '#08602e', c: '#d6ffe6', glow: 0.35, trail: '#7dffb0', aura: [5, 1.05], auraA: '#14c85a', auraB: '#c8ffd8' },
  ruby: { pattern: P.GEM, a: '#ff3b5c', b: '#700820', c: '#ffd6de', glow: 0.35, trail: '#ff7a90', aura: [2, 1.1], auraA: '#ff1f3a', auraB: '#ffb0a0' },
  diamond: { pattern: P.GEM, a: '#3f7bff', b: '#0a2680', c: '#d6e6ff', glow: 0.35, trail: '#7fa8ff', aura: [3, 1.1], auraA: '#2f6bff', auraB: '#d6e6ff' },
  rainbow: { pattern: P.GEM, a: '#b06bff', b: '#44167f', c: '#f0dcff', glow: 0.35, trail: '#c99cff', aura: [4, 1.1], auraA: '#a64cff', auraB: '#ffd0ff' },
  unicorn: { pattern: P.GEM, a: '#ffb83a', b: '#9e5400', c: '#fff0c8', glow: 0.35, trail: '#ffc86a', aura: [9, 1.15], auraA: '#ff7a00', auraB: '#fff0a0' },
  galaxy: { pattern: P.GEM, a: '#e8faff', b: '#86d0ff', c: '#ffffff', glow: 0.45, trail: '#bff4ff', aura: [6, 1.25, 1.2], auraA: '#bff4ff', auraB: '#ffffff' },
  dragon: { pattern: P.GEM, a: '#2e2848', b: '#090712', c: '#d6c8ff', glow: 0.3, trail: '#a48cff', aura: [4, 1.25, 1.2], auraA: '#7a4cff', auraB: '#ffffff' },
  // Rainbow gems.
  cosmic: { pattern: P.PRISM, a: '#ffffff', b: '#ffffff', c: '#ffffff', glow: 0.4, trail: '#ff9ed8', aura: [8, 1.3, 1.25] },
  infinity: { pattern: P.PRISM, a: '#ffffff', b: '#ffffff', c: '#ffffff', glow: 0.55, trail: '#ffffff', aura: [8, 1.45, 1.4] },
}

// Parsed once: frame code looks colours up without allocating.
const PARSED = Object.fromEntries(
  Object.entries(ARM_STYLES).map(([id, s]) => [
    id,
    {
      ...s,
      a: new Color(s.a),
      b: new Color(s.b),
      c: new Color(s.c),
      trail: new Color(s.trail),
      glow: s.glow ?? 0,
      aura: s.aura ?? [0, 0],
      auraA: new Color(s.auraA ?? s.trail),
      auraB: new Color(s.auraB ?? s.c),
    },
  ]),
)
const styleOf = (id) => PARSED[id] || PARSED.bicycle

/** How grown your rubber arms are (0-1): shared/balance armGrowth, used by the server too. */
export { armGrowth }

/** The colour of arms `id`'s trail, speed lines and glows. */
export const armTrail = (id) => styleOf(id).trail
/** Arms `id`'s base colour (its stand's cap). */
export const armBase = (id) => styleOf(id).a

/**
 * The arm painter, in GLSL. `p` is the arm's rest-pose position in the Bloxity rig's
 * units (the avatar is ~6.4 tall, an arm ~2 long, hanging down along y: the shoulder at
 * about 4); `t` is a clock for the shine and sparkles. Returns the colour and how much it
 * glows from within (0-1). Cheap to compile: one cell evaluation, in the gem branch only.
 */
const ARM_NOISE_GLSL = /* glsl */ `
  float aHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float aNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(aHash(i), aHash(i + vec2(1.0, 0.0)), f.x), mix(aHash(i + vec2(0.0, 1.0)), aHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 aHue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
`

export const ARM_GLSL = /* glsl */ `
  ${ARM_NOISE_GLSL}
  // Nearest and second-nearest cell distances, and the nearest cell's id (0-1).
  vec3 aCells(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(aHash(i + g), aHash(i + g + 17.7));
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; id = aHash(i + g + 3.3); }
        else if (d < d2) { d2 = d; }
      }
    }
    return vec3(sqrt(d1), sqrt(d2), id);
  }
  vec4 armLook(vec3 p, float pattern, vec3 a, vec3 b, vec3 c, float glow, float t) {
    float y = p.y;
    vec2 q = vec2(p.x + p.z, p.y);
    int k = int(pattern + 0.5);
    vec3 col = a;
    float emit = glow;
    if (k == 1) {
      // Metal: polished bands, fine brushed lines, a bright shine sweeping down the arm.
      float r = 0.5 + 0.5 * sin(y * 2.6 + (p.x - p.z) * 3.0);
      float brush = aNoise(vec2(q.x * 1.5, q.y * 18.0));
      col = mix(b, a, r) * (0.9 + 0.2 * brush);
      float sweep = smoothstep(0.9, 1.0, sin(y * 1.1 - t * 2.4 + (p.x + p.z) * 0.6));
      col = mix(col, c, sweep * 0.85 + smoothstep(0.85, 1.0, r) * 0.4);
      emit = glow + sweep * 0.7;
    } else if (k >= 2) {
      // A gem: cut facets, each its own shade (or colour, for a rainbow gem), bright edges
      // and sparkles twinkling on and off.
      vec3 cl = aCells(q * 2.6);
      float edge = cl.y - cl.x;
      col = k == 2 ? mix(b, a, 0.35 + cl.z * 0.65) : mix(aHue(fract(cl.z + t * 0.15 + y * 0.12)), vec3(1.0), 0.2);
      float rim = 1.0 - smoothstep(0.0, 0.05, edge);
      col = mix(col, c, rim * 0.8);
      float twinkle = pow(max(0.0, sin(t * 2.5 + cl.z * 40.0)), 20.0);
      col = mix(col, vec3(1.0), twinkle);
      emit = glow + rim * 0.5 + twinkle;
    } else {
      // Plain: one colour, lighter at the shoulder, glowing softly from within.
      col = mix(b, a, 0.55 + 0.45 * smoothstep(-2.0, 4.0, y));
      emit = glow * (0.8 + 0.4 * (0.5 + 0.5 * sin(t * 2.0 + y * 1.5)));
    }
    return vec4(col, emit);
  }
`

// --- Your avatar's arms ---------------------------------------------------------------

/**
 * Teaches a merged avatar body's material (avatarRig.mergeBody; its geometry carries an
 * `aArm` attribute, 1 on the arms) to paint the arms. Every avatar shares one program
 * (customProgramCacheKey); each has its own uniforms, set by setArmLook.
 */
export function patchArmMaterial(material) {
  const uniforms = {
    uArmA: { value: new Color() },
    uArmB: { value: new Color() },
    uArmC: { value: new Color() },
    // pattern, glow, mix (0 = the avatar's own skin), hidden (1: rubber arms drawn instead)
    uArmStyle: { value: [0, 0, 0, 0] },
    uArmTime: glowTime,
  }
  material.userData.arm = { uniforms, id: null }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aArm;\nuniform vec4 uArmStyle;\nvarying float vArm;\nvarying vec3 vArmP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvArm = aArm;\nvArmP = position;\nif (aArm > 0.5 && uArmStyle.w > 0.5) transformed = vec3(0.0);')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uArmA;
        uniform vec3 uArmB;
        uniform vec3 uArmC;
        uniform vec4 uArmStyle;
        uniform float uArmTime;
        varying float vArm;
        varying vec3 vArmP;
        ${ARM_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 armPaint = vec4(0.0);
        if (vArm > 0.5 && uArmStyle.z > 0.0) {
          armPaint = armLook(vArmP, uArmStyle.x, uArmA, uArmB, uArmC, uArmStyle.y, uArmTime);
          diffuseColor.rgb = mix(diffuseColor.rgb, armPaint.rgb, uArmStyle.z);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += armPaint.rgb * armPaint.a * uArmStyle.z * 0.8;',
      )
  }
  material.customProgramCacheKey = () => 'arm-body-v1'
  material.needsUpdate = true
  return material
}

/**
 * Dresses a patched body material's arms as arms `id` - or, `hide`, folds them away (the
 * rubber arms are drawn in their place: createRubberArms). Cheap; a no-op when unchanged.
 */
export function setArmLook(material, id, hide = false) {
  const arm = material?.userData?.arm
  if (!arm || (arm.id === id && arm.hide === hide)) return
  arm.id = id
  arm.hide = hide
  const s = styleOf(id)
  const u = arm.uniforms
  u.uArmA.value.copy(s.a)
  u.uArmB.value.copy(s.b)
  u.uArmC.value.copy(s.c)
  u.uArmStyle.value = [s.pattern, s.glow, s.skin ? 0 : 1, hide ? 1 : 0]
}

// --- Glow auras -----------------------------------------------------------------------

/**
 * The glowing aura round a pair of arms: a shell a little bigger than the arm, drawn
 * additively (no depth writes), its brightness swelling at the silhouette and painted by
 * the arms' element (`aura[0]`, AURA): flames licking up the arm, lightning crackling down
 * it, void smoke, toxic fire, frost or gold sparkles, a rainbow. Its edge flickers in and
 * out (the shell's size breathes with a noise), so it reads as alive from across the
 * plaza. One program for every avatar's arms, one more for the shop's.
 *
 * Per instance: `aAura` (kind, strength, size, -), `aAuraA` / `aAuraB` (its two colours).
 */
const AURA_VERTEX_HEAD = /* glsl */ `
  attribute vec4 aAura;
  attribute vec3 aAuraA;
  attribute vec3 aAuraB;
  uniform float uArmTime;
  varying vec3 vArmP;
  varying vec3 vN;
  varying vec3 vV;
  varying vec4 vAura;
  varying vec3 vAuraA;
  varying vec3 vAuraB;
`

const AURA_FRAGMENT = /* glsl */ `
  uniform float uArmTime;
  varying vec3 vArmP;
  varying vec3 vN;
  varying vec3 vV;
  varying vec4 vAura;
  varying vec3 vAuraA;
  varying vec3 vAuraB;
  ${ARM_NOISE_GLSL}
  void main() {
    int k = int(vAura.x + 0.5);
    float t = uArmTime;
    float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    rim *= rim;
    vec2 q = vec2((vArmP.x + vArmP.z) * 1.6, vArmP.y * 1.2);
    // Fire and toxic flames race up the arm; smoke drifts; the rest shimmer slowly.
    float speed = (k == 2 || k == 5) ? 2.6 : k == 9 ? 0.9 : k == 4 ? 0.5 : 0.8;
    float n = aNoise(q + vec2(0.0, -t * speed));
    #ifdef AURA_LITE
      float n2 = n;
    #else
      float n2 = aNoise(q * 2.7 + vec2(t * 0.3, -t * speed * 1.4));
    #endif
    float flame = smoothstep(0.5, 0.9, n * 0.6 + n2 * 0.5);
    // A soft halo: brightest at the silhouette, fading to almost nothing across the face
    // of the arm so the arm itself shows through clearly. No hard lines or patterns - the
    // flames, sparks and glitter are the particles' (PARTICLE_FRAGMENT).
    float halo = smoothstep(0.0, 1.0, rim);
    vec3 col = mix(vAuraA, vAuraB, halo * 0.6 + n2 * 0.25);
    float a = 0.03 + halo * 0.42;
    if (k == 2 || k == 5 || k == 9) {
      // Fire, toxic, lava: the halo licks upward a little.
      a += flame * 0.22 * halo;
      col = mix(col, vAuraB, flame * 0.5);
    } else if (k == 3) {
      // Electric: the halo flickers like a live wire.
      a *= 0.75 + 0.35 * step(0.3, fract(sin(floor(t * 12.0)) * 43758.5));
    } else if (k == 8) {
      col = aHue(fract(vArmP.y * 0.25 - t * 0.4));
    }
    a = clamp(a * vAura.y, 0.0, 1.0);
    gl_FragColor = vec4(col * a, a);
  }
`

/** Aura kinds (`aura[0]` in ARM_STYLES). */
export const AURA = { NONE: 0, GLOW: 1, FIRE: 2, THUNDER: 3, VOID: 4, TOXIC: 5, FROST: 6, GOLD: 7, RAINBOW: 8, LAVA: 9 }

const auraMaterials = {}

/**
 * The aura's material: for the avatars' rubber arms (`display` false: shaped and
 * stretched exactly as the arm is, by armShape) or the shop's standing arms (grown about
 * each piece's own middle, `aCenter`).
 */
function getAuraMaterial(display) {
  // LOW: the same aura, cheaper - one noise and no flicker of its edge (the first flight
  // on a phone dipped under 45 FPS with the full one).
  const lite = useQuality.getState().level === 'LOW'
  const key = `${display ? 'display' : 'rubber'}${lite ? '-lite' : ''}`
  if (auraMaterials[key]) return auraMaterials[key]
  const shape = display
    ? /* glsl */ `
      attribute vec3 aArmP;
      attribute vec3 aCenter;
      void main() {
        #ifdef AURA_LITE
          float wob = 0.5;
        #else
          float wob = aNoise(vec2(aArmP.y * 1.5 - uArmTime * 3.0, aArmP.x + aArmP.z));
        #endif
        float inflate = aAura.z * (0.75 + 0.5 * wob);
        vec3 armPos = aCenter + (position - aCenter) * (1.0 + inflate);
        vArmP = aArmP;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(armPos, 1.0);
        vN = normalize(mat3(modelViewMatrix * instanceMatrix) * normal);
        vV = -mv.xyz;
        vAura = aAura; vAuraA = aAuraA; vAuraB = aAuraB;
        gl_Position = projectionMatrix * mv;
      }`
    : /* glsl */ `
      ${ARM_SHAPE_GLSL}
      void main() {
        #ifdef AURA_LITE
          float wob = 0.5;
        #else
          float wob = aNoise(vec2(aArmP.y * 1.5 - uArmTime * 3.0, aArmP.x + aArmP.z));
        #endif
        vec3 armPos;
        vec3 armN;
        armShape(position, normal, aAura.z * (0.75 + 0.5 * wob), armPos, armN, vArmP);
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(armPos, 1.0);
        vN = normalize(mat3(modelViewMatrix * instanceMatrix) * armN);
        vV = -mv.xyz;
        vAura = aAura; vAuraA = aAuraA; vAuraB = aAuraB;
        gl_Position = projectionMatrix * mv;
      }`
  const material = new ShaderMaterial({
    uniforms: { uArmTime: glowTime },
    vertexShader: `${AURA_VERTEX_HEAD}\n${ARM_NOISE_GLSL}\n${shape}`,
    fragmentShader: AURA_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    defines: lite ? { AURA_LITE: '' } : {},
  })
  auraMaterials[key] = material
  return material
}

/**
 * Adds the per-instance aura attributes to `geometry` (`count` instances) and returns a
 * setter: `paint(i, id)` gives instance i arms `id`'s aura. Returns whether it has one.
 */
function auraAttributes(geometry, count) {
  const attr = (name, size) => {
    const a = new InstancedBufferAttribute(new Float32Array(count * size), size)
    geometry.setAttribute(name, a)
    return a
  }
  const aAura = attr('aAura', 4)
  const aA = attr('aAuraA', 3)
  const aB = attr('aAuraB', 3)
  return (i, id, size) => {
    const s = styleOf(id)
    aAura.setXYZW(i, s.aura[0], s.aura[1], size * (s.aura[2] ?? 1), 0)
    aA.setXYZ(i, s.auraA.r, s.auraA.g, s.auraA.b)
    aB.setXYZ(i, s.auraB.r, s.auraB.g, s.auraB.b)
    aAura.needsUpdate = true
    aA.needsUpdate = true
    aB.needsUpdate = true
    return s.aura[0] > 0
  }
}

/** An aura mesh riding on `mesh`: the same geometry and instance matrices, drawn over it. */
function attachAura(mesh, display) {
  const aura = new InstancedMesh(mesh.geometry, getAuraMaterial(display), mesh.count)
  aura.instanceMatrix = mesh.instanceMatrix
  aura.frustumCulled = false
  aura.visible = false
  mesh.add(aura)
  return aura
}

// --- Flames, sparks and lava coming off the arms ---------------------------------------

/**
 * The arms' element, as particles: little camera-facing quads born on the arm's surface
 * that then move in WORLD space - flames licking straight up (so they keep rising
 * whichever way you whirl or fly), sparks jumping about, molten drops dripping off,
 * glitter floating up. Everything is worked out in the vertex shader from the clock and
 * each quad's seed: nothing is touched per frame on the CPU, one draw call per avatar
 * (and one for the whole shop). AURA picks the look:
 *   GLOW, FIRE, TOXIC, VOID, RAINBOW  flames (white-hot core, auraB inside, auraA out)
 *   THUNDER                           electric sparks: jagged, flickering, jumping about
 *   LAVA                              glowing drops dripping down, and embers going up
 *   FROST, GOLD                       twinkling four-point glitter drifting up
 */
const PARTICLE_VERTEX = /* glsl */ `
  attribute vec2 aCorner;
  attribute vec3 aSeed;
  attribute vec4 aAura;
  attribute vec3 aAuraA;
  attribute vec3 aAuraB;
  uniform float uArmTime;
  varying vec2 vUv;
  varying float vLife;
  varying vec3 vA;
  varying vec3 vB;
  varying float vKind;
  varying float vStrength;
  varying float vSeed;
  #ifdef DISPLAY
    // The shop's standing pair: a point on one of its two arms (createPairGeometry).
    vec3 bornAt() {
      float side = aSeed.x < 0.5 ? -1.0 : 1.0;
      float along = fract(aSeed.x * 2.0);
      float ang = aSeed.y * 6.2831;
      vec3 p = vec3(side * 0.42 + cos(ang) * 0.34, mix(-1.1, 1.15, along), sin(ang) * 0.34);
      float l = -0.14 * side;
      return vec3(p.x * cos(l) - p.y * sin(l), p.x * sin(l) + p.y * cos(l), p.z);
    }
    const float SCALE = 1.7;
  #else
    attribute vec3 aArmPose;
    // An avatar's rubber arm: a point round it, anywhere from the shoulder to the fist.
    vec3 bornAt() {
      float armLen = max(aArmPose.x, 0.05);
      float along = aSeed.x * 1.2;
      float ang = aSeed.y * 6.2831;
      float y = -min(along, 1.0) * armLen - max(0.0, along - 1.0) * 1.2;
      return vec3(cos(ang) * 0.17, y, sin(ang) * 0.17);
    }
    const float SCALE = 1.0;
  #endif
  void main() {
    int k = int(aAura.x + 0.5);
    float rate = k == 3 ? 2.4 : k == 9 ? 0.5 : (k == 6 || k == 7) ? 0.5 : k == 4 ? 0.8 : 1.3;
    float life = fract(uArmTime * rate + aSeed.z);
    vec4 world = modelMatrix * instanceMatrix * vec4(bornAt(), 1.0);
    float ang = aSeed.y * 6.2831;
    vec3 off;
    float size;
    if (k == 3) {
      // A spark jumps to a new spot many times a second.
      float hop = floor(uArmTime * 12.0 + aSeed.z * 7.0);
      off = vec3(sin(aSeed.z * 91.0 + hop * 1.7), cos(aSeed.y * 57.0 + hop * 2.3), sin(aSeed.x * 33.0 + hop * 3.1)) * 0.1;
      size = 0.09;
    } else if (k == 9) {
      // Lava: most drops drip down and swell; a few embers float up.
      bool ember = aSeed.z > 0.75;
      off = vec3(0.0, ember ? life * 0.8 : -life * life * 0.6, 0.0);
      size = ember ? 0.05 * (1.0 - life) : 0.08 + 0.06 * (1.0 - life);
    } else if (k == 6 || k == 7) {
      off = vec3(cos(ang) * 0.08 * life, life * 0.3, sin(ang) * 0.08 * life);
      size = 0.08;
    } else {
      // Flames: up and swaying, shrinking as they burn out.
      off = vec3(sin(life * 6.0 + aSeed.y * 20.0) * 0.05, life * (k == 4 ? 0.5 : 0.85), cos(life * 5.0 + aSeed.x * 17.0) * 0.05);
      size = mix(0.26, 0.07, life);
    }
    world.xyz += off * SCALE;
    vec4 mv = viewMatrix * world;
    float tall = (k == 3 || k == 6 || k == 7 || k == 9) ? 1.0 : 1.7;
    mv.xy += vec2(aCorner.x, aCorner.y * tall) * size * SCALE * clamp(aAura.z * 1.6, 0.6, 2.0);
    vUv = aCorner;
    vLife = life;
    vA = aAuraA;
    vB = aAuraB;
    vKind = aAura.x;
    vStrength = aAura.y;
    vSeed = aSeed.z;
    gl_Position = projectionMatrix * mv;
  }
`

const PARTICLE_FRAGMENT = /* glsl */ `
  uniform float uArmTime;
  varying vec2 vUv;
  varying float vLife;
  varying vec3 vA;
  varying vec3 vB;
  varying float vKind;
  varying float vStrength;
  varying float vSeed;
  ${ARM_NOISE_GLSL}
  void main() {
    int k = int(vKind + 0.5);
    vec2 uv = vUv;
    vec3 col;
    float a;
    if (k == 3) {
      // A jagged electric streak, flickering on and off.
      float zig = sin(uv.x * 7.0 + vSeed * 40.0) * 0.3 + sin(uv.x * 17.0 + vSeed * 13.0) * 0.12;
      float line = 1.0 - smoothstep(0.0, 0.09, abs(uv.y - zig));
      float flick = step(0.4, fract(sin(floor(uArmTime * 20.0) + vSeed * 91.0) * 43758.5));
      a = line * (1.0 - smoothstep(0.55, 1.0, abs(uv.x))) * flick * 1.4;
      col = mix(vA, vec3(1.0), line * 0.75);
    } else if (k == 6 || k == 7) {
      // Glitter: a twinkling four-point star.
      float star = max(0.0, 1.0 - (abs(uv.x * uv.y) * 14.0 + length(uv) * 0.85));
      float twinkle = 0.5 + 0.5 * sin(uArmTime * 8.0 + vSeed * 50.0);
      a = star * twinkle * (1.0 - vLife) * 1.6;
      col = mix(vA, vec3(1.0), star);
    } else if (k == 9) {
      // A molten drop: white-yellow heart, orange, a dark red rim.
      float d = length(uv);
      a = smoothstep(1.0, 0.35, d) * (1.0 - vLife * 0.4);
      col = mix(vA, vB, smoothstep(0.85, 0.1, d));
      col = mix(col, vec3(1.0, 0.95, 0.7), smoothstep(0.35, 0.0, d) * 0.7);
    } else {
      // A flame tongue: a teardrop, narrower at the top, its edge licked by noise; a
      // white-hot core, auraB inside, auraA out at the edges and as it burns out.
      vec2 p = vec2(uv.x * (1.0 + (uv.y + 1.0) * 0.55), uv.y);
      float n = aNoise(vec2(uv.x * 2.2 + vSeed * 10.0, uv.y * 2.2 - uArmTime * 4.5));
      float d = length(p) + (n - 0.5) * 0.55;
      float body = smoothstep(1.0, 0.25, d);
      float heat = smoothstep(0.75, 0.0, d) * (1.0 - vLife);
      col = k == 8 ? aHue(fract(vSeed + uArmTime * 0.3 + uv.y * 0.1)) : mix(vA, vB, heat);
      col = mix(col, vec3(1.0, 0.96, 0.85), smoothstep(0.35, 0.0, d) * (1.0 - vLife) * 0.55);
      a = body * (1.0 - vLife) * smoothstep(0.0, 0.12, vLife) * (k == 1 ? 0.6 : 1.0);
    }
    a = clamp(a * min(vStrength, 1.3), 0.0, 1.0);
    gl_FragColor = vec4(col * a, a);
  }
`

const particleMaterials = {}

function getParticleMaterial(display) {
  const key = display ? 'display' : 'rubber'
  if (particleMaterials[key]) return particleMaterials[key]
  const material = new ShaderMaterial({
    uniforms: { uArmTime: glowTime },
    vertexShader: PARTICLE_VERTEX,
    fragmentShader: PARTICLE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    defines: display ? { DISPLAY: '' } : {},
  })
  particleMaterials[key] = material
  return material
}

/** Particles per arm (or per standing pair in the shop), by quality: fewer on LOW. */
const particleCount = () => (useQuality.getState().level === 'LOW' ? 18 : 48)

/**
 * A particle mesh riding on `mesh` (an arm or display mesh): `perInstance` quads for each
 * of its instances, sharing its instance matrices and aura attributes. Its own geometry
 * (the quads' corners and seeds) is never shared, so it can be disposed with its owner.
 */
function attachParticles(mesh, display, perInstance) {
  const geometry = new BufferGeometry()
  const corners = new Float32Array(perInstance * 8)
  const seeds = new Float32Array(perInstance * 12)
  const index = new Uint16Array(perInstance * 6)
  const C = [-1, -1, 1, -1, 1, 1, -1, 1]
  for (let q = 0; q < perInstance; q += 1) {
    const seed = [(q + 0.5) / perInstance, Math.random(), Math.random()]
    for (let v = 0; v < 4; v += 1) {
      corners.set([C[v * 2], C[v * 2 + 1]], (q * 4 + v) * 2)
      seeds.set(seed, (q * 4 + v) * 3)
    }
    index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6)
  }
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(perInstance * 12), 3))
  geometry.setAttribute('aCorner', new BufferAttribute(corners, 2))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3))
  geometry.setIndex(new BufferAttribute(index, 1))
  for (const name of ['aAura', 'aAuraA', 'aAuraB', 'aArmPose']) {
    const attribute = mesh.geometry.getAttribute(name)
    if (attribute) geometry.setAttribute(name, attribute)
  }
  const particles = new InstancedMesh(geometry, getParticleMaterial(display), mesh.count)
  particles.instanceMatrix = mesh.instanceMatrix
  particles.frustumCulled = false
  particles.visible = false
  particles.userData.ownGeometry = true
  mesh.add(particles)
  return particles
}

/** Frees an arm or display mesh's aura and particle children (their own geometry too). */
function disposeChildren(mesh) {
  for (const child of mesh.children) {
    if (child.userData.ownGeometry) child.geometry.dispose()
    child.dispose()
  }
}

/**
 * Lighting added to the arms' own glow (the rubber arms' and the shop's): a glossy
 * highlight from a light up and to the front, and a sheen round the silhouette - strong
 * on metals and gems, softer on plain colours - so they read as polished, not flat.
 */
const ARM_SHINE = /* glsl */ `
  totalEmissiveRadiance += armPaint.rgb * armPaint.a * 0.8;
  vec3 shineView = normalize(vViewPosition);
  float shineSheen = pow(1.0 - abs(dot(normal, shineView)), 3.0);
  float shineSpec = pow(max(dot(normal, normalize(shineView + vec3(0.35, 0.8, 0.45))), 0.0), 40.0);
  float shineAmount = vArmStyle.x > 0.5 ? 1.0 : 0.45;
  totalEmissiveRadiance += ((armPaint.rgb * 0.5 + 0.5) * shineSheen * 0.35 + vec3(shineSpec) * 0.55) * shineAmount;
`

// --- The shop's standing arms ---------------------------------------------------------

/**
 * A pair of blocky power arms standing up on end, fists to the sky, leaning a little apart
 * - the way the shop shows them. Each is a square arm and a chunky fist. Each piece
 * carries `aArmP` (its position as if the arm hung straight in the avatar rig's units, so
 * the patterns run along it as on an avatar) and `aCenter` (the piece's middle, which
 * its aura grows about). About 2.4 units tall; centred.
 */
function createPairGeometry() {
  const pieces = []
  const add = (geometry, alongOffset, matrix) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry
    if (g !== geometry) geometry.dispose()
    const pos = g.getAttribute('position')
    const armP = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i += 1) {
      armP[i * 3] = pos.getX(i)
      armP[i * 3 + 1] = pos.getY(i) + alongOffset
      armP[i * 3 + 2] = pos.getZ(i)
    }
    g.setAttribute('aArmP', new BufferAttribute(armP, 3))
    g.applyMatrix4(matrix)
    const c = new Vector3().setFromMatrixPosition(matrix)
    const center = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i += 1) center.set([c.x, c.y, c.z], i * 3)
    g.setAttribute('aCenter', new BufferAttribute(center, 3))
    pieces.push(g)
  }
  for (const side of [-1, 1]) {
    const lean = new Matrix4().makeRotationZ(-0.14 * side)
    const at = (x, y) => new Matrix4().makeTranslation(side * 0.42 + x, y, 0).premultiply(lean)
    add(armBox(0.6, 1.7, 0.6, 0.14), 3.0, at(0, -0.3))
    add(armBox(0.74, 0.62, 0.74, 0.16), 1.6, at(0, 0.86))
    // A thumb on the fist's outer side.
    add(armBox(0.18, 0.34, 0.22, 0.06), 1.7, at(side * 0.42, 0.78))
  }
  const merged = mergeGeometries(pieces, false)
  for (const piece of pieces) piece.dispose()
  merged.computeBoundingSphere()
  return merged
}

let pairGeometry = null
let displayMaterial = null

function getDisplayMaterial() {
  if (displayMaterial) return displayMaterial
  const material = new MeshLambertMaterial({ color: 0xffffff })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uArmTime = glowTime
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aArmP;
        attribute vec3 aArmA;
        attribute vec3 aArmB;
        attribute vec3 aArmC;
        attribute vec2 aArmStyle;
        varying vec3 vArmP;
        varying vec3 vArmA;
        varying vec3 vArmB;
        varying vec3 vArmC;
        varying vec2 vArmStyle;`,
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvArmP = aArmP; vArmA = aArmA; vArmB = aArmB; vArmC = aArmC; vArmStyle = aArmStyle;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uArmTime;
        varying vec3 vArmP;
        varying vec3 vArmA;
        varying vec3 vArmB;
        varying vec3 vArmC;
        varying vec2 vArmStyle;
        ${ARM_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 armPaint = armLook(vArmP, vArmStyle.x, vArmA, vArmB, vArmC, vArmStyle.y, uArmTime);
        diffuseColor.rgb = armPaint.rgb;`,
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${ARM_SHINE}`)
  }
  material.customProgramCacheKey = () => 'arm-display-v4'
  displayMaterial = material
  return material
}

/** How far the shop arms' auras stand off them (share of each piece's size): a thin halo. */
const DISPLAY_AURA = 0.16

/**
 * Up to `max` pairs of standing arms in one draw call, their auras in one more.
 * `mesh.setArm(i, id)` dresses instance i as arms `id` (cheap; call once when it
 * changes). The shape and materials are shared by every display mesh;
 * disposeArmDisplayMesh frees only the instance data.
 */
export function createArmDisplayMesh(max) {
  pairGeometry ??= createPairGeometry()
  const geometry = pairGeometry.clone()
  const attr = (name, size) => {
    const a = new InstancedBufferAttribute(new Float32Array(max * size), size)
    geometry.setAttribute(name, a)
    return a
  }
  const aA = attr('aArmA', 3)
  const aB = attr('aArmB', 3)
  const aC = attr('aArmC', 3)
  const aStyle = attr('aArmStyle', 2)
  const paintAura = auraAttributes(geometry, max)
  const mesh = new InstancedMesh(geometry, getDisplayMaterial(), max)
  mesh.frustumCulled = false
  const aura = attachAura(mesh, true)
  // On LOW the shop's halo shells are left out (twice the arms' triangles for 24 pairs);
  // their own inner glow and the flame particles still show.
  aura.visible = useQuality.getState().level !== 'LOW'
  const fire = attachParticles(mesh, true, particleCount())
  fire.visible = true
  mesh.setArm = (i, id) => {
    const s = styleOf(id)
    aA.setXYZ(i, s.a.r, s.a.g, s.a.b)
    aB.setXYZ(i, s.b.r, s.b.g, s.b.b)
    aC.setXYZ(i, s.c.r, s.c.g, s.c.b)
    aStyle.setXY(i, s.pattern, s.glow)
    paintAura(i, id, DISPLAY_AURA)
    aA.needsUpdate = true
    aB.needsUpdate = true
    aC.needsUpdate = true
    aStyle.needsUpdate = true
  }
  return mesh
}

export function disposeArmDisplayMesh(mesh) {
  disposeChildren(mesh)
  mesh.geometry.dispose()
  mesh.dispose()
}

// --- The avatars' rubber arms -----------------------------------------------------------

/**
 * One arm's shape, in GLSL, shared by the arm itself and its aura (which passes
 * `inflate`, the share it stands proud of the arm). The geometry is one arm in its own
 * frame: the shoulder at the origin, the square arm running down to y = -1 and the fist
 * hung below that. Per instance, `aArmPose` (length in metres, wrist bend, side) is
 * applied here: the arm stretches to the length like rubber and thins as it goes, the
 * fist rides on its end without stretching, bent back at the wrist by `bend`, and only
 * the thumb for that side (+1: +X) is kept. Parts (`aPart`): 0 shoulder, 1 arm, 2 fist,
 * 3 the +X thumb, 4 the -X thumb.
 */
const ARM_SHAPE_GLSL = /* glsl */ `
  attribute vec3 aArmP;
  attribute float aPart;
  attribute vec3 aArmPose;
  void armShape(vec3 pos, vec3 nrm, float inflate, out vec3 armPos, out vec3 armN, out vec3 armP) {
    float armLen = max(aArmPose.x, 0.05);
    armPos = pos;
    armN = nrm;
    armP = aArmP;
    if (aPart < 0.5) {
      armPos *= 1.0 + inflate;
    } else if (aPart < 1.5) {
      // The arm: stretched to length, thinner the longer, the pattern repeating down it.
      armPos.xz *= clamp(sqrt(0.63 / armLen), 0.55, 1.15) * (1.0 + inflate);
      armPos.y *= armLen;
      armP.y = (aArmP.y - 4.0) * max(1.0, armLen / 0.63) + 4.0;
    } else {
      // The fist on the wrist: only this side's thumb, bent back at the wrist.
      if ((aPart > 2.5 && aPart < 3.5 && aArmPose.z < 0.0) || (aPart > 3.5 && aArmPose.z > 0.0)) armPos = vec3(0.0, -1.0, 0.0);
      vec3 h = (armPos - vec3(0.0, -1.0, 0.0)) * (1.0 + inflate);
      float bc = cos(aArmPose.y);
      float bs = sin(aArmPose.y);
      h = vec3(h.x, h.y * bc - h.z * bs, h.z * bc + h.y * bs);
      armN = vec3(armN.x, armN.y * bc - armN.z * bs, armN.z * bc + armN.y * bs);
      armPos = vec3(0.0, -armLen, 0.0) + h;
    }
  }
`

/**
 * A blocky power arm: a square shoulder cap, a square arm (in segments, so its aura can
 * ripple) and a chunky fist with a knuckle ridge and a thumb each side (one kept per arm).
 */
function createRubberArmGeometry() {
  const pieces = []
  const add = (geometry, part, matrix) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry
    if (g !== geometry) geometry.dispose()
    g.applyMatrix4(matrix)
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    const pos = g.getAttribute('position')
    const armP = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i += 1) {
      armP[i * 3] = pos.getX(i) * 5
      armP[i * 3 + 1] = pos.getY(i) * 5 + 4
      armP[i * 3 + 2] = pos.getZ(i) * 5
    }
    g.setAttribute('aArmP', new BufferAttribute(armP, 3))
    g.setAttribute('aPart', new BufferAttribute(new Float32Array(pos.count).fill(part), 1))
    pieces.push(g)
  }
  const m = () => new Matrix4()
  add(armBox(0.33, 0.2, 0.33, 0.06), 0, m().makeTranslation(0, -0.04, 0))
  add(armBox(0.28, 1, 0.28, 0.08), 1, m().makeTranslation(0, -0.5, 0))
  add(armBox(0.34, 0.3, 0.34, 0.09), 2, m().makeTranslation(0, -1.15, 0))
  add(armBox(0.36, 0.08, 0.12, 0.03), 2, m().makeTranslation(0, -1.27, 0.12))
  for (const side of [1, -1]) {
    add(armBox(0.09, 0.17, 0.11, 0.03), side > 0 ? 3 : 4, m().makeRotationZ(-0.4 * side).setPosition(0.2 * side, -1.12, 0.04))
  }
  const merged = mergeGeometries(pieces, false)
  for (const piece of pieces) piece.dispose()
  return merged
}

let rubberArmGeometry = null

// --- Dumbbells in the hands (training on a bench) ---------------------------------------

/**
 * A dumbbell across the fist: a steel handle and a chunky weight either end, built round
 * the origin; the material moves it down each arm to its fist (aArmPose.x: the arm's
 * length, as the rubber arms stretch), so it rides in the hand however the arm is posed.
 */
function createDumbbellGeometry() {
  const pieces = [
    new CylinderGeometry(0.035, 0.035, 0.46, 8).rotateZ(Math.PI / 2),
    new CylinderGeometry(0.11, 0.11, 0.12, 12).rotateZ(Math.PI / 2).translate(-0.2, 0, 0),
    new CylinderGeometry(0.11, 0.11, 0.12, 12).rotateZ(Math.PI / 2).translate(0.2, 0, 0),
    new CylinderGeometry(0.075, 0.075, 0.14, 12).rotateZ(Math.PI / 2).translate(-0.29, 0, 0),
    new CylinderGeometry(0.075, 0.075, 0.14, 12).rotateZ(Math.PI / 2).translate(0.29, 0, 0),
  ].map((g) => g.toNonIndexed())
  const colors = ['#c9d2de', '#2a2f3a', '#2a2f3a', '#ffd21f', '#ffd21f']
  for (let i = 0; i < pieces.length; i += 1) {
    const g = pieces[i]
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    const c = new Color(colors[i])
    const n = g.getAttribute('position').count
    const col = new Float32Array(n * 3)
    for (let v = 0; v < n; v += 1) col.set([c.r, c.g, c.b], v * 3)
    g.setAttribute('color', new BufferAttribute(col, 3))
  }
  const merged = mergeGeometries(pieces, false)
  for (const piece of pieces) piece.dispose()
  return merged
}

let dumbbellGeometry = null
let dumbbellMaterial = null

function getDumbbellMaterial() {
  if (dumbbellMaterial) return dumbbellMaterial
  const material = new MeshLambertMaterial({ vertexColors: true })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aArmPose;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y -= max(aArmPose.x, 0.05) + 0.16;')
  }
  material.customProgramCacheKey = () => 'arm-dumbbell-v1'
  dumbbellMaterial = material
  return material
}

/** A pair of dumbbells riding in `mesh`'s (rubber arms') fists; hidden until held. */
function attachDumbbells(mesh) {
  dumbbellGeometry ??= createDumbbellGeometry()
  const geometry = new BufferGeometry()
  for (const name of ['position', 'normal', 'color']) geometry.setAttribute(name, dumbbellGeometry.getAttribute(name).clone())
  geometry.setAttribute('aArmPose', mesh.geometry.getAttribute('aArmPose'))
  const bells = new InstancedMesh(geometry, getDumbbellMaterial(), 2)
  bells.instanceMatrix = mesh.instanceMatrix
  bells.frustumCulled = false
  bells.visible = false
  bells.userData.ownGeometry = true
  mesh.add(bells)
  return bells
}
let rubberArmMaterial = null

const RUBBER_VERTEX_HEAD = /* glsl */ `
  attribute vec3 aArmA;
  attribute vec3 aArmB;
  attribute vec3 aArmC;
  attribute vec2 aArmStyle;
  varying vec3 vArmP;
  varying vec3 vArmA;
  varying vec3 vArmB;
  varying vec3 vArmC;
  varying vec2 vArmStyle;
  ${ARM_SHAPE_GLSL}
`

const RUBBER_VERTEX_SHAPE = /* glsl */ `
  vec3 armPos;
  vec3 objectNormal;
  armShape(position, normal, 0.0, armPos, objectNormal, vArmP);
  vArmA = aArmA;
  vArmB = aArmB;
  vArmC = aArmC;
  vArmStyle = aArmStyle;
`

function getRubberArmMaterial() {
  if (rubberArmMaterial) return rubberArmMaterial
  const material = new MeshLambertMaterial({ color: 0xffffff })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uArmTime = glowTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${RUBBER_VERTEX_HEAD}`)
      .replace('#include <beginnormal_vertex>', RUBBER_VERTEX_SHAPE)
      .replace('#include <begin_vertex>', 'vec3 transformed = armPos;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uArmTime;
        varying vec3 vArmP;
        varying vec3 vArmA;
        varying vec3 vArmB;
        varying vec3 vArmC;
        varying vec2 vArmStyle;
        ${ARM_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 armPaint = armLook(vArmP, vArmStyle.x, vArmA, vArmB, vArmC, vArmStyle.y, uArmTime);
        diffuseColor.rgb = armPaint.rgb;`,
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${ARM_SHINE}`)
  }
  material.customProgramCacheKey = () => 'arm-rubber-v4'
  rubberArmMaterial = material
  return material
}

/** How far an avatar's aura stands off its arms (share of the arm's thickness): a thin halo. */
const AVATAR_AURA = 0.36

/**
 * One avatar's pair of rubber arms (instance 0 left, 1 right) and their glowing aura (a
 * child mesh sharing the geometry and matrices: one more draw call, none for the starter
 * arms). `setArm(id)` paints both as arms `id` (a no-op when unchanged); `setPose(i,
 * length, bend, side)` shapes one (see ARM_SHAPE_GLSL). Placed each frame by
 * avatarRig.placeRubberArms. The shape and materials are shared by every avatar;
 * disposeRubberArms frees the rest.
 */
export function createRubberArms() {
  rubberArmGeometry ??= createRubberArmGeometry()
  const geometry = rubberArmGeometry.clone()
  const attr = (name, size) => {
    const a = new InstancedBufferAttribute(new Float32Array(2 * size), size)
    geometry.setAttribute(name, a)
    return a
  }
  const aA = attr('aArmA', 3)
  const aB = attr('aArmB', 3)
  const aC = attr('aArmC', 3)
  const aStyle = attr('aArmStyle', 2)
  const aPose = attr('aArmPose', 3)
  const paintAura = auraAttributes(geometry, 2)
  const mesh = new InstancedMesh(geometry, getRubberArmMaterial(), 2)
  mesh.frustumCulled = false
  const aura = attachAura(mesh, false)
  const fire = attachParticles(mesh, false, particleCount())
  const bells = attachDumbbells(mesh)
  /** Holding dumbbells (pressing them on a training bench) or not. */
  mesh.setHolding = (holding) => {
    bells.visible = holding
  }
  let painted = null
  mesh.setArm = (id) => {
    if (id === painted) return
    painted = id
    const s = styleOf(id)
    let glows = false
    for (let i = 0; i < 2; i += 1) {
      aA.setXYZ(i, s.a.r, s.a.g, s.a.b)
      aB.setXYZ(i, s.b.r, s.b.g, s.b.b)
      aC.setXYZ(i, s.c.r, s.c.g, s.c.b)
      aStyle.setXY(i, s.pattern, s.glow)
      glows = paintAura(i, id, AVATAR_AURA)
    }
    aura.visible = glows
    fire.visible = glows
    aA.needsUpdate = true
    aB.needsUpdate = true
    aC.needsUpdate = true
    aStyle.needsUpdate = true
  }
  mesh.setPose = (i, length, bend, side) => {
    aPose.setXYZ(i, length, bend, side)
    aPose.needsUpdate = true
  }
  return mesh
}

export function disposeRubberArms(mesh) {
  disposeChildren(mesh)
  mesh.geometry.dispose()
  mesh.dispose()
}
