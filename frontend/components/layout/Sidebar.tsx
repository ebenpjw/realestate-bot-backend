import React from 'react';
import {
  Home, MessageSquare, Users, Settings,
  BarChart3, DollarSign, Phone, ChevronRight, ChevronLeft,
  Building2, UserCheck, Send, Calendar
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
      "bg-sidebar text-sidebar-foreground relative transition-all duration-300 ease-in-out flex flex-col border-r border-sidebar-border",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Building2 className={cn(
            "h-6 w-6 text-sidebar-primary transition-opacity duration-200",
            isCollapsed ? "opacity-100" : "opacity-100"
          )} />
          <h2 className={cn(
            "font-semibold tracking-tight transition-opacity duration-200 text-sidebar-foreground",
            isCollapsed ? "opacity-0 w-0" : "opacity-100"
          )}>
            Outpaced
          </h2>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "absolute right-2 text-sidebar-foreground h-8 w-8 hover:bg-sidebar-accent",
            isCollapsed ? "right-2" : "right-4"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      
      <ScrollArea className="flex-1 py-4">
        <nav className="grid gap-1 px-2">
          {filteredNavItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0")} />
                <span className={cn(
                  "text-sm font-medium transition-opacity duration-200",
                  isCollapsed ? "opacity-0 w-0" : "opacity-100"
                )}>
                  {item.title}
                </span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn(
          "transition-opacity duration-200 rounded-md bg-sidebar-accent/50 p-2 text-xs text-sidebar-accent-foreground",
          isCollapsed ? "opacity-0" : "opacity-100"
        )}>
          <p className="font-medium">System Status</p>
          <p className="text-green-400">All systems operational</p>
          <p className="text-[10px] text-sidebar-foreground/70">
            {user?.role === 'admin' ? 'Admin Panel' : 'Agent Dashboard'}
          </p>
        </div>
      </div>
    </aside>
  );
}
