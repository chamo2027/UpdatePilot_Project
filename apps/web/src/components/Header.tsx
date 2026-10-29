'use client';

import React from 'react';
import { RefreshCw, Shield, Laptop, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  device: any;
  isScanning: boolean;
  onTriggerScan: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  device,
  isScanning,
  onTriggerScan,
  theme,
  onToggleTheme,
}) => {
  const isOnline = device?.status === 'online';

  return (
    <header className="h-16 border-b border-surface-border bg-surface px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & System */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-foreground text-lg">UpdatePilot</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
                MVP v1.0
              </span>
            </div>
            <p className="text-xs text-neutral-400 -mt-0.5">Software Update Intelligence & Management</p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-surface-border hidden md:block" />

        {/* Host Status Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-surface-muted border border-surface-border">
          <Laptop className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-medium text-foreground">{device?.name || 'Local Windows Host'}</span>
          <span className="text-neutral-400">·</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className={isOnline ? 'text-emerald-500 font-medium' : 'text-neutral-400'}>
              {isOnline ? 'Agent Connected' : 'Agent Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-3">
        <button
          id="btn-trigger-scan"
          onClick={onTriggerScan}
          disabled={isScanning || !isOnline}
          className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all ${
            isScanning
              ? 'bg-surface-muted text-neutral-400 cursor-not-allowed'
              : 'bg-brand-500 hover:bg-brand-600 active:scale-95 text-white shadow-sm shadow-brand-500/30'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning Host...' : 'Scan For Updates'}</span>
        </button>

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
