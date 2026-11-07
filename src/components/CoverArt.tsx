import type { Game } from '../types'
import { Image } from '@tarojs/components'
import { renderToStaticMarkup } from 'react-dom/server'
import { IS_MINI } from '../lib/platform'

function hashStr(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const SCRIPT_PALETTES = [
  ['#1a1215', '#33202a', '#c4563c'],
  ['#11161a', '#1c2b33', '#5f8fa8'],
  ['#171310', '#2c2317', '#e2a85a'],
  ['#141017', '#2a1e33', '#8f6fb0'],
  ['#101613', '#1b2b24', '#5fa88b'],
]

const BOARD_PALETTES = [
  ['#0f1512', '#1c2a22', '#5fa88b'],
  ['#151013', '#2a1a22', '#c4563c'],
  ['#101318', '#1d2530', '#6f8fc0'],
  ['#151310', '#2b251a', '#e2a85a'],
  ['#131215', '#232030', '#9b8fd0'],
]

function ScriptPattern({ v, accent }: { v: number; accent: string }) {
  if (v === 0) {
    return (
      <g stroke={accent} fill="none">
        <circle cx="206" cy="104" r="58" strokeWidth="1.1" opacity="0.55" />
        <circle cx="206" cy="104" r="40" strokeWidth="0.8" opacity="0.3" />
        <path d="M148 104a58 58 0 0 1 58-58" strokeWidth="1.6" opacity="0.75" />
        <path d="M0 296c58-26 96 22 150 4s96-38 150-10" strokeWidth="1.2" opacity="0.4" />
        <path d="M0 320c58-26 96 22 150 4s96-38 150-10" strokeWidth="1.2" opacity="0.22" />
      </g>
    )
  }
  if (v === 1) {
    return (
      <g stroke={accent} opacity="0.4">
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={i}
            x1={14 + i * 19}
            y1={30 + ((i * 37) % 60)}
            x2={14 + i * 19}
            y2={250 + ((i * 53) % 90)}
            strokeWidth={i % 3 === 0 ? 1.6 : 0.7}
          />
        ))}
        <circle cx="228" cy="300" r="34" fill="none" strokeWidth="1.1" opacity="0.8" />
      </g>
    )
  }
  if (v === 2) {
    return (
      <g stroke={accent} fill="none" opacity="0.42">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={54 + i * 20}
            y={62 + i * 20}
            width={192 - i * 40}
            height={264 - i * 40}
            rx={12 + i * 6}
            strokeWidth={i === 0 ? 1.5 : 0.8}
          />
        ))}
        <circle cx="150" cy="194" r="7" fill={accent} opacity="0.5" stroke="none" />
      </g>
    )
  }
  return (
    <g stroke={accent} opacity="0.45">
      <path d="M150 60l72 124-72 124-72-124z" fill="none" strokeWidth="1.1" />
      <path d="M150 108l42 76-42 76-42-76z" fill="none" strokeWidth="0.8" opacity="0.7" />
      {[
        [46, 92],
        [252, 130],
        [64, 300],
        [236, 306],
        [150, 342],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4} fill={accent} stroke="none" opacity="0.7" />
      ))}
    </g>
  )
}

function BoardPattern({ v, accent }: { v: number; accent: string }) {
  if (v === 0) {
    const hexes: Array<[number, number]> = []
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        hexes.push([54 + col * 66 + (row % 2 ? 33 : 0), 74 + row * 58])
      }
    }
    return (
      <g stroke={accent} fill="none" opacity="0.4">
        {hexes.map(([x, y], i) => (
          <path
            key={i}
            d={`M${x} ${y - 22}l19 11v22l-19 11-19-11v-22z`}
            strokeWidth={i % 5 === 0 ? 1.4 : 0.7}
          />
        ))}
      </g>
    )
  }
  if (v === 1) {
    return (
      <g fill={accent} opacity="0.32">
        {Array.from({ length: 42 }, (_, i) => {
          const x = 32 + (i % 7) * 40
          const y = 56 + Math.floor(i / 7) * 48
          return <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 4.5 : 2} />
        })}
      </g>
    )
  }
  if (v === 2) {
    return (
      <g stroke={accent} fill="none" opacity="0.4">
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={62 + i * 26}
            y={78 + i * 26}
            width={176 - i * 52}
            height={244 - i * 52}
            rx={4}
            transform={`rotate(${i * 8} 150 200)`}
            strokeWidth={i === 0 ? 1.5 : 0.8}
          />
        ))}
      </g>
    )
  }
  return (
    <g stroke={accent} opacity="0.38">
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1={26 + i * 8}
          y1={40 + i * 34}
          x2={274 - i * 8}
          y2={40 + i * 34}
          strokeWidth={i % 3 === 0 ? 1.6 : 0.7}
        />
      ))}
      <circle cx="150" cy="196" r="52" fill="none" strokeWidth="0.9" opacity="0.7" />
    </g>
  )
}

export function CoverArt({
  game,
  className = '',
  showSeal = true,
}: {
  game: Game
  className?: string
  /** 小尺寸缩略图里封印会糊成一个空方块，关掉更干净 */
  showSeal?: boolean
}) {
  const seed = hashStr(game.id + game.title)
  const palettes = game.kind === 'script' ? SCRIPT_PALETTES : BOARD_PALETTES
  const [c0, c1, accent] = palettes[seed % palettes.length]
  const variant = Math.floor(seed / 11) % 4
  const uid = `cv${seed % 100000}`
  const seal = game.title.slice(0, 1)

  if (game.cover) {
    return (
      <img
        src={game.cover}
        alt={game.title}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        loading="lazy"
      />
    )
  }

  const svg = (
    <svg
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c0} />
          <stop offset="1" stopColor={c1} />
        </linearGradient>
        <radialGradient id={`gl${uid}`} cx="0.72" cy="0.22" r="0.75">
          <stop offset="0" stopColor={accent} stopOpacity="0.42" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`vt${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.72" />
        </linearGradient>
      </defs>

      <rect width="300" height="400" fill={`url(#bg${uid})`} />
      <rect width="300" height="400" fill={`url(#gl${uid})`} />

      {game.kind === 'script' ? (
        <ScriptPattern v={variant} accent={accent} />
      ) : (
        <BoardPattern v={variant} accent={accent} />
      )}

      <rect width="300" height="400" fill={`url(#vt${uid})`} />

      {showSeal && (
        <g transform="translate(24 336)">
          <rect width="26" height="26" rx="3" fill="none" stroke={accent} strokeOpacity="0.55" />
          <text
            x="13"
            y="19"
            textAnchor="middle"
            fill={accent}
            fillOpacity="0.9"
            fontSize="15"
            fontFamily="'Noto Serif SC','Songti SC',serif"
          >
            {seal}
          </text>
        </g>
      )}
    </svg>
  )
  if (IS_MINI) {
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderToStaticMarkup(svg))}`
    return <Image src={source} className={`absolute inset-0 h-full w-full ${className}`} />
  }
  return svg
}
