'use client'

import { useSocket } from '@/lib/socket/SocketContext'
import { useRealTimeNotifications } from '@/lib/hooks/useRealTimeNotifications'
import { 
  WifiIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface RealTimeStatusProps {
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RealTimeStatus({ 
  showText = true, 
  size = 'md',
  className 
}: RealTimeStatusProps) {
  const { connected } = useSocket()
  const { metrics } = useRealTimeNotifications()

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const getStatusInfo = () => {
    if (!connected) {
      return {
        icon: ExclamationTriangleIcon,
        color: 'text-red-500',
        bgColor: 'bg-red-100',
        text: 'Disconnected',
        description: 'Real-time features unavailable'
      }
    }

    if (metrics.systemAlerts > 0) {
      return {
        icon: ExclamationTriangleIcon,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-100',
        text: 'Connected',
        description: `${metrics.systemAlerts} system alert${metrics.systemAlerts > 1 ? 's' : ''}`
      }
    }

    return {
      icon: CheckCircleIcon,
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      text: 'Connected',
      description: 'All systems operational'
    }
  }

  const status = getStatusInfo()
  const Icon = status.icon

  return (
    <div className={clsx('flex items-center space-x-2', className)}>
      {/* Status Indicator */}
      <div className={clsx(
        'flex items-center justify-center rounded-full p-1',
        status.bgColor
      )}>
        <Icon className={clsx(sizeClasses[size], status.color)} />
      </div>

      {/* Status Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={clsx(
            'font-medium',
            textSizeClasses[size],
            status.color
          )}>
            {status.text}
          </span>
          {status.description && (
            <span className={clsx(
              'text-gray-500',
              size === 'sm' ? 'text-xs' : 'text-xs'
            )}>
              {status.description}
            </span>
          )}
        </div>
      )}

      {/* Connection Pulse Animation */}
      {connected && (
        <div className="relative">
          <div className={clsx(
            'absolute rounded-full animate-ping',
            status.bgColor,
            sizeClasses[size]
          )}></div>
          <div className={clsx(
            'relative rounded-full',
            status.bgColor,
            sizeClasses[size]
          )}></div>
        </div>
      )}
    </div>
  )
}

// Real-time metrics display component
interface RealTimeMetricsProps {
  className?: string
}

export function RealTimeMetrics({ className }: RealTimeMetricsProps) {
  const { metrics, connected } = useRealTimeNotifications()

  if (!connected) {
    return (
      <div className={clsx('text-center py-4', className)}>
        <WifiIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Real-time data unavailable</p>
      </div>
    )
  }

  return (
    <div className={clsx('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      <div className="text-center">
        <div className="text-2xl font-semibold text-gray-900">
          {metrics.activeConversations}
        </div>
        <div className="text-sm text-gray-600">Active Chats</div>
      </div>
      
      <div className="text-center">
        <div className="text-2xl font-semibold text-gray-900">
          {metrics.newLeads}
        </div>
        <div className="text-sm text-gray-600">New Leads</div>
      </div>
      
      <div className="text-center">
        <div className="text-2xl font-semibold text-gray-900">
          {metrics.pendingAppointments}
        </div>
        <div className="text-sm text-gray-600">Appointments</div>
      </div>
      
      <div className="text-center">
        <div className="text-2xl font-semibold text-gray-900">
          {Math.round(metrics.apiUsage.total)}%
        </div>
        <div className="text-sm text-gray-600">API Usage</div>
      </div>
    </div>
  )
}

// Live activity feed component
export function LiveActivityFeed({ className }: { className?: string }) {
  const { notifications } = useRealTimeNotifications()
  const recentNotifications = notifications.slice(0, 5)

  return (
    <div className={clsx('space-y-3', className)}>
      <h3 className="text-sm font-medium text-gray-900">Live Activity</h3>
      
      {recentNotifications.length > 0 ? (
        <div className="space-y-2">
          {recentNotifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start space-x-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className={clsx(
                'flex-shrink-0 w-2 h-2 rounded-full mt-2',
                notification.type === 'success' && 'bg-green-400',
                notification.type === 'error' && 'bg-red-400',
                notification.type === 'warning' && 'bg-yellow-400',
                notification.type === 'info' && 'bg-blue-400'
              )}></div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {notification.title}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {notification.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No recent activity</p>
      )}
    </div>
  )
}
