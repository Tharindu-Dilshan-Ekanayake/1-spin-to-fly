/**
 * The ad safe zone. While a panel is open the Boxity portal lays its screen ads over the
 * game (integration.js tells it 'panel'): a box or skyscraper at each side, middle-left and
 * middle-right, and a banner along the bottom. The SDK says whether those ads are up (the
 * screen handle's state) but not where, so while they are pending or showing we reserve
 * the largest slot the portal can put in each place for this viewport (sizes from the
 * SDK: 300x250 / 300x600 / 160x600 at the sides, 728x90 / 320x50 / 320x100 at the bottom)
 * as CSS variables on the root - --ad-x (each side), --ad-bottom, --ad-top - and Panel.jsx
 * keeps every popup inside what's left, scaled down to fit. The bottom banner's strip is
 * kept free all the time (the banner can arrive a moment after a popup opens, and a popup
 * should never jump); the sides only while the ads are up.
 */

/** Gap kept between an ad and the popup. */
const GAP = 12

let active = false
/** Debug only (`window.__pp.adSafeZone(true)`): reserve the space as if the ads were up. */
let forced = false
let unsubscribe = null

function insetsFor(width, height) {
  // Side ads only go where they leave the middle room: 300 wide on a wide screen, the
  // 160 wide skyscraper on a mid one, none on a phone.
  const side = width >= 1100 ? 300 : width >= 760 && height >= 600 ? 160 : 0
  // A 728x90 leaderboard banner where it fits, else a phone banner (up to 320x100).
  const bottom = width >= 760 ? 90 : height >= 560 ? 100 : 50
  return { x: side ? side + GAP : 0, bottom: bottom + GAP, top: 0 }
}

function apply() {
  const root = document.documentElement.style
  const full = insetsFor(window.innerWidth, window.innerHeight)
  const inset = active || forced ? full : { x: 0, bottom: full.bottom, top: 0 }
  root.setProperty('--ad-x', `${inset.x}px`)
  root.setProperty('--ad-bottom', `${inset.bottom}px`)
  root.setProperty('--ad-top', `${inset.top}px`)
}

/** Reserves (or releases) the ads' space. */
export function setAdSafeZone(on) {
  if (on === active) return
  active = on
  listen()
}

/** Debug: keeps the space reserved whatever the ads do, to preview popups round them. */
export function forceAdSafeZone(on) {
  forced = Boolean(on)
  listen()
}

function listen() {
  apply()
}

// The bottom strip is reserved from the start, and follows the window's size.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', apply)
  apply()
}

/**
 * Follows the portal's screen ads for `type` through the SDK's screen handle: the space is
 * reserved on the 'panel' screen while the ads are pending or showing, released when they
 * close (none to fill, ads disabled, or not inside the portal at all).
 */
export function trackScreenAds(type, handle) {
  if (typeof unsubscribe === 'function') unsubscribe()
  unsubscribe = null
  if (type !== 'panel' || !handle) {
    setAdSafeZone(false)
    return
  }
  setAdSafeZone(handle.state !== 'closed')
  try {
    unsubscribe = handle.onStateChange?.((state) => setAdSafeZone(state !== 'closed')) ?? null
  } catch {
    unsubscribe = null
  }
}
