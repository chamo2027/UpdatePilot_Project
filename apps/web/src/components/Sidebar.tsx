'use client';

import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ArrowUpCircle,
  ShieldAlert,
  History,
  Settings,
} from 'lucide-react';

export type NavTab = 'overview' | 'applications' | 'updates' | 'security' | 'history' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  updatesCount: number;
  securityCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  updatesCount,
  securityCount,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'applications', label: 'Applications', icon: Layers },
    {
      id: 'updates',
      label: 'Update Center',
      icon: ArrowUpCircle,
      badge: updatesCount > 0 ? updatesCount : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-500 border border-amber-500/30',
    },
    {
      id: 'security',
      label: 'Security Insights',
      icon: ShieldAlert,
      badge: securityCount > 0 ? securityCount : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-500 border border-rose-500/30',
    },
    { id: 'history', label: 'Audit & History', icon: History },
    { id: 'settings', label: 'Settings & Agent', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-surface-border bg-surface flex flex-col justify-between p-4 shrink-0 h-[calc(100vh-4rem)]">
      <nav className="space-y-1.5">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500/10 text-brand-500 font-semibold border border-brand-500/20'
                  : 'text-neutral-400 hover:text-foreground hover:bg-surface-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-500' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    item.badgeColor || 'bg-brand-500/20 text-brand-500'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Safety Policy Callout in Sidebar */}
      <div className="p-3 rounded-lg bg-surface-muted border border-surface-border text-xs text-neutral-400">
        <p className="font-semibold text-foreground mb-1">Local-First Safety</p>
        <p className="text-[11px] leading-relaxed">
          Updates require explicit user approval. All operations execute strictly via allowlisted Windows Package Manager calls.
        </p>
      </div>
    </aside>
  );
};
