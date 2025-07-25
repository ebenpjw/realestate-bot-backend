'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: number
  trendLabel?: string
  className?: string
  valueClassName?: string
  onClick?: () => void
  loading?: boolean
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  className,
  valueClassName,
  onClick,
  loading = false,
}: StatsCardProps) {
  const formattedTrend = trend !== undefined ? (trend > 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`) : null
  const isTrendPositive = trend !== undefined ? trend > 0 : null

  if (loading) {
    return (
      <Card className={cn('stats-card animate-pulse', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-muted rounded skeleton"></div>
          <div className="h-4 w-4 bg-muted rounded skeleton"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-20 bg-muted rounded skeleton mb-2"></div>
          <div className="h-3 w-32 bg-muted rounded skeleton"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      className={cn(
        'stats-card transition-all duration-300 hover:shadow-card-hover overflow-hidden group',
        onClick ? 'cursor-pointer hover:scale-[1.02]' : '',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        {icon && (
          <div className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors micro-bounce">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight truncate mb-1" style={{ lineHeight: '1.2' }}>
          <span className={cn('gradient-text', valueClassName)}>{value}</span>
        </div>
        
        {(description || trend !== undefined) && (
          <div className="flex items-center text-xs space-x-2">
            {trend !== undefined && (
              <span className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all duration-200',
                isTrendPositive 
                  ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20' 
                  : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
              )}>
                {isTrendPositive ? (
                  <ArrowUpIcon className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownIcon className="h-3 w-3 mr-1" />
                )}
                {formattedTrend}
              </span>
            )}
            {trendLabel && (
              <span className="text-muted-foreground font-medium">{trendLabel}</span>
            )}
            {description && (
              <p className="text-muted-foreground flex-1 truncate">
                {description}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
