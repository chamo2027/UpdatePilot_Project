'use client';

import React, { useState } from 'react';
import {
  Laptop,
  Key,
  ShieldCheck,
  RefreshCw,
  Sun,
  Moon,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';

interface SettingsViewProps {
  device: any;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  device,
  theme,
  onToggleTheme,
  onRefresh,
}) => {
  const [revoking, setRevoking] = useState(false);
  const [revokedMessage, setRevokedMessage] = useState<string | null>(null);

  const handleRevoke = async () => {
    if (!device?.id) return;
    if (!confirm('Are you sure you want to revoke the agent token for this device?')) return;

    try {
      setRevoking(true);
      await api.revokeDevice(device.id);
      setRevokedMessage('Agent token revoked. Agent will need to re-pair.');
      onRefresh();
    } catch (e: any) {
      alert(e.message || 'Revocation failed');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Agent Management</h1>
        <p className="text-sm text-neutral-400">
          Manage host agent authentication, scanning preferences, and local privacy parameters.
        </p>
      </div>

      {/* Agent Status Card */}
      <div className="p-6 rounded-xl bg-surface border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-500/10 text-brand-500">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Paired Windows Agent</h3>
              <p className="text-xs text-neutral-400">Local daemon running on target machine</p>
            </div>
          </div>

          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              device?.status === 'online'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
            }`}
          >
            {device?.status === 'online' ? 'Connected & Active' : 'Offline / Standby'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-surface-muted border border-surface-border">
            <span className="text-neutral-400 block mb-1">Host Computer Name</span>
            <span className="font-semibold text-foreground">{device?.name || 'Local Windows Host'}</span>
          </div>

          <div className="p-3 rounded-lg bg-surface-muted border border-surface-border">
            <span className="text-neutral-400 block mb-1">Operating System Version</span>
            <span className="font-semibold text-foreground">{device?.osVersion || 'Windows 10/11'}</span>
          </div>

          <div className="p-3 rounded-lg bg-surface-muted border border-surface-border">
            <span className="text-neutral-400 block mb-1">Agent Version</span>
            <span className="font-semibold text-foreground">{device?.agentVersion || '1.0.0-mvp'}</span>
          </div>

          <div className="p-3 rounded-lg bg-surface-muted border border-surface-border">
            <span className="text-neutral-400 block mb-1">Agent Security Token</span>
            <span className="font-mono text-neutral-300">
              {device?.token ? `${device.token.slice(0, 12)}••••••••••••` : 'Not paired'}
            </span>
          </div>
        </div>

        {revokedMessage && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
            {revokedMessage}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={handleRevoke}
            disabled={revoking || !device?.id}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Revoke Agent Pairing</span>
          </button>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="p-6 rounded-xl bg-surface border border-surface-border space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Appearance & Theme</h3>
          <p className="text-xs text-neutral-400">Choose your preferred visual mode</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onToggleTheme}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
              theme === 'dark'
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-500'
                : 'bg-surface-muted border-surface-border text-foreground'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Dark Theme (Operations / Cyber)</span>
          </button>

          <button
            onClick={onToggleTheme}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
              theme === 'light'
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-500'
                : 'bg-surface-muted border-surface-border text-foreground'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Light Theme (Executive / Clean)</span>
          </button>
        </div>
      </div>

      {/* Policy & Budget Principles (From Section 13 of RFP) */}
      <div className="p-6 rounded-xl bg-surface border border-surface-border space-y-3 text-xs">
        <div className="flex items-center gap-2 text-foreground font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Architecture & Budget Compliance</span>
        </div>
        <p className="text-neutral-400 leading-relaxed">
          UpdatePilot is engineered according to the project proposal: 100% free and open-source stack,
          zero paid cloud API dependencies, zero subscription requirements, local-first operation, and strict
          least-privilege execution model.
        </p>
      </div>
    </div>
  );
};
