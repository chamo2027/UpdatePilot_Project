'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Terminal,
  Download,
  Cpu,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { useModalFocus } from '../lib/useModalFocus';

interface SafeUpdateModalProps {
  app: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const SafeUpdateModal: React.FC<SafeUpdateModalProps> = ({
  app,
  onClose,
  onSuccess,
}) => {
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobState, setJobState] = useState('');
  const [jobProgress, setJobProgress] = useState<{
    percent: number;
    phase: string;
    message?: string;
  }>({ percent: 0, phase: 'queued', message: '' });
  const [cancelling, setCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const dialogRef = useModalFocus(onClose, !isExecuting);

  // Load preview details
  useEffect(() => {
    async function loadPreview() {
      try {
        setLoadingPreview(true);
        const data = await api.previewUpdate(app.id);
        setPreview(data);
      } catch (err: any) {
        setError(err.message || 'Could not load update preview');
      } finally {
        setLoadingPreview(false);
      }
    }
    loadPreview();
  }, [app.id]);

  // Poll job status if executing
  useEffect(() => {
    if (!activeJobId || !isExecuting) return;

    const interval = setInterval(async () => {
      try {
        const job = await api.getJob(activeJobId);
        setJobState(job.state);
        if (job.progressPercent !== undefined && job.progressPercent !== null) {
          setJobProgress({
            percent: job.progressPercent,
            phase: job.progressPhase || (job.state === 'queued' ? 'queued' : 'downloading'),
            message: job.progressMessage || '',
          });
        }
        if (['succeeded', 'failed', 'cancelled', 'restart_required'].includes(job.state)) {
          setError(null);
          setIsExecuting(false);
          setJobResult(job);
          if (job.state === 'succeeded' || job.state === 'restart_required') {
            onSuccess();
          }
          clearInterval(interval);
        }
      } catch {
        // Retry next poll
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId, isExecuting, onSuccess]);

  const handleConfirmAndExecute = async () => {
    if (!confirmed || !preview) return;
    try {
      setIsExecuting(true);
      setError(null);
      const res = await api.executeUpdate(app.id, preview.targetVersion);
      setJobState(res.state);
      setActiveJobId(res.id);
    } catch (err: any) {
      setIsExecuting(false);
      setError(err.message || 'Failed to initiate update execution');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="update-dialog-title" tabIndex={-1}
        className="bg-surface border border-surface-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="update-dialog-title" className="text-base font-bold text-foreground">Safe Update Confirmation</h2>
              <p className="text-xs text-neutral-400">Review package identity and authorize execution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close update dialog"
            disabled={isExecuting}
            className="p-1 rounded-lg text-neutral-400 hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {loadingPreview ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              <span>Validating package identity and safety parameters...</span>
            </div>
          ) : error && !isExecuting && !jobResult ? (
            <div role="alert" className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Verification Error</p>
                <p className="text-neutral-300 mt-1">{error}</p>
              </div>
            </div>
          ) : jobResult ? (
            /* Outcome display */
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  jobResult.state === 'succeeded'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    : jobResult.state === 'restart_required'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                }`}
              >
                {jobResult.state === 'succeeded' ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-sm">
                    {jobResult.state === 'succeeded'
                      ? 'Update Installed Successfully!'
                      : jobResult.state === 'restart_required'
                      ? 'System Restart Required to Finish'
                      : jobResult.state === 'cancelled'
                      ? 'Update Cancelled'
                      : 'Update Could Not Be Completed'}
                  </p>
                  <p className="text-neutral-300 text-xs mt-1">
                    {jobResult.state === 'succeeded'
                      ? `${app.displayName} is now updated and ready to use.`
                      : jobResult.verificationResult || `Exit code: ${jobResult.exitCode}`}
                  </p>
                </div>
              </div>

              {/* Friendly advice if app restart is recommended */}
              {jobResult.outputLogs?.toLowerCase().includes('restart the application') && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                  <span className="text-base shrink-0 leading-none">💡</span>
                  <span>
                    <strong>Quick Tip:</strong> If <strong>{app.displayName}</strong> is currently open, please close and reopen the application to finish applying the upgrade.
                  </span>
                </div>
              )}

              {/* Collapsible Technical Logs for Developers */}
              {jobResult.outputLogs && (
                <div className="border border-surface-border rounded-xl overflow-hidden bg-surface-muted/40">
                  <button
                    type="button"
                    onClick={() => setShowLogs(!showLogs)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-neutral-400 hover:text-foreground text-xs font-medium transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Technical Output & Logs</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                      <span>{showLogs ? 'Hide details' : 'Show details'}</span>
                      {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                  {showLogs && (
                    <pre className="p-3 bg-neutral-950 text-neutral-300 text-[11px] font-mono overflow-x-auto max-h-48 border-t border-surface-border whitespace-pre-wrap">
                      {jobResult.outputLogs}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : isExecuting ? (
            /* Live execution progress with dynamic progress bar and stages */
            <div className="py-6 px-1 space-y-6">
              {/* Header Icon & Status */}
              <div className="flex flex-col items-center justify-center text-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                    {jobProgress.phase === 'downloading' ? (
                      <Download className="w-7 h-7 animate-bounce" />
                    ) : jobProgress.phase === 'installing' ? (
                      <Cpu className="w-7 h-7 animate-pulse text-blue-400" />
                    ) : jobProgress.phase === 'verifying' ? (
                      <ShieldCheck className="w-7 h-7 text-emerald-400" />
                    ) : (
                      <Clock className="w-7 h-7 text-amber-500" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface border border-surface-border flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                  </div>
                </div>

                <div>
                  <h3 role="status" className="font-bold text-foreground text-base tracking-tight">
                    {jobState === 'queued'
                      ? 'Queued for Windows Agent'
                      : jobProgress.phase === 'downloading'
                      ? 'Downloading Package'
                      : jobProgress.phase === 'installing'
                      ? 'Installing Application'
                      : jobProgress.phase === 'verifying'
                      ? 'Verifying Installation'
                      : 'Running WinGet Update'}
                  </h3>
                  <p className="text-neutral-400 text-xs mt-1 max-w-sm mx-auto">
                    {jobState === 'queued'
                      ? 'Waiting for agent to finish any prior installer before starting.'
                      : jobProgress.message || 'Processing update through Windows Package Manager...'}
                  </p>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="space-y-2 bg-surface-muted p-4 rounded-xl border border-surface-border">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-neutral-300 capitalize flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                    {jobProgress.phase || 'downloading'}
                  </span>
                  <span className="font-mono text-amber-400 font-bold text-sm">
                    {Math.max(5, Math.min(100, jobProgress.percent))}%
                  </span>
                </div>

                {/* The Bar */}
                <div className="w-full bg-neutral-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-surface-border/50">
                  <div
                    className="bg-gradient-to-r from-amber-500 via-brand-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                    style={{ width: `${Math.max(5, Math.min(100, jobProgress.percent))}%` }}
                  />
                </div>

                {/* Sub-label under bar */}
                <div className="flex justify-between text-[11px] text-neutral-400 pt-0.5">
                  <span>{preview?.displayName}</span>
                  <span className="font-mono text-neutral-300">v{preview?.targetVersion}</span>
                </div>
              </div>

              {/* 4-Step Milestone Tracker */}
              <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                {/* Step 1: Queued */}
                <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                  jobState === 'queued'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span className="font-medium">1. Queued</span>
                </div>

                {/* Step 2: Download */}
                <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                  jobState === 'queued'
                    ? 'border-surface-border bg-surface-muted text-neutral-500'
                    : jobProgress.phase === 'downloading'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                }`}>
                  {jobProgress.phase === 'downloading' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : jobProgress.phase === 'installing' || jobProgress.phase === 'verifying' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span className="font-medium">2. Download</span>
                </div>

                {/* Step 3: Install */}
                <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                  jobProgress.phase === 'installing'
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                    : jobProgress.phase === 'verifying'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                    : 'border-surface-border bg-surface-muted text-neutral-500'
                }`}>
                  {jobProgress.phase === 'installing' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : jobProgress.phase === 'verifying' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5" />
                  )}
                  <span className="font-medium">3. Install</span>
                </div>

                {/* Step 4: Verify */}
                <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                  jobProgress.phase === 'verifying'
                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-400'
                    : 'border-surface-border bg-surface-muted text-neutral-500'
                }`}>
                  {jobProgress.phase === 'verifying' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span className="font-medium">4. Verify</span>
                </div>
              </div>

              {error && <p role="alert" className="text-rose-400 text-xs text-center">{error}</p>}
            </div>
          ) : (
            /* Proposal Details & Review */
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-surface-muted border border-surface-border space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Application:</span>
                  <span className="font-semibold text-foreground">{preview?.displayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Package Identifier:</span>
                  <span className="font-mono text-neutral-300">{preview?.packageId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Current Version:</span>
                  <span className="font-mono text-neutral-300">{preview?.currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Target Upgrade Version:</span>
                  <span className="font-mono font-bold text-amber-500">{preview?.targetVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Source:</span>
                  <span className="capitalize text-neutral-300">{preview?.source}</span>
                </div>
              </div>

              {preview?.safetyCheck?.majorVersionJump && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    This is a major version jump. Please ensure compatibility with your existing projects or workflows.
                  </p>
                </div>
              )}

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-border bg-surface-muted/50 cursor-pointer hover:bg-surface-muted transition-colors">
                <input
                  id="checkbox-confirm-update"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-brand-500 focus:ring-brand-500 bg-surface border-surface-border"
                />
                <span className="text-[11px] text-neutral-300 leading-relaxed">
                  I explicitly authorize UpdatePilot to execute this update for{' '}
                  <strong className="text-foreground">{preview?.displayName} {preview?.targetVersion}</strong>.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-muted/30 flex items-center justify-end gap-3">
          {isExecuting && jobState === 'queued' && activeJobId && (
            <button disabled={cancelling} className="rounded border border-surface-border px-3 py-2"
              onClick={async () => {
                setCancelling(true);
                try {
                  setJobResult(await api.cancelUpdate(activeJobId));
                  setIsExecuting(false);
                } catch (failure) {
                  setError(failure instanceof Error ? failure.message : 'Could not cancel this update.');
                } finally {
                  setCancelling(false);
                }
              }}>Cancel queued update</button>
          )}
          {jobResult ? (
            <button
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isExecuting}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-execute"
                onClick={handleConfirmAndExecute}
                disabled={!confirmed || isExecuting || loadingPreview || !!error}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-amber-500/20 transition-all"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Confirm & Update</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
