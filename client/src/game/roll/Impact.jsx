import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Euler, Matrix4, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three'

import { zoneIndexAt } from '@shared/logic'

import { getQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks } from '../blocks'
import { fireBurst } from '../fx/fxQueue'
import { sharedMaterials, STYLE } from '../materials'
import { tireGlow } from '../tire'
import { slopeY, SLOPE_EULER_X, trackPoint } from './path'
import { roll } from './rollControl'
import { RUNWAY_RAINBOW } from './themes'

/**
 * You slamming down on the stage at the end of the flight (rollControl's `impact`): the
 * ground breaks like a wall smashed in. Where you hit, it caves into a dark crater with a
 * broken rim; jagged cracks shoot out across the runway from it, glowing for a moment in
 * your arms' colour; slabs of the stage burst up round the crater and stay there tilted
 * out like broken paving; chunks of it and clods of soil fly out, bounce once and vanish;
 * and a white shockwave ring races out over the stage. You bounce and come to rest in the
 * crater (path.rideState). The harder you landed (PERFECT high, WEAK low), the bigger all
 * of it.
 *
 * The crater, cracks and rings are one procedural quad (no texture); the slabs, chunks
 * and clods are one pool of boxes, one draw call - fewer of them on presets without
 * particles. Everything is in the colours of the stage's ground. Nothing is allocated
 * while it plays.
 */

const TUFTS = 22
const TUFTS_LOW = 10
const CLODS = 8
const CLODS_LOW = 4
/** Broken slabs bursting up round the crater, on every preset (they're the impact). */
const SLABS = 8
const SLABS_LOW = 6
/** The pool: tufts, then clods, then the one divot, then the slabs. */
const DIVOT = TUFTS + CLODS
const SLAB0 = DIVOT + 1
const POOL = SLAB0 + SLABS
/** The slabs stay up this long after the landing (the result shows over them), then sink. */
const SLAB_LIFE = 4.6
const GRAVITY = 26
/** Pieces vanish this long after they come to rest (popping away, shrinking). */
const VANISH = 0.35
/** Whatever happens, every piece is gone by then. */
const MAX_LIFE = 2.6
const _tilt = new Quaternion()
const _yaw = new Quaternion()
const _tangent = new Vector3()
const _upAxis = new Vector3(0, 1, 0)
/** The dent's radius on the turf: bigger the higher the ball fell. */
const dentRadius = (peak) => 2 + peak * 0.14

const SOIL = new Color('#6b4426')
const SOIL_DARK = new Color('#4a2e1a')
const ZERO = new Matrix4().makeScale(0, 0, 0)
const WHITE = new Color('#ffffff')
const _turf = new Color()
const _turfLight = new Color()
const _turfDark = new Color()

const splashVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const splashFragment = /* glsl */ `
  uniform float uAge;
  uniform vec3 uGlow;
  uniform vec3 uTurf;
  varying vec2 vUv;
  void main() {
    // -1..1 across the quad: the dent fills the middle, the rings run out to the edge.
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float fade = 1.0 - smoothstep(4.2, 5.2, uAge);
    // Pressed in at once with a little squash-and-settle, as the ball thumps down.
    float press = 1.0 - pow(1.0 - clamp(uAge / 0.1, 0.0, 1.0), 3.0);
    float dentR = 0.2 * (press + 0.12 * sin(clamp(uAge / 0.4, 0.0, 1.0) * 3.14159) * (1.0 - press * 0.5));

    // The crater: caved-in ground, darkest in the middle and on the side away from the
    // sun, its edge broken up (no clean circle).
    float edgeNoise = sin(atan(p.y, p.x) * 7.0) * 0.018 + sin(atan(p.y, p.x) * 13.0 + 1.7) * 0.012;
    float dent = 1.0 - smoothstep(dentR * 0.8, dentR, r + edgeNoise);
    float lit = dot(r > 0.0001 ? p / r : vec2(0.0), normalize(vec2(-0.6, 0.8)));
    vec3 dentCol = uTurf * mix(0.14, 0.5, smoothstep(0.0, dentR, r)) * (0.85 - 0.2 * lit);
    // Its rim: broken ground pushed up round it, lit on the sun's side.
    float lip = (1.0 - smoothstep(0.0, 0.05, abs(r + edgeNoise - dentR - 0.03))) * press;
    vec3 lipCol = mix(uTurf * 1.2, vec3(1.0), 0.1) * (0.85 + 0.2 * lit);

    // Cracks: a few sharp zig-zag splits shooting out from the crater as it hits - thick
    // where they leave its rim, tapering to nothing - each with a short fork near the rim.
    float grow = 1.0 - pow(1.0 - clamp(uAge / 0.18, 0.0, 1.0), 2.0);
    float ang = atan(p.y, p.x);
    float crack = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float a0 = fi * 0.8976 + sin(fi * 12.9) * 0.35;
      float len = dentR + (0.22 + 0.16 * fract(sin(fi * 7.31) * 43758.5)) * grow;
      // Sideways offset along the crack: a sharp zig-zag (triangle wave), wider further out.
      float zig = (abs(fract(r * 7.5 + fi * 0.37) - 0.5) - 0.25) * 0.09 * (0.4 + r);
      float out01 = clamp((r - dentR) / max(len - dentR, 0.001), 0.0, 1.0);
      float w = mix(0.03, 0.002, out01);
      float da = mod(ang - a0 + 3.14159, 6.28318) - 3.14159;
      float d = abs(da * r - zig);
      float line = (1.0 - smoothstep(w * 0.45, w, d)) * step(dentR * 0.85, r) * (1.0 - smoothstep(len * 0.92, len, r));
      // The fork: off to one side, a short way out from the rim.
      float db = abs((mod(ang - a0 - 0.42 * (fract(fi * 0.5) > 0.2 ? 1.0 : -1.0) + 3.14159, 6.28318) - 3.14159) * r - zig * 0.6);
      float fork = (1.0 - smoothstep(w * 0.3, w * 0.7, db)) * step(dentR, r) * (1.0 - smoothstep(dentR + 0.06, dentR + 0.11, r)) * grow;
      crack = max(crack, max(line, fork));
    }
    float hot = 1.0 - smoothstep(0.2, 1.6, uAge);
    vec3 crackCol = mix(uTurf * 0.12, uGlow * 1.4 + vec3(0.2), hot * 0.7);
    // A soft shadow round the outside of the rim, where the broken ground lifts.
    float shade = (1.0 - smoothstep(0.0, 0.07, abs(r - dentR - 0.07))) * press * 0.35;

    // Two rings racing out over the pitch: a sharp white shockwave, and a softer ring of
    // light in the ball's own colour just behind it.
    float r1 = uAge * 2.6;
    float r2 = uAge * 1.8;
    float ring1 = (1.0 - smoothstep(0.0, 0.04, abs(r - r1))) * (1.0 - smoothstep(0.05, 0.45, uAge));
    float ring2 = (1.0 - smoothstep(0.0, 0.1, abs(r - r2))) * (1.0 - smoothstep(0.1, 0.7, uAge));

    vec3 col = lipCol;
    float alpha = lip * 0.8;
    col = mix(col, dentCol, dent);
    alpha = max(alpha, dent * 0.9);
    col = mix(col, uTurf * 0.35, shade * (1.0 - dent) * (1.0 - lip));
    alpha = max(alpha, shade * (1.0 - dent));
    col = mix(col, crackCol, crack * (1.0 - dent));
    alpha = max(alpha, crack * 0.95 * (1.0 - dent));
    col = mix(col, uGlow * 1.2 + vec3(0.15), ring2);
    alpha = max(alpha, ring2 * 0.7 * step(r, 1.0));
    col = mix(col, vec3(1.0), ring1);
    alpha = max(alpha, ring1 * 0.9 * step(r, 1.0));

    alpha *= fade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`

/** Lying flat on the slope, like the field's painted numbers. */
const FLAT = new Quaternion().setFromEuler(new Euler(-Math.PI / 2 + SLOPE_EULER_X, 0, 0))
const _m = new Matrix4()
const _q = new Quaternion()
const _s = new Vector3()
const _at = new Vector3()

function createSplash() {
  const material = new ShaderMaterial({
    uniforms: {
      uAge: { value: 99 },
      uGlow: { value: new Color('#ffb347') },
      uTurf: { value: new Color('#2fbf47') },
    },
    vertexShader: splashVertex,
    fragmentShader: splashFragment,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  mesh.quaternion.copy(FLAT)
  mesh.renderOrder = 2
  // Never hidden, only shrunk to nothing between landings: a hidden mesh isn't compiled
  // with the rest of the kick (Roll.jsx), and compiling its shader at the moment the
  // ball lands would freeze a weak GPU right then. Shrunk, it costs one empty draw call.
  mesh.scale.setScalar(0)
  mesh.frustumCulled = false
  return mesh
}

/** Every piece's state, made once: its flight, its tumble, its size, when it came to rest. */
const pieces = Array.from({ length: POOL }, () => ({
  on: false,
  pos: new Vector3(),
  vel: new Vector3(),
  axis: new Vector3(0, 1, 0),
  angle: 0,
  spin: 0,
  size: new Vector3(1, 1, 1),
  /** Bounces left before it settles. */
  bounces: 1,
  /** Seconds after the landing it came to rest, or -1 while it's still moving. */
  restAt: -1,
}))

/** Throws piece `c` up out of the landing at `at`, `a` its direction across the turf (radians). */
function launch(c, at, a, speedOut, speedUp) {
  c.on = true
  c.restAt = -1
  c.bounces = 1
  c.pos.copy(at)
  c.vel.set(Math.cos(a) * speedOut, speedUp, Math.sin(a) * speedOut)
  c.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
  c.angle = Math.random() * 3
}

export default function Impact() {
  const splashRef = useRef(null)
  const sprayRef = useRef(null)
  /** The impact (its impactAt) the effect was last started for, and when the spray flew. */
  const shown = useRef({ at: 0, sprayAt: 0 })
  const assets = useMemo(() => {
    const spray = createBoxInstances(POOL, sharedMaterials().toy, STYLE.SMOOTH)
    spray.castShadow = false
    return { splash: createSplash(), spray }
  }, [])

  useEffect(
    () => () => {
      assets.splash.geometry.dispose()
      assets.splash.material.dispose()
      disposeBlocks(assets.spray)
    },
    [assets],
  )

  useFrame((_state, rawDelta) => {
    const splash = splashRef.current
    const spray = sprayRef.current
    if (!splash || !spray) return
    const dt = Math.min(rawDelta, 0.05)
    const now = performance.now()
    const st = shown.current

    if (!roll.active || !roll.impactAt) {
      splash.scale.setScalar(0)
      spray.count = 0
      return
    }

    if (st.at !== roll.impactAt) {
      // A new landing: press the dent in where it hit, in this stage's turf, and throw
      // the tufts.
      st.at = roll.impactAt
      st.sprayAt = now
      // A PERFECT kick lands hardest, a WEAK one barely marks the grass.
      const grade = roll.hit === 'perfect' ? 1.3 : roll.hit === 'great' ? 1.12 : roll.hit === 'weak' ? 0.7 : 1
      const size = dentRadius(roll.impactPeak) * grade
      const power = Math.min(1, (roll.impactPeak / 32) * grade)
      trackPoint(roll.impactMeter, roll.impact.x, 0.11, splash.position)
      splash.scale.setScalar(size * 4)
      // Made of the runway you land on: its colour for this stage.
      _turf.set(RUNWAY_RAINBOW[zoneIndexAt(roll.impactMeter) % RUNWAY_RAINBOW.length])
      _turfLight.copy(_turf).lerp(WHITE, 0.2)
      _turfDark.copy(_turf).multiplyScalar(0.7)
      const u = splash.material.uniforms
      u.uTurf.value.copy(_turf)
      u.uGlow.value.copy(tireGlow(roll.tireId))

      const full = getQuality().particles
      const tufts = full ? TUFTS : TUFTS_LOW
      const clods = full ? CLODS : CLODS_LOW
      const at = splash.position
      for (let i = 0; i < POOL; i += 1) pieces[i].on = false
      // Chunky tufts of grass popping up and out all round, in the turf's greens.
      for (let i = 0; i < tufts; i += 1) {
        const c = pieces[i]
        const a = (i / tufts) * Math.PI * 2 + Math.random() * 0.5
        launch(c, _at.set(at.x + Math.cos(a) * 0.5, at.y + 0.15, at.z + Math.sin(a) * 0.5), a, (2 + Math.random() * 4) * (0.7 + 0.5 * power), (5 + Math.random() * 6) * (0.75 + 0.45 * power))
        c.spin = (Math.random() - 0.5) * 12
        const k = (0.16 + Math.random() * 0.12) * (0.85 + 0.4 * power)
        c.size.set(k, k * 0.75, k)
        spray.setColorAt(i, i % 3 === 0 ? _turfLight : i % 3 === 1 ? _turf : _turfDark)
      }
      // A few clods of soil, lower and heavier.
      for (let j = 0; j < clods; j += 1) {
        const i = TUFTS + j
        const c = pieces[i]
        const a = (j / clods) * Math.PI * 2 + Math.random() * 0.8
        launch(c, _at.set(at.x, at.y + 0.15, at.z), a, 1.5 + Math.random() * 3 * (0.6 + 0.6 * power), 4 + Math.random() * 4)
        c.spin = (Math.random() - 0.5) * 10
        const k = 0.13 + Math.random() * 0.12 * (0.7 + 0.6 * power)
        c.size.set(k, k * 0.8, k)
        spray.setColorAt(i, j % 2 ? SOIL : SOIL_DARK)
      }
      // The divot: a slab of turf thrown up, flipping over once, landing upside down a
      // little way back towards the kicker.
      const d = pieces[DIVOT]
      launch(d, _at.set(at.x + 0.3, at.y + 0.15, at.z + 0.6), Math.PI / 2 + (Math.random() - 0.5) * 0.6, 2.2 + power * 1.5, 7 + power * 3)
      d.axis.set(1, 0, 0)
      d.angle = 0
      d.spin = Math.PI / ((2 * (7 + power * 3)) / GRAVITY)
      d.bounces = 0
      d.size.set(0.8 + power * 0.3, 0.12, 0.55 + power * 0.2)
      spray.setColorAt(DIVOT, _turfDark)
      // Broken slabs of the stage bursting up round the crater's rim, tilted out.
      const slabs = full ? SLABS : SLABS_LOW
      const rim = size * 0.36
      for (let j = 0; j < slabs; j += 1) {
        const c = pieces[SLAB0 + j]
        c.on = true
        c.restAt = -1
        c.angle = (j / slabs) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
        c.spin = 0.3 + Math.random() * 0.3 + power * 0.18
        c.pos.set(at.x + Math.cos(c.angle) * rim, at.y, at.z + Math.sin(c.angle) * rim)
        const k = (0.75 + Math.random() * 0.45) * (0.85 + 0.45 * power)
        c.size.set(k * 1.5, 0.16 + 0.06 * power, k * (1.1 + Math.random() * 0.5))
        spray.setColorAt(SLAB0 + j, j % 3 === 0 ? _turfDark : _turfLight)
      }
      for (let i = 0; i < POOL; i += 1) if (!pieces[i].on) spray.setMatrixAt(i, ZERO)
      spray.instanceColor.needsUpdate = true
      // A light puff of grass dust where it hit.
      fireBurst(at.x, at.y + 0.3, at.z, 'turf')
    }

    splash.material.uniforms.uAge.value = (now - roll.impactAt) / 1000

    const age = (now - st.sprayAt) / 1000
    let alive = false
    for (let i = 0; i < POOL; i += 1) {
      const c = pieces[i]
      if (!c.on) continue
      if (i >= SLAB0) {
        // A slab: bursts up out of the ground in a blink, tilting out from the crater with
        // a little overshoot, stays there while the result shows, then sinks away.
        if (age > SLAB_LIFE) {
          c.on = false
          spray.setMatrixAt(i, ZERO)
          continue
        }
        alive = true
        const up = Math.min(1, age / 0.14)
        const settle = 1 + 0.1 * Math.sin(Math.min(1, age / 0.3) * Math.PI) * (1 - Math.min(1, age / 0.3))
        const tilt = c.spin * (1 - (1 - up) * (1 - up)) * settle
        const sink = Math.max(0, (age - (SLAB_LIFE - 0.6)) / 0.6)
        const radial = c.size.x
        _tangent.set(-Math.sin(c.angle), 0, Math.cos(c.angle))
        _yaw.setFromAxisAngle(_upAxis, -c.angle)
        _q.copy(_tilt.setFromAxisAngle(_tangent, tilt)).multiply(_yaw)
        // The inner edge stays down in the ground; the outer edge lifts.
        _at.set(c.pos.x + Math.cos(c.angle) * Math.cos(tilt) * radial * 0.5, c.pos.y + Math.sin(tilt) * radial * 0.5 - 0.06 - sink * radial * 0.8, c.pos.z + Math.sin(c.angle) * Math.cos(tilt) * radial * 0.5)
        spray.setMatrixAt(i, _m.compose(_at, _q, _s.copy(c.size)))
        continue
      }
      // Gone: a while after it came to rest (the divot lies there a little longer).
      const linger = i === DIVOT ? 1.2 : VANISH
      if (age > MAX_LIFE || (c.restAt >= 0 && age > c.restAt + linger)) {
        c.on = false
        spray.setMatrixAt(i, ZERO)
        continue
      }
      alive = true
      if (c.restAt < 0) {
        c.vel.y -= GRAVITY * dt
        c.pos.addScaledVector(c.vel, dt)
        c.angle += c.spin * dt
        const floor = slopeY(c.pos.z) + c.size.y * 0.5
        if (c.pos.y < floor) {
          c.pos.y = floor
          if (c.bounces > 0) {
            // One little hop, then it settles.
            c.bounces -= 1
            c.vel.set(c.vel.x * 0.45, Math.abs(c.vel.y) * 0.3, c.vel.z * 0.45)
            c.spin *= 0.5
          } else {
            c.restAt = age
            // The divot lands flat, upside down.
            if (i === DIVOT) c.angle = Math.PI
          }
        }
      }
      // Popping away once it has settled: a quick shrink to nothing.
      const shrink = c.restAt < 0 ? 1 : Math.max(0, 1 - (age - c.restAt - (linger - VANISH)) / VANISH)
      _q.setFromAxisAngle(c.axis, c.angle)
      spray.setMatrixAt(i, _m.compose(c.pos, _q, _s.copy(c.size).multiplyScalar(Math.min(1, shrink))))
    }
    spray.count = alive ? POOL : 0
    if (alive) spray.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <primitive ref={splashRef} object={assets.splash} />
      <primitive ref={sprayRef} object={assets.spray} />
    </>
  )
}
