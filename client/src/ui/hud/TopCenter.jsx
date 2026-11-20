import { rebirthMultiplier, TUTORIAL } from '@shared/balance'
import { formatDistance, formatNumber } from '@shared/format'
import { isMaxLevel, nextTire, zoneIndexAt } from '@shared/logic'

import { zones } from '../../game/worldLook'

import { useGame } from '../../store/game'
import { useCallback, useEffect, useRef, useState } from 'react'

import StrokeText from '../StrokeText'
import { u } from './style'

/** The goal banner shows this long, then hides until it's due again. */
const SHOW_MS = 8000
/** It comes back this often. */
const EVERY_MS = 60000

const BANNER_GRADIENT = 'linear-gradient(180deg, #fff6a8 0%, #ffd52a 45%, #ffa000 100%)'
const PANEL_GRADIENT = 'linear-gradient(180deg, #ffe45c 0%, #ffc21f 55%, #ff9a12 100%)'

/**
 * The tutorial for brand-new players: run, kick, buy a ball - then it's gone for good.
 * A small strip, "1/3" and the step with its progress ("(16/30)"), so the world stays in
 * view; the 3D arrows (TutorialArrows) show where to go.
 */
function TutorialBanner({ step }) {
  const current = TUTORIAL[step]
  const health = useGame((s) => s.profile.health)
  const onZone = useGame((s) => s.zone.rollZone)
  let text = current.text
  if (current.health) text += ` (${formatNumber(Math.min(health, current.health))}/${formatNumber(current.health)})`
  if (current.event === 'roll' && onZone) text = 'Pull BACK to stretch, then let go of the stick!'
  return (
    <div
      className="flex items-center"
      style={{
        gap: u(14),
        padding: `${u(6)} ${u(22)} ${u(6)} ${u(8)}`,
        borderRadius: u(30),
        border: `${u(4)} solid #111`,
        background: PANEL_GRADIENT,
        boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.3), inset 0 ${u(4)} 0 rgba(255,255,255,0.45)`,
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{ minWidth: u(64), height: u(44), borderRadius: u(22), background: '#111', fontSize: u(26) }}
      >
        <StrokeText stroke={u(5)} gradient={BANNER_GRADIENT}>
          {step + 1}/{TUTORIAL.length}
        </StrokeText>
      </span>
      <span style={{ fontSize: u(34) }}>
        <StrokeText stroke={u(7)} style={{ whiteSpace: 'normal' }}>
          {text}
        </StrokeText>
      </span>
    </div>
  )
}

/**
 * The next goal once the tutorial's done - something close enough to chase: rebirth when
 * you're at max level, else the next pair of arms and how far your Cash is from it, else
 * the next stage down the runway past your best flight. A tap opens what it's about.
 *
 * It isn't always on screen: it slides in for SHOW_MS, slides away, and comes back every
 * EVERY_MS - and straight away when there's news (you can afford the next arms, or you
 * can rebirth).
 */
function GoalBanner() {
  const profile = useGame((s) => s.profile)
  const pending = useGame((s) => s.pendingWins)
  const openPanel = useGame((s) => s.openPanel)
  let text
  let progress = null
  let panel = null
  /** What the goal is (not its progress): news when it changes to one you can act on. */
  let goal
  if (isMaxLevel(profile)) {
    goal = `rebirth:${profile.rebirths}`
    text = `REBIRTH READY! Rebirth for x${rebirthMultiplier(profile.rebirths + 1)} Strength`
    panel = 'rebirth'
  } else {
    const next = nextTire(profile)
    if (next) {
      const wins = Math.max(0, profile.wins - pending)
      goal = wins >= next.cost ? `buy:${next.id}` : `arms:${next.id}`
      text = wins >= next.cost ? `You can buy ${next.name}! Visit the Arm Shop` : `Next arms: ${next.name}`
      progress = Math.min(1, wins / Math.max(1, next.cost))
      if (wins < next.cost) text += ` ($${formatNumber(wins)}/$${formatNumber(next.cost)})`
    } else {
      const stages = zones()
      const nextStage = stages[Math.min(stages.length - 1, zoneIndexAt(profile.stats.bestDistance) + 1)]
      goal = `stage:${nextStage.id}`
      text = `Next stage: ${nextStage.name} at ${formatDistance(nextStage.start)} (best ${formatDistance(profile.stats.bestDistance)})`
      progress = Math.min(1, profile.stats.bestDistance / Math.max(1, nextStage.start))
    }
  }
  const [shown, setShown] = useState(true)
  const hideTimer = useRef(0)
  // Shows the banner for SHOW_MS (restarting the count if it's up already).
  const showFor = useCallback(() => {
    setShown(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShown(false), SHOW_MS)
  }, [])
  useEffect(() => {
    const first = setTimeout(showFor, 0)
    const every = setInterval(showFor, EVERY_MS)
    return () => {
      clearTimeout(first)
      clearInterval(every)
      clearTimeout(hideTimer.current)
    }
  }, [showFor])
  // News: you can afford the next arms, or rebirth - show it now, not in a minute.
  const lastGoal = useRef(goal)
  useEffect(() => {
    if (goal === lastGoal.current) return undefined
    lastGoal.current = goal
    if (!goal.startsWith('buy:') && !goal.startsWith('rebirth:')) return undefined
    const id = setTimeout(showFor, 0)
    return () => clearTimeout(id)
  }, [goal, showFor])

  return (
    <button
      type="button"
      onClick={panel ? () => openPanel(panel) : undefined}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      className={`${panel && shown ? 'pp-btn pointer-events-auto' : ''} relative flex flex-col items-center overflow-hidden`}
      style={{
        transform: shown ? 'translateY(0)' : `translateY(${u(-200)})`,
        opacity: shown ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.3s',
        padding: `${u(6)} ${u(24)} ${u(progress === null ? 6 : 14)}`,
        borderRadius: u(30),
        border: `${u(4)} solid #111`,
        background: panel ? 'linear-gradient(180deg, #b4efff 0%, #4cb8ff 50%, #2477e8 100%)' : PANEL_GRADIENT,
        boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.3), inset 0 ${u(4)} 0 rgba(255,255,255,0.45)`,
      }}
    >
      <span style={{ fontSize: u(32) }}>
        <StrokeText stroke={u(7)} style={{ whiteSpace: 'normal' }}>
          {text}
        </StrokeText>
      </span>
      {progress !== null && (
        <span className="absolute bottom-0 left-0 right-0" style={{ height: u(8), background: 'rgba(0,0,0,0.35)' }}>
          <span className="block h-full origin-left" style={{ transform: `scaleX(${progress})`, background: '#3fe05a' }} />
        </span>
      )}
    </button>
  )
}

/**
 * Top centre: the tutorial while there is one, then the next goal (GoalBanner). (The
 * playtime gift lives on the left menu: GiftTile.)
 */
export function TopCenter() {
  const step = useGame((s) => s.profile.tutorialStep)
  return (
    <div className="hud-topcenter pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ width: 'max-content', maxWidth: '90vw' }}>
      {TUTORIAL[step] ? <TutorialBanner step={step} /> : <GoalBanner />}
    </div>
  )
}

export default TopCenter
