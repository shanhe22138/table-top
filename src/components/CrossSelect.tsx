import { Picker, View } from '@tarojs/components'
import { IS_MINI } from '../lib/platform'

export default function CrossSelect({ value, options, onChange, className = '' }: {
  value: string | number
  options: Array<{ value: string | number; label: string }>
  onChange: (value: string) => void
  className?: string
}) {
  const selected = Math.max(0, options.findIndex((option) => String(option.value) === String(value)))
  if (IS_MINI) {
    return (
      <Picker mode="selector" range={options.map((option) => option.label)} value={selected}
        onChange={(event) => {
          const option = options[Number(event.detail.value)]
          if (option) onChange(String(option.value))
        }}>
        <View className={className}>{options[selected]?.label}</View>
      </Picker>
    )
  }
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={className}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}
