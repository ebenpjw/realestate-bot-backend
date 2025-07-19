'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Sidebar
      isCollapsed={collapsed}
      onToggle={() => setCollapsed(!collapsed)}
      className="h-screen"
    />
  )
}
