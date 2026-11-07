import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons'
import { durationText, formatDuration } from '../lib/format'
import { readImageAsDataUrl, pickImage } from '../lib/image'
import { Slider } from '@tarojs/components'
import { IS_BROWSER, IS_MINI } from '../lib/platform'

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft'
type BtnSize = 'sm' | 'md' | 'lg'

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary:
    'bg-brass text-[#1a1206] hover:bg-[#eeb96f] active:bg-[#d09545] font-semibold shadow-[0_6px_20px_-8px_rgba(226,168,90,0.7)]',
  outline: 'border border-line2 text-paper hover:border-brassdim hover:bg-surface2',
  ghost: 'text-muted hover:text-paper hover:bg-surface2',
  soft: 'bg-surface2 text-paper hover:bg-surface3 border border-line',
  danger: 'border border-seal/40 text-seal hover:bg-seal/10',
}

const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: BtnVariant
  size?: BtnSize
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  active = false,
  onClick,
  className = '',
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] leading-none transition-colors ${
        active
          ? 'border-brass/60 bg-brass/15 text-brass'
          : 'border-line bg-surface2/60 text-muted hover:border-line2 hover:text-paper'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-surface2/70 px-2 py-0.5 text-[11px] leading-relaxed text-muted">
      {children}
    </span>
  )
}

export function Avatar({
  name,
  src,
  size = 36,
  className = '',
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const palette = ['#c4563c', '#5fa88b', '#6f8fc0', '#e2a85a', '#8f6fb0', '#c47f5a']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  const color = palette[h % palette.length]

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, background: `${color}22`, color, borderColor: `${color}55` }}
      className={`flex shrink-0 items-center justify-center rounded-full border font-display text-[0.95em] ${className}`}
    >
      {name.slice(0, 1)}
    </div>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open || !IS_BROWSER) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  // 挂到 body 上：页面根节点用了带 transform 的入场动画，会把它变成 fixed 的包含块，
  // 导致弹层相对页面而不是视口定位（手机上会被底部导航截断）。
  const content = (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-sheet relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:max-h-[85vh] sm:rounded-2xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-[17px] text-paper">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-faint">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-faint transition-colors hover:bg-surface2 hover:text-paper"
            aria-label="关闭"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
  return IS_MINI ? content : createPortal(content, document.body)
}

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{label}</span>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-seal">{error}</p>}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: string }>
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-xl border border-line bg-surface2/60 p-0.5 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] transition-colors ${
            value === o.value
              ? 'bg-surface3 text-paper shadow-sm'
              : 'text-faint hover:text-muted'
          }`}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  icon = 'info',
  title,
  desc,
  action,
}: {
  icon?: string
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface2 text-faint">
        <Icon name={icon} size={20} />
      </div>
      <p className="text-sm text-paper">{title}</p>
      {desc && <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-faint">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100))
  return (
    <span className="relative inline-flex" style={{ height: size }}>
      <span className="flex text-line2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Icon key={i} name="star" size={size} fill="currentColor" strokeWidth={0} />
        ))}
      </span>
      <span
        className="absolute inset-0 flex overflow-hidden text-brass"
        style={{ width: `${pct}%` }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Icon key={i} name="star" size={size} fill="currentColor" strokeWidth={0} />
        ))}
      </span>
    </span>
  )
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-[17px] tracking-wide text-paper">{children}</h2>
      {action}
    </div>
  )
}

/* ───────────────── 开关 ───────────────── */

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  hint?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        {label && <span className="block text-[13px] text-paper">{label}</span>}
        {hint && <span className="mt-0.5 block text-[11px] leading-relaxed text-faint">{hint}</span>}
      </span>
      <span
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brass' : 'bg-surface3'
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-ink transition-transform ${
            checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
    </button>
  )
}

/* ───────────────── 双滑块（区间） ───────────────── */

/** 气泡靠边时不溢出：贴到 0 / 100 的位置就改成左对齐或右对齐 */
function bubbleStyle(p: number): React.CSSProperties {
  if (p < 9) return { left: 0 }
  if (p > 91) return { right: 0 }
  return { left: `${p}%`, transform: 'translateX(-50%)' }
}

function RangeInput({ min, max, step, value, onChange, className, ariaLabel }: {
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  className: string
  ariaLabel: string
}) {
  if (IS_MINI) {
    return <Slider min={min} max={max} step={step} value={value} blockSize={18}
      activeColor="#e2a85a" backgroundColor="#2a2420" aria-label={ariaLabel}
      className="absolute inset-x-0 top-[30px] h-8"
      onChange={(event) => onChange(Number(event.detail.value))} />
  }
  return <input className={className} type="range" min={min} max={max} step={step} value={value}
    aria-label={ariaLabel} onChange={(event) => onChange(Number(event.target.value))} />
}

export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  format,
  labels,
}: {
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (v: [number, number]) => void
  format?: (v: number) => string
  /** [下限文案, 上限文案]，默认「最短 / 最长」 */
  labels?: [string, string]
}) {
  const [lo, hi] = value
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const fmt = (v: number) => (format ? format(v) : String(v))
  return (
    <div>
      <div className="relative h-[52px] select-none">
        {/* 两个手柄各自一个气泡，谁动谁的数 */}
        <span
          className="pointer-events-none absolute top-0 whitespace-nowrap rounded-md border border-brass/45 bg-brass/15 px-1.5 py-0.5 font-display text-[11.5px] tabular-nums text-brass"
          style={bubbleStyle(pct(lo))}
        >
          {fmt(lo)}
        </span>
        <span
          className="pointer-events-none absolute top-0 whitespace-nowrap rounded-md border border-brass/45 bg-brass/15 px-1.5 py-0.5 font-display text-[11.5px] tabular-nums text-brass"
          style={bubbleStyle(pct(hi))}
        >
          {fmt(hi)}
        </span>

        <div className="absolute inset-x-0 top-[34px] h-1 rounded-full bg-surface3" />
        <div
          className="absolute top-[34px] h-1 rounded-full bg-brass/80"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <RangeInput
          className="dual-range"
          min={min}
          max={max}
          step={step}
          value={lo}
          ariaLabel={labels?.[0] ?? '下限'}
          onChange={(next) => onChange([Math.min(next, hi - step), hi])}
        />
        <RangeInput
          className="dual-range"
          min={min}
          max={max}
          step={step}
          value={hi}
          ariaLabel={labels?.[1] ?? '上限'}
          onChange={(next) => onChange([lo, Math.max(next, lo + step)])}
        />
      </div>
      <div className="flex justify-between text-[10.5px] text-faint">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  )
}

/* ───────────────── 时长：滑块 + 手填，双向同步 ───────────────── */

type DurationUnit = 'hour' | 'minute'

function UnitToggle({
  unit,
  onChange,
}: {
  unit: DurationUnit
  onChange: (u: DurationUnit) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line">
      {(
        [
          ['hour', '小时'],
          ['minute', '分钟'],
        ] as Array<[DurationUnit, string]>
      ).map(([u, label]) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-2 py-0.5 text-[11px] transition-colors ${
            unit === u ? 'bg-brass/15 text-brass' : 'text-faint hover:text-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function DurationInput({
  minutes,
  unit,
  min,
  max,
  step,
  onCommit,
  ariaLabel,
}: {
  minutes: number
  unit: DurationUnit
  min: number
  max: number
  step: number
  onCommit: (v: number) => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown =
    draft ?? (unit === 'hour' ? String(Math.round((minutes / 60) * 100) / 100) : String(minutes))
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      step={unit === 'hour' ? 0.5 : step}
      min={unit === 'hour' ? min / 60 : min}
      max={unit === 'hour' ? max / 60 : max}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === null) return
        const raw = Number(draft)
        setDraft(null)
        if (!Number.isFinite(raw) || raw <= 0) return
        const mins = unit === 'hour' ? Math.round(raw * 60) : Math.round(raw)
        const snapped = Math.max(min, Math.min(max, Math.round(mins / step) * step))
        onCommit(snapped)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className="!h-8 !w-[74px] !py-1 !text-center !text-[12.5px] tabular-nums"
    />
  )
}

/** 区间：双滑块 + 两个手填框 */
export function DurationRangeField({
  min,
  max,
  step,
  value,
  onChange,
  defaultUnit = 'hour',
}: {
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (v: [number, number]) => void
  defaultUnit?: DurationUnit
}) {
  const [unit, setUnit] = useState<DurationUnit>(defaultUnit)
  const [lo, hi] = value
  return (
    <div className="space-y-2">
      <RangeSlider min={min} max={max} step={step} value={value} onChange={onChange} format={durationText} />
      <div className="flex flex-wrap items-center gap-2">
        <DurationInput
          minutes={lo}
          unit={unit}
          min={min}
          max={max}
          step={step}
          ariaLabel="时长下限"
          onCommit={(v) => onChange([Math.min(v, hi - step), hi])}
        />
        <span className="text-[12px] text-faint">–</span>
        <DurationInput
          minutes={hi}
          unit={unit}
          min={min}
          max={max}
          step={step}
          ariaLabel="时长上限"
          onCommit={(v) => onChange([lo, Math.max(v, lo + step)])}
        />
        <UnitToggle unit={unit} onChange={setUnit} />
        <span className="text-[11px] text-faint">也可以直接填数字</span>
      </div>
    </div>
  )
}

/** 单值：单滑块 + 一个手填框 */
export function DurationField({
  min,
  max,
  step,
  value,
  onChange,
  defaultUnit = 'hour',
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  defaultUnit?: DurationUnit
}) {
  const [unit, setUnit] = useState<DurationUnit>(defaultUnit)
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="relative h-[52px] select-none">
        <span
          className="pointer-events-none absolute top-0 whitespace-nowrap rounded-md border border-brass/45 bg-brass/15 px-1.5 py-0.5 font-display text-[11.5px] tabular-nums text-brass"
          style={bubbleStyle(pct)}
        >
          {durationText(value)}
        </span>
        <div className="absolute inset-x-0 top-[34px] h-1 rounded-full bg-surface3" />
        <div
          className="absolute top-[34px] h-1 rounded-full bg-brass/80"
          style={{ left: 0, width: `${pct}%` }}
        />
        <RangeInput
          className="single-range"
          min={min}
          max={max}
          step={step}
          value={value}
          ariaLabel="时长"
          onChange={onChange}
        />
      </div>
      <div className="flex items-center gap-2">
        <DurationInput
          minutes={value}
          unit={unit}
          min={min}
          max={max}
          step={step}
          ariaLabel="时长"
          onCommit={onChange}
        />
        <UnitToggle unit={unit} onChange={setUnit} />
        <span className="text-[11px] text-faint">
          {formatDuration(min)} – {formatDuration(max)}
        </span>
      </div>
    </div>
  )
}

/* ───────────────── 月份选择 ───────────────── */

export function MonthPicker({
  value,
  onChange,
  minYear = 2024,
  maxYear = 2030,
}: {
  /** YYYY-MM */
  value: string
  onChange: (v: string) => void
  minYear?: number
  maxYear?: number
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear())
  const [y, m] = value.split('-').map(Number)

  useEffect(() => {
    if (open) setYear(y || new Date().getFullYear())
  }, [open, y])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-line bg-surface2 px-3 text-left text-[14px] text-paper transition-colors hover:border-line2"
        aria-label="选择月份"
      >
        <span className="tabular-nums">
          {y} 年 {m} 月
        </span>
        <Icon name="calendar" size={15} className="text-faint" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="选择期号" subtitle="按月统计">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setYear((v) => Math.max(minYear, v - 1))}
            className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-paper"
            aria-label="上一年"
          >
            <Icon name="left" size={16} />
          </button>
          <span className="font-display text-[15px] tabular-nums text-paper">{year} 年</span>
          <button
            onClick={() => setYear((v) => Math.min(maxYear, v + 1))}
            className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-paper"
            aria-label="下一年"
          >
            <Icon name="right" size={16} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => {
            const active = year === y && mm === m
            return (
              <button
                key={mm}
                onClick={() => {
                  onChange(`${year}-${String(mm).padStart(2, '0')}`)
                  setOpen(false)
                }}
                className={`rounded-lg border py-2 text-[13px] transition-colors ${
                  active
                    ? 'border-brass/60 bg-brass/15 text-brass'
                    : 'border-line bg-surface2/60 text-muted hover:border-line2 hover:text-paper'
                }`}
              >
                {mm} 月
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}


/* ───────────────── 进度条 ───────────────── */

export function ProgressBar({
  value,
  max = 100,
  tone = 'brass',
  className = '',
}: {
  value: number
  max?: number
  tone?: 'brass' | 'seal' | 'jade'
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const bg = tone === 'seal' ? 'bg-seal' : tone === 'jade' ? 'bg-jade' : 'bg-brass'
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface3 ${className}`}>
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ───────────────── 下拉菜单 ───────────────── */

export interface MenuItem {
  label: string
  icon?: string
  hint?: string
  danger?: boolean
  onClick: () => void
}

export function Dropdown({
  trigger,
  items,
  header,
  align = 'right',
}: {
  trigger: ReactNode
  items: MenuItem[]
  header?: ReactNode
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !IS_BROWSER) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={box}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={`anim-fade absolute top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {header && <div className="border-b border-line px-3 py-2.5">{header}</div>}
          <div className="p-1">
            {items.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                  it.danger ? 'text-seal hover:bg-seal/10' : 'text-muted hover:bg-surface2 hover:text-paper'
                }`}
              >
                {it.icon && <Icon name={it.icon} size={15} />}
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="text-[10.5px] text-faint">{it.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────── 二次确认 ───────────────── */

export function ConfirmDialog({
  open,
  title,
  desc,
  confirmText = '确认',
  cancelText = '取消',
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  desc?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open || !IS_BROWSER) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  const content = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet relative w-full max-w-[340px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="px-5 pb-4 pt-5">
          <h3 className="font-display text-[16px] text-paper">{title}</h3>
          {desc && <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{desc}</p>}
        </div>
        <div className="flex gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
  return IS_MINI ? content : createPortal(content, document.body)
}

/* ───────────────── 图片选择（端侧压缩） ───────────────── */

/**
 * 选图后先在浏览器里压到目标尺寸再存，避免把几 MB 的原图塞进数据里。
 * 默认居中裁切；也可以让用户选「拉伸铺满」，比例会变但内容不丢。
 */
export function ImagePicker({
  value,
  onChange,
  width,
  height,
  label = '配图',
  hint = '选填，图片会先压缩再保存',
  previewClassName = 'h-16 w-12',
}: {
  value: string | null
  onChange: (v: string | null) => void
  width: number
  height: number
  label?: string
  hint?: string
  previewClassName?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const lastFile = useRef<File | null>(null)
  const [fit, setFit] = useState<'cover' | 'stretch'>('cover')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function apply(file: File, mode: 'cover' | 'stretch') {
    setBusy(true)
    setErr('')
    try {
      const url = await readImageAsDataUrl(file, { width, height, fit: mode })
      onChange(url)
    } catch {
      setErr('图片读取失败，换一张试试')
    } finally {
      setBusy(false)
    }
  }

  async function choose() {
    if (IS_BROWSER) {
      fileRef.current?.click()
      return
    }
    setBusy(true)
    setErr('')
    try {
      const url = await pickImage({ width, height })
      if (url) onChange(url)
    } catch {
      setErr('图片读取失败，换一张试试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="text-[11px] text-faint">{hint}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`relative ${previewClassName} shrink-0 overflow-hidden rounded-lg border border-line bg-surface2`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-faint">
              <Icon name="image" size={16} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose()}>
            <Icon name="upload" size={13} /> {value ? '换一张' : '上传'}
          </Button>
          {value && (
            <>
              <button
                type="button"
                onClick={() => {
                  const next = fit === 'cover' ? 'stretch' : 'cover'
                  setFit(next)
                  if (lastFile.current) void apply(lastFile.current, next)
                }}
                className={`rounded-lg border px-2 py-1 text-[11.5px] transition-colors ${IS_BROWSER ? '' : 'hidden'} ${
                  fit === 'stretch'
                    ? 'border-brass/50 bg-brass/15 text-brass'
                    : 'border-line text-faint hover:text-paper'
                }`}
              >
                {fit === 'stretch' ? '已拉伸铺满' : '拉伸铺满'}
              </button>
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                去掉
              </Button>
            </>
          )}
        </div>
        {IS_BROWSER && <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            lastFile.current = f
            void apply(f, fit)
          }}
        />}
      </div>
      <p className="mt-1 text-[10.5px] text-faint">
        保存前会压到 {width}×{height}，原图多大都不会拖慢页面。
      </p>
      {err && <p className="mt-1 text-[11px] text-seal">{err}</p>}
    </div>
  )
}
