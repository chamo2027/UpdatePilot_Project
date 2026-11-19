'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Laptop, ShieldCheck } from 'lucide-react';

interface ConnectDeviceModalProps {
  user: any;
  onClose: () => void;
}

export const ConnectDeviceModal: React.FC<ConnectDeviceModalProps> = ({ user, onClose }) => {
  const [copied, setCopied] = useState(false);
  const pairingCode = user?.pairingCode || 'UP-DEVICE-KEY';

  const hostOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const installCmd = `$env:SERVER_URL='${hostOrigin}/api/v1'; $env:AGENT_PAIRING_CODE='${pairingCode}'; npm run dev:agent`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
              <p className="text-xs text-neutral-400">Link your physical PC to scan and manage installed software</p>
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
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">Your Personal Pairing Code</span>
            <div className="text-xl font-mono font-bold tracking-wider text-foreground mt-0.5">{pairingCode}</div>
          </div>
          <button
            onClick={() => copyToClipboard(pairingCode)}
            className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Connection Instructions */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Terminal className="w-4 h-4" /> Quick Connect via Windows PowerShell
          </h3>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Open <strong>PowerShell</strong> on the Windows machine you want to connect and run the following command to link this computer to your account:
          </p>

          <div className="relative rounded-xl border border-surface-border bg-neutral-950 p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
            <code>{installCmd}</code>
            <button
              onClick={() => copyToClipboard(installCmd)}
              className="absolute right-2 top-2 p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              title="Copy Command"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Safety Note */}
        <div className="rounded-lg bg-surface-muted p-3 text-[11px] text-neutral-400 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            <strong>Isolated Account:</strong> Only applications from the machine running your unique pairing code will appear in your private dashboard. Other users cannot see your computer or apps.
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
