'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useAdminStats } from '@/lib/hooks/useDashboard'
import {
  Users,
  DollarSign,
  MessageSquare,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Activity,
  Server,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui/StatsCard'
import { Progress } from '@/components/ui/progress'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface MetricCard {
  title: string
  value: string
  change: string
  changeType: 'increase' | 'decrease' | 'neutral'
  icon: React.ComponentType<any>
}



// Helper function to format growth percentage
const formatGrowth = (growth: number): { text: string; type: 'increase' | 'decrease' | 'neutral' } => {
  if (growth === 0) return { text: 'No change', type: 'neutral' };
  const sign = growth > 0 ? '+' : '';
  const text = `${sign}${growth.toFixed(1)}%`;
  return {
    text,
    type: growth > 0 ? 'increase' : 'decrease'
  };
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};



export default function AdminDashboard() {
  const { user, hasPermission } = useAuth()
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d')

  // Fetch real admin stats
  const { data: adminStats, isLoading, error } = useAdminStats(user?.organization_id, selectedTimeframe)

  // Transform API data to metrics format
  const getMetrics = (): MetricCard[] => {
    if (!adminStats) return [];

    const agentsGrowth = formatGrowth(adminStats.growth.agents);
    const costsGrowth = formatGrowth(adminStats.growth.costs);
    const conversationsGrowth = formatGrowth(adminStats.growth.conversations);
    const conversionGrowth = formatGrowth(adminStats.growth.conversionRate);

    return [
      {
        title: 'Active Agents',
        value: adminStats.metrics.totalAgents.toString(),
        change: agentsGrowth.text,
        changeType: agentsGrowth.type,
        icon: Users
      },
      {
        title: 'Monthly Costs',
        value: formatCurrency(adminStats.metrics.monthlyCosts),
        change: costsGrowth.text,
        changeType: costsGrowth.type,
        icon: DollarSign
      },
      {
        title: 'Total Conversations',
        value: adminStats.metrics.totalConversations.toLocaleString(),
        change: conversationsGrowth.text,
        changeType: conversationsGrowth.type,
        icon: MessageSquare
      },
      {
        title: 'Conversion Rate',
        value: `${adminStats.metrics.conversionRate}%`,
        change: conversionGrowth.text,
        changeType: conversionGrowth.type,
        icon: BarChart3
      }
    ];
  };

  const metrics = getMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Failed to load dashboard</h2>
            <p className="text-muted-foreground">Please try refreshing the page</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check admin permission
  if (!hasPermission('manage_system')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-slide-up">
          <h1 className="text-4xl font-bold tracking-tight gradient-text">Admin Dashboard</h1>
          <p className="text-muted-foreground text-lg mt-2">
            Monitor and manage your Outpaced system
          </p>
        </div>
        <div className="flex space-x-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Button variant="outline" className="hover:scale-105 transition-transform duration-200">
            Export Report
          </Button>
          <Button className="hover:scale-105 transition-transform duration-200">
            Add New Agent
          </Button>
        </div>
      </div>



      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          const TrendIcon = metric.changeType === 'increase' ? TrendingUp :
                          metric.changeType === 'decrease' ? TrendingDown : null
          return (
            <Card key={metric.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {metric.title}
                    </p>
                    <p className="text-2xl font-semibold mt-2">
                      {metric.value}
                    </p>
                    <div className="flex items-center mt-2">
                      {TrendIcon && (
                        <TrendIcon className={`h-4 w-4 mr-1 ${
                          metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                        }`} />
                      )}
                      <span className={`text-sm ${
                        metric.changeType === 'increase'
                          ? 'text-green-600'
                          : metric.changeType === 'decrease'
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                      }`}>
                        {metric.change}
                      </span>
                    </div>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* System Performance */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Performance
            </CardTitle>
          </CardHeader>
        <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Response Time</span>
                <Badge variant="secondary" className="text-green-600">142ms</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Database Performance</span>
                <Badge variant="secondary" className="text-green-600">Optimal</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">WhatsApp API Status</span>
                <Badge variant="secondary" className="text-green-600">Connected</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Server Uptime</span>
                <span className="text-sm font-medium">99.9%</span>
              </div>
              <Progress value={99.9} className="mt-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
