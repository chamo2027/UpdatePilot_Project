'use client';

import React from 'react';
import { RefreshCw, Shield, Laptop, Moon, Sun, Plus, LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  device: any;
  user?: any;
  isScanning: boolean;
  onTriggerScan: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenConnectModal?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  device,
  user,
  isScanning,
  onTriggerScan,
  theme,
  onToggleTheme,
  onOpenConnectModal,
  onSignOut,
}) => {
  const isOnline = device?.status === 'online';

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-surface-border bg-surface px-3 md:px-6">
      {/* Brand & System */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-foreground text-lg">UpdatePilot</span>
              <span className="hidden rounded border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-500 sm:inline">
                Cloud SaaS
              </span>
            </div>
            <p className="-mt-0.5 hidden text-xs text-neutral-400 sm:block">Software Update Intelligence & Management</p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-surface-border hidden md:block" />

        {/* Host Status Badge */}
        {device ? (
          <div className="hidden md:flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-surface-muted border border-surface-border">
            <Laptop className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-medium text-foreground">{device.name}</span>
            <span className="text-neutral-400">·</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className={isOnline ? 'text-emerald-500 font-medium' : 'text-neutral-400'}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Laptop className="w-3.5 h-3.5" />
            <span>No Device Connected</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        {onOpenConnectModal && (
          <button
            onClick={onOpenConnectModal}
            className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-500/20 transition-all active:scale-95"
            title="Connect a new Windows PC"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Connect PC</span>
          </button>
        )}

        <button
          id="btn-trigger-scan"
          aria-label="Scan installed applications"
          onClick={onTriggerScan}
          disabled={isScanning || !isOnline}
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
            isScanning
              ? 'bg-surface-muted text-neutral-400 cursor-not-allowed'
              : !isOnline
              ? 'bg-surface-muted text-neutral-500 cursor-not-allowed'
              : 'bg-brand-500 hover:bg-brand-600 active:scale-95 text-white shadow-sm shadow-brand-500/30'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isScanning ? 'Scanning...' : 'Scan Updates'}</span>
        </button>

        {/* User Badge */}
        {user && (
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-surface-border text-xs">
            <div className="w-7 h-7 rounded-full bg-surface-muted border border-surface-border flex items-center justify-center text-foreground font-bold">
              {user.name ? user.name[0].toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="text-left">
              <div className="font-semibold text-foreground truncate max-w-[100px]">{user.name || user.email}</div>
              <div className="text-[10px] text-neutral-400 capitalize">{user.role || 'User'}</div>
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        {onSignOut && (
          <button
            onClick={onSignOut}
            title="Sign out"
            className="p-2 rounded-lg bg-surface-muted hover:bg-surface-border text-neutral-400 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          id="btn-toggle-theme"
          onClick={onToggleTheme}
          title="Toggle theme"
          className="p-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
