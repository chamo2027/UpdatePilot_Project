'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Laptop, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

interface ConnectDeviceModalProps {
  user: any;
  onClose: () => void;
}

export const ConnectDeviceModal: React.FC<ConnectDeviceModalProps> = ({ user, onClose }) => {
  const [copiedQuick, setCopiedQuick] = useState(false);
  const [copiedContinuous, setCopiedContinuous] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'continuous'>('quick');
  const pairingCode = user?.pairingCode || 'UP-DEVICE-KEY';

  const hostOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const quickCmd = `irm "${hostOrigin}/api/v1/install-agent.ps1?code=${pairingCode}" | iex`;
  const continuousCmd = `$env:SERVER_URL='${hostOrigin}/api/v1'; $env:AGENT_PAIRING_CODE='${pairingCode}'; npm run dev:agent`;

  const copyToClipboard = (text: string, isQuick: boolean) => {
    navigator.clipboard.writeText(text);
    if (isQuick) {
      setCopiedQuick(true);
      setTimeout(() => setCopiedQuick(false), 2500);
    } else {
      setCopiedContinuous(true);
      setTimeout(() => setCopiedContinuous(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-surface-border bg-surface p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Connect a Windows Computer</h2>
              <p className="text-xs text-neutral-400">Link this PC or any remote Windows machine to your private account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pairing Code Box */}
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">Your Private Pairing Code</span>
            <div className="text-xl font-mono font-bold tracking-wider text-foreground mt-0.5">{pairingCode}</div>
          </div>
          <button
            onClick={() => copyToClipboard(pairingCode, true)}
            className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all active:scale-95"
          >
            {copiedQuick ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copiedQuick ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Method Toggle Tabs */}
        <div className="flex rounded-xl bg-surface-muted p-1 border border-surface-border text-xs">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'quick'
                ? 'bg-surface text-brand-400 shadow-sm'
                : 'text-neutral-400 hover:text-foreground'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            One-Click Scan (Zero Install)
          </button>
          <button
            onClick={() => setActiveTab('continuous')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'continuous'
                ? 'bg-surface text-brand-400 shadow-sm'
                : 'text-neutral-400 hover:text-foreground'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Background Agent (Continuous)
          </button>
        </div>

        {/* Tab 1: One-Click PowerShell */}
        {activeTab === 'quick' && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-300 leading-relaxed">
              Open <strong>PowerShell</strong> on any Windows machine (no Git or Node required) and paste this single command. It will link the PC and scan all installed software into your dashboard:
            </p>

            <div className="relative rounded-xl border border-surface-border bg-neutral-950 p-3.5 font-mono text-xs text-emerald-400 break-all pr-12">
              <code>{quickCmd}</code>
              <button
                onClick={() => copyToClipboard(quickCmd, true)}
                className="absolute right-2 top-2 p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                title="Copy Command"
              >
                {copiedQuick ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Continuous Background Agent */}
        {activeTab === 'continuous' && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-300 leading-relaxed">
              For continuous real-time telemetry, polling, and remote one-click updates, run the agent in the project directory:
            </p>

            <div className="relative rounded-xl border border-surface-border bg-neutral-950 p-3.5 font-mono text-xs text-emerald-400 break-all pr-12">
              <code>{continuousCmd}</code>
              <button
                onClick={() => copyToClipboard(continuousCmd, false)}
                className="absolute right-2 top-2 p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                title="Copy Command"
              >
                {copiedContinuous ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Safety Note */}
        <div className="rounded-lg bg-surface-muted p-3 text-[11px] text-neutral-400 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            <strong>Isolated Account:</strong> Only applications from the machine running your unique pairing code will appear in your private dashboard. Other users cannot view or manage your computers.
          </span>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-surface-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-border transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
