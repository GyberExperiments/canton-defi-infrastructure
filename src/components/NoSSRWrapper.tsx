'use client'

import { ReactNode } from 'react'

interface NoSSRWrapperProps {
  children: ReactNode
}

// Упрощенный компонент-обертка без отключения SSR
const NoSSRWrapper = ({ children }: NoSSRWrapperProps) => {
  return <>{children}</>
}

export default NoSSRWrapper
