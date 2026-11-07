import { useEffect, useState } from 'react'
import type { GameKind } from '../types'
import { IS_BROWSER, scrollToTop } from './platform'

let miniHash = ''
const miniListeners = new Set<() => void>()

export type Route =
  | { name: 'calendar'; date: string | null }
  | { name: 'library'; kind: GameKind | null }
  | { name: 'game'; id: string }
  | { name: 'event'; id: string }
  | { name: 'create'; gameId: string | null }
  | { name: 'me'; tab: string | null }
  | { name: 'user'; id: string }
  | { name: 'search'; q: string | null }
  | { name: 'platform' }
  | { name: 'login'; next: string | null }
  | { name: 'admin'; tab: string | null }
  | { name: 'join'; code: string }

function queryParams(raw: string) {
  const params = new Map<string, string>()
  for (const pair of raw.split('&').filter(Boolean)) {
    const [key, value = ''] = pair.split('=')
    params.set(decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' ')))
  }
  return { get: (key: string) => params.get(key) ?? null }
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#/, '')
  const [pathPart, queryPart] = clean.split('?')
  const segs = pathPart.split('/').filter(Boolean)
  const params = queryParams(queryPart ?? '')

  switch (segs[0]) {
    case undefined:
    case '':
    case 'calendar':
      return { name: 'calendar', date: normalizeDate(params.get('d')) }
    case 'library':
    case 'store': {
      const k = params.get('kind')
      return { name: 'library', kind: k === 'script' || k === 'board' ? k : null }
    }
    case 'game':
      return segs[1] ? { name: 'game', id: segs[1] } : { name: 'library', kind: null }
    case 'event':
      return segs[1] ? { name: 'event', id: segs[1] } : { name: 'calendar', date: null }
    case 'create':
      return { name: 'create', gameId: params.get('game') }
    case 'me':
      return { name: 'me', tab: params.get('tab') }
    case 'u':
      return segs[1] ? { name: 'user', id: segs[1] } : { name: 'me', tab: null }
    case 'search':
      return { name: 'search', q: params.get('q') }
    case 'platform':
      return { name: 'platform' }
    case 'login':
      return { name: 'login', next: params.get('next') }
    case 'admin':
      return { name: 'admin', tab: params.get('tab') }
    case 'join':
      return segs[1] ? { name: 'join', code: segs[1] } : { name: 'calendar', date: null }
    default:
      return { name: 'calendar', date: null }
  }
}

/** 只接受 YYYY-MM-DD，其他一律当作没传 */
function normalizeDate(raw: string | null): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : raw
}

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  const target = `#${to.startsWith('/') ? to : `/${to}`}`
  if (IS_BROWSER) {
    if (location.hash === target) return
    if (opts.replace) history.replaceState(null, '', target)
    else location.hash = target
  } else {
    if (miniHash === target) return
    miniHash = target
    miniListeners.forEach((listener) => listener())
  }
  if (!opts.keepScroll) scrollToTop()
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(IS_BROWSER ? location.hash : miniHash))
  useEffect(() => {
    const onChange = () => setRoute(parse(IS_BROWSER ? location.hash : miniHash))
    if (IS_BROWSER) {
      window.addEventListener('hashchange', onChange)
      return () => window.removeEventListener('hashchange', onChange)
    }
    miniListeners.add(onChange)
    return () => { miniListeners.delete(onChange) }
  }, [])
  return route
}

export function href(to: string) {
  return `#${to.startsWith('/') ? to : `/${to}`}`
}
