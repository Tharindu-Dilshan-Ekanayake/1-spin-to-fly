import { useCallback, useEffect, useRef, useState } from 'react'

import { HIT_GRADES, hitGrade, hitReach } from '@shared/balance'
import { formatDistance } from '@shared/format'
import { rollOutcome } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { cancelPull, grab, launch, letGo } from '../../game/launch'
import { setText } from '../../game/roll/hudLink'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/** With Auto Launch on, the next launch starts this long after you're back at the bar. */
const AUTO_DELAY_MS = 700
/** Auto Launch lets go after spinning this long (a plain launch, no meter). */
const AUTO_HOLD_MS = 1300
/** A tap is ignored this soon after the last (a double tap, a bouncing key). */
const PRESS_COOLDOWN_MS = 250
/** The first tap can't come this soon after grabbing: the tap that grabbed isn't a fly. */
const GRAB_GRACE_MS = 220

/** Meter height in reference px: tall enough to read from the corner of your eye. */
const METER_H = 520
const METER_W = 112
/** Each grade's colour, for the live tag beside the marker. */
const GRADE_COLORS = { perfect: '#7dff4a', great: '#d9ff4a', good: '#ffb21f', weak: '#ff6a5a' }
/** The grade lines across the meter (each grade's lower edge). */
const LINES = HIT_GRADES.filter((g) => g.min > 0).map((g) => g.min)

/**
 * The SPIN BAR's HUD. By the bar a SPIN button shows: press it (or E / Enter) and you jump
 * up, grab the bar and start whirling round it - walking under it does nothing by itself. A
 * tall meter stands beside you - green at the top, red at the bottom - and a white marker
 * runs up and down it; the higher it is, the faster you spin. The LAUNCH button (or Space,
 * E, Enter) lets go - nothing else does:
 * the higher the marker, the further you fly and the more it pays (HIT_GRADES) - the tag
 * by the marker says how far you'd fly right now. CANCEL (or Esc) drops you off the bar.
 * With the Auto Launch pass a toggle under it grabs, spins and lets go for you every time
 * you're back (a plain launch, no meter).
 *
 * The marker is moved straight on the DOM every animation frame (the player keeps
 * launch.charge up to date); React only hears about grabbing and letting go.
 */
export function RollButton() {
  const near = useGame((s) => s.zone.atPosts && !s.roll && !s.rollResult && !s.panel)
  const ownsAuto = useGame((s) => Boolean(s.profile.passes.autoRoll))
  const autoOn = useGame((s) => Boolean(s.profile.passes.autoRoll && s.profile.settings.autoRoll))
  /** On the bar right now (mirrors launch.gripping for React). */
  const [gripping, setGripping] = useState(false)
  const [auto, setAuto] = useState(false)
  const lastPress = useRef(-Infinity)
  const markerRef = useRef(null)
  const tagRef = useRef(null)
  const visible = near || gripping

  const doGrab = useCallback((byAuto = false) => {
    if (launch.gripping || launch.released) return
    grab(byAuto)
    sfx.stretchStart()
    setGripping(true)
    setAuto(byAuto)
  }, [])

  /** Lets go; `plain` sends no meter reading (Auto Launch). */
  const doLetGo = useCallback((plain = false) => {
    if (!launch.gripping) return
    const charge = letGo()
    sfx.stretchStop()
    setGripping(false)
    setAuto(false)
    actions.roll(plain ? undefined : Math.round(charge * 1000) / 1000)
  }, [])

  const doCancel = useCallback(() => {
    if (!launch.gripping) return
    cancelPull()
    sfx.stretchStop()
    setGripping(false)
    setAuto(false)
  }, [])

  /** One tap: grab the bar if you're by it, fly if you're on it. */
  const press = useCallback(() => {
    const now = performance.now()
    if (now - lastPress.current < PRESS_COOLDOWN_MS) return
    if (launch.gripping && now - launch.grabbedAt < GRAB_GRACE_MS) return
    lastPress.current = now
    if (launch.gripping) doLetGo()
    else doGrab()
  }, [doGrab, doLetGo])

  // You can also grab the bar by walking under it (Player.jsx): keep the HUD in step.
  useEffect(() => {
    if (!visible) return undefined
    const id = setInterval(() => {
      setGripping(launch.gripping)
      setAuto(launch.auto)
    }, 80)
    return () => clearInterval(id)
  }, [visible])

  // A panel opened or the launch started: drop off the bar.
  const panel = useGame((s) => s.panel)
  const rolling = useGame((s) => Boolean(s.roll))
  const [blocked, setBlocked] = useState(false)
  if (Boolean(panel || rolling) !== blocked) {
    setBlocked(Boolean(panel || rolling))
    if (panel || rolling) {
      setGripping(false)
      setAuto(false)
    }
  }
  useEffect(() => {
    if (!blocked || !launch.gripping) return
    cancelPull()
    sfx.stretchStop()
  }, [blocked])

  useEffect(() => {
    if (!visible) return undefined
    const onKey = (e) => {
      if (e.repeat) return
      if (e.code === 'KeyE' || e.code === 'Enter' || (e.code === 'Space' && launch.gripping)) {
        e.preventDefault()
        press()
      } else if (e.code === 'Escape' && launch.gripping) doCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, press, doCancel])

  // While you're spinning (not on Auto Launch) the page knows it: the pass buttons, the
  // joystick and the jump button step aside (index.css body.pp-spinning) - none of them
  // do anything on the bar, and on a phone they'd cover the meter and TAP TO FLY.
  const spinning = gripping && !auto
  useEffect(() => {
    if (!spinning) return undefined
    document.body.classList.add('pp-spinning')
    return () => document.body.classList.remove('pp-spinning')
  }, [spinning])

  // Auto Launch: grab and spin by itself every time you're back at the bar.
  useEffect(() => {
    if (!near || !autoOn || gripping) return undefined
    const id = setTimeout(() => doGrab(true), AUTO_DELAY_MS)
    return () => clearTimeout(id)
  }, [near, autoOn, gripping, doGrab])

  // The marker, every frame, while spinning (and the spin sound with it).
  useEffect(() => {
    if (!gripping) return undefined
    let raf = 0
    let shownTag = ''
    const health = getGame().profile.health
    const tick = () => {
      if (!launch.gripping) {
        sfx.stretchStop()
        setGripping(false)
        setAuto(false)
        return
      }
      const charge = launch.charge
      sfx.stretchSet(charge, launch.rate)
      if (auto && performance.now() - launch.grabbedAt > AUTO_HOLD_MS) {
        doLetGo(true)
        return
      }
      if (markerRef.current) markerRef.current.style.transform = `translateY(${(1 - charge) * 100}%)`
      // How far letting go right now would fling you, in the grade's colour.
      const grade = hitGrade(charge)
      const tag = formatDistance(Math.round(rollOutcome(health, hitReach(charge)).distance))
      if (tag !== shownTag && tagRef.current) {
        shownTag = tag
        for (const layer of tagRef.current.querySelectorAll('.pp-text-stroke, .pp-text-fill')) setText(layer, tag)
        const fill = tagRef.current.querySelector('.pp-text-fill')
        if (fill) fill.style.color = GRADE_COLORS[grade.id]
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [gripping, auto, doLetGo])

  if (!visible) return null
  if (gripping && !auto) {
    return (
      <>
        {/* The meter, beside you: green at the top, red at the bottom. */}
        <div className="hud-spin-meter pointer-events-none absolute" style={{ width: u(METER_W), height: u(METER_H) }}>
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ top: u(-62), fontSize: u(40) }}>
            <StrokeText stroke={u(9)}>SPEED</StrokeText>
          </span>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              borderRadius: u(METER_W / 2),
              border: `${u(8)} solid #14161c`,
              background: 'linear-gradient(180deg, #7dff6a 0%, #b8f04a 22%, #ffe14a 45%, #ffa83a 70%, #ff6a5a 100%)',
              boxShadow: `0 ${u(8)} 0 rgba(0,0,0,0.35), inset ${u(10)} 0 ${u(14)} rgba(255,255,255,0.45)`,
            }}
          >
            {LINES.map((min) => (
              <div key={min} className="absolute left-0 right-0" style={{ top: `${(1 - min) * 100}%`, height: u(6), background: '#14161c', opacity: 0.85 }} />
            ))}
          </div>
          {/* The marker: its track runs the meter's height, the pill rides it. */}
          <div ref={markerRef} className="absolute left-0 right-0" style={{ top: 0, height: '100%', transform: 'translateY(100%)', willChange: 'transform' }}>
            <div className="absolute flex flex-row-reverse items-center" style={{ top: u(-22), right: u(-26), height: u(44) }}>
              <div
                style={{
                  width: u(METER_W + 52),
                  height: u(40),
                  borderRadius: u(20),
                  background: 'linear-gradient(180deg, #ffffff 0%, #e9eef5 60%, #c4ccd8 100%)',
                  border: `${u(6)} solid #14161c`,
                  boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.3)`,
                }}
              />
              <span ref={tagRef} className="whitespace-nowrap" style={{ fontSize: u(54), marginRight: u(12) }}>
                <StrokeText stroke={u(11)}>0 m</StrokeText>
              </span>
            </div>
          </div>
        </div>
        {/* Above the level bar and the Strength readout, clear of both. */}
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(290) }}>
          {/* Only this launches you: spin up, watch the meter, press it at the top. */}
          <span className="pp-tap-fly">
            <ChunkyButton
              gradient={GRADIENTS.greenButton}
              onPointerDown={(e) => {
                e.stopPropagation()
                press()
              }}
              title="Launch"
              radius={22}
              border={6}
              className="pp-roll-btn"
              style={{ height: u(130), padding: `0 ${u(70)}` }}
            >
              <span style={{ fontSize: u(84) }}>
                <StrokeText stroke={u(15)}>LAUNCH!</StrokeText>
              </span>
            </ChunkyButton>
          </span>
          <ChunkyButton
            gradient={GRADIENTS.redButton}
            onPointerDown={(e) => {
              e.stopPropagation()
              doCancel()
            }}
            title="Cancel"
            radius={14}
            border={5}
            style={{ height: u(78), padding: `0 ${u(40)}`, marginTop: u(18) }}
          >
            <span style={{ fontSize: u(44) }}>
              <StrokeText stroke={u(9)}>CANCEL</StrokeText>
            </span>
          </ChunkyButton>
        </div>
      </>
    )
  }
  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(300) }}>
      {!gripping && (
        <>
          <ChunkyButton
            gradient={GRADIENTS.greenButton}
            onPointerDown={(e) => {
              e.stopPropagation()
              press()
            }}
            title="Spin"
            radius={18}
            border={5}
            className="pp-roll-btn"
            style={{ height: u(104), padding: `0 ${u(56)}` }}
          >
            <span style={{ fontSize: u(64) }}>
              <StrokeText stroke={u(12)}>SPIN!</StrokeText>
            </span>
          </ChunkyButton>
          <span style={{ fontSize: u(32), marginTop: u(10) }}>
            <StrokeText stroke={u(7)}>Press SPIN to grab the bar!</StrokeText>
          </span>
        </>
      )}
      {ownsAuto && (
        <ChunkyButton
          gradient={autoOn ? GRADIENTS.goldButton : GRADIENTS.greyButton}
          onClick={() => actions.setSetting('autoRoll', !autoOn)}
          title="Auto Launch"
          radius={10}
          border={4}
          style={{ height: u(56), padding: `0 ${u(20)}`, marginTop: u(12) }}
        >
          <span style={{ fontSize: u(32) }}>
            <StrokeText stroke={u(7)}>Auto Launch: {autoOn ? 'ON' : 'OFF'}</StrokeText>
          </span>
        </ChunkyButton>
      )}
    </div>
  )
}

export default RollButton
