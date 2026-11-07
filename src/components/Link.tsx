import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import { IS_MINI } from '../lib/platform'
import { navigate } from '../lib/router'

export default function Link({ href, className = '', children, ariaLabel, title, onClick }: {
  href: string
  className?: string
  children: ReactNode
  ariaLabel?: string
  title?: string
  onClick?: (event: any) => void
}) {
  if (IS_MINI) {
    return (
      <View className={className} aria-label={ariaLabel} onClick={(event) => {
        onClick?.(event)
        navigate(href.replace(/^#/, ''))
      }}>
        {children}
      </View>
    )
  }
  return <a href={href} className={className} aria-label={ariaLabel} title={title} onClick={onClick}>{children}</a>
}
