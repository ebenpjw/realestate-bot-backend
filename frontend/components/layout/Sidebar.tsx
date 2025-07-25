import React from 'react';
import {
  Home, MessageSquare, Users, Settings,
  BarChart3, DollarSign, Phone, ChevronRight, ChevronLeft,
  Building2, UserCheck, Send, Calendar, TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth/AuthContext';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
  permission?: string;
}

export function Sidebar({ isCollapsed, onToggle, className }: SidebarProps) {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();
  
  // Agent navigation items
  const agentNavItems: NavItem[] = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/agent/dashboard',
    },
    {
      title: 'Conversations',
      icon: MessageSquare,
      href: '/agent/conversations',
    },
    {
      title: 'Messages',
      icon: Send,
      href: '/agent/messages',
    },
    {
      title: 'Leads',
      icon: Users,
      href: '/agent/leads',
    },
    {
      title: 'Analytics',
      icon: TrendingUp,
      href: '/agent/analytics',
    },
    {
      title: 'Calendar',
      icon: Calendar,
      href: '/agent/calendar',
    },
    {
      title: 'Settings',
      icon: Settings,
      href: '/agent/settings',
    }
  ];

  // Admin navigation items
  const adminNavItems: NavItem[] = [
    {
      title: 'Dashboard',
      icon: BarChart3,
      href: '/admin/dashboard',
    },
    {
      title: 'Agents',
      icon: UserCheck,
      href: '/admin/agents',
    },
    {
      title: 'Costs',
      icon: DollarSign,
      href: '/admin/costs',
    },
    {
      title: 'WABA',
      icon: Phone,
      href: '/admin/waba',
    }
  ];

  // Determine which navigation items to show based on user role
  const navItems = user?.role === 'admin' ? adminNavItems : agentNavItems;

  // Filter items based on permissions
  const filteredNavItems = navItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <aside className={cn(
      "bg-sidebar text-sidebar-foreground relative transition-all duration-300 ease-in-out flex flex-col border-r border-sidebar-border backdrop-blur-sm",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border/50 bg-gradient-to-r from-sidebar to-sidebar/95">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 micro-bounce">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(8, 10)">
                  <path d="M2 6 L12 6 L10 4 M12 6 L10 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <line x1="1" y1="3" x2="6" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
                  <line x1="1" y1="9" x2="6" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
                  <line x1="0" y1="6" x2="3" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                </g>
              </svg>
            </div>
            <div className="absolute inset-0 h-8 w-8 rounded-lg bg-sidebar-primary/20 animate-pulse-gentle"></div>
          </div>
          <div className={cn(
            "transition-all duration-300 overflow-hidden",
            isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto"
          )}>
            <h2 className="font-bold text-lg tracking-tight gradient-text">
              Outpaced
            </h2>
            <p className="text-xs text-sidebar-foreground/60 font-medium">
              Real Estate Intelligence
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "absolute right-3 text-sidebar-foreground h-8 w-8 hover:bg-sidebar-accent/50 hover:scale-110 transition-all duration-200 rounded-full",
            isCollapsed ? "right-2" : "right-3"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      
      <ScrollArea className="flex-1 py-6">
        <nav className="grid gap-2 px-3">
          {filteredNavItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground hover:scale-[1.02] hover:shadow-sm",
                  isActive
                    ? "bg-gradient-to-r from-sidebar-primary/10 to-sidebar-primary/5 text-sidebar-primary border border-sidebar-primary/20 shadow-sm"
                    : "text-sidebar-foreground hover:text-sidebar-primary",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <div className={cn(
                  "relative transition-all duration-200",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground group-hover:text-sidebar-primary"
                )}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {isActive && (
                    <div className="absolute inset-0 h-5 w-5 text-sidebar-primary/20 animate-pulse-gentle">
                      <item.icon className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <span className={cn(
                  "text-sm font-medium transition-all duration-200",
                  isCollapsed ? "opacity-0 w-0" : "opacity-100",
                  isActive ? "font-semibold" : "font-medium"
                )}>
                  {item.title}
                </span>
                {isActive && !isCollapsed && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-sidebar-primary animate-pulse-gentle"></div>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      
      <div className="p-4 border-t border-sidebar-border/50 bg-gradient-to-t from-sidebar/50 to-transparent">
        <div className={cn(
          "transition-all duration-300 rounded-xl bg-gradient-to-br from-sidebar-accent/30 to-sidebar-accent/10 p-3 text-xs border border-sidebar-border/30 backdrop-blur-sm",
          isCollapsed ? "opacity-0 scale-95" : "opacity-100 scale-100"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse-gentle"></div>
            <p className="font-semibold text-sidebar-foreground">System Status</p>
          </div>
          <p className="text-green-400 font-medium mb-1">All systems operational</p>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-sidebar-foreground/60 font-medium">
              {user?.role === 'admin' ? 'Admin Panel' : 'Agent Dashboard'}
            </p>
            <div className="flex gap-1">
              <div className="h-1 w-1 rounded-full bg-sidebar-primary/40"></div>
              <div className="h-1 w-1 rounded-full bg-sidebar-primary/60"></div>
              <div className="h-1 w-1 rounded-full bg-sidebar-primary animate-pulse-gentle"></div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
