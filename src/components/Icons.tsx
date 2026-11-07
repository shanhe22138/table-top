import type { ReactNode } from 'react'
import { Image } from '@tarojs/components'
import { renderToStaticMarkup } from 'react-dom/server'
import { IS_MINI } from '../lib/platform'

const P: Record<string, ReactNode> = {
  calendar: (
    <>
      <path d="M8 2v4M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2.5" />
      <path d="M3 10h18" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13A4 4 0 0 1 16 11" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  star: (
    <path d="M12 3.2l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.6l6.1-.8z" />
  ),
  left: <path d="M15 18l-6-6 6-6" />,
  right: <path d="M9 18l6-6-6-6" />,
  down: <path d="M6 9l6 6 6-6" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.6 6.2A9.4 9.4 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3.3 3.9" />
      <path d="M6.4 8.1A16.6 16.6 0 0 0 2.5 12S6 18.2 12 18.2c1.2 0 2.3-.2 3.3-.6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.6 7.6l2 1.2M17.4 15.2l2 1.2M4.6 16.4l2-1.2M17.4 8.8l2-1.2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.4" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12.5V4.5A1.5 1.5 0 0 1 4.5 3h8L21 11.5 12.5 20 3 12.5z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </>
  ),
  share: (
    <>
      <path d="M4 12.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6.5" />
      <path d="M16 6.5L12 2.5 8 6.5" />
      <path d="M12 2.5v13" />
    </>
  ),
  close: <path d="M18 6L6 18M6 6l12 12" />,
  check: <path d="M20 6L9 17l-5-5" />,
  trash: (
    <>
      <path d="M3.5 6h17" />
      <path d="M8.5 6V4.2A1.2 1.2 0 0 1 9.7 3h4.6a1.2 1.2 0 0 1 1.2 1.2V6" />
      <path d="M18.5 6l-1 13.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5.5 6" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  filter: <path d="M3 5.5h18M6.5 12h11M10 18.5h4" />,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.6 3.6a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
      <path d="M16 16.5l4.5-4.5L16 7.5" />
      <path d="M20.5 12H9" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  dice: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M8.5 15.5h.01M15.5 15.5h.01M12 12h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z" />
      <path d="M4 17.5h15" />
    </>
  ),
  quote: (
    <>
      <path d="M9 6.5C6.5 8 5 10.2 5 13c0 2.2 1.2 3.6 3 3.6 1.6 0 2.8-1.1 2.8-2.7 0-1.5-1-2.6-2.5-2.6-.3 0-.5 0-.7.1.2-1.4 1.1-2.6 2.4-3.4z" />
      <path d="M19 6.5C16.5 8 15 10.2 15 13c0 2.2 1.2 3.6 3 3.6 1.6 0 2.8-1.1 2.8-2.7 0-1.5-1-2.6-2.5-2.6-.3 0-.5 0-.7.1.2-1.4 1.1-2.6 2.4-3.4z" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.4-2.4a4.5 4.5 0 0 0-6.4-6.4L11.5 6" />
      <path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.4 2.4a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  sparkle: (
    <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  chevronUp: <path d="M6 15l6-6 6 6" />,
  home: (
    <>
      <path d="M3.5 10.5L12 3l8.5 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </>
  ),
  heart: (
    <path d="M12 20.5s-7.3-4.7-9.7-9.1C.8 8.2 2.5 4.5 6.1 4.5c2.1 0 3.4 1.3 4.1 2.4.7-1.1 2-2.4 4.1-2.4 3.6 0 5.3 3.7 3.8 6.9C18.3 15.8 12 20.5 12 20.5z" />
  ),
  comment: (
    <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.5-4.6a8.2 8.2 0 0 1-1-4A8.4 8.4 0 0 1 12 3.5a8.4 8.4 0 0 1 9 8z" />
  ),
}

export type IconName = keyof typeof P

export function Icon({
  name,
  size = 18,
  className = '',
  strokeWidth = 1.7,
  fill = 'none',
}: {
  name: IconName | string
  size?: number
  className?: string
  strokeWidth?: number
  fill?: string
}) {
  const content = P[name] ?? null
  if (IS_MINI) {
    const color = className.includes('text-brass') ? '#e2a85a'
      : className.includes('text-seal') ? '#c4563c'
        : className.includes('text-paper') ? '#f4efe9'
          : className.includes('text-jade') ? '#5fa88b' : '#a2968c'
    const svg = renderToStaticMarkup(
      <svg viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round">{content}</svg>,
    ).replace(/currentColor/g, color)
    return <Image src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      style={{ width: size, height: size }} className={className} />
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  )
}
