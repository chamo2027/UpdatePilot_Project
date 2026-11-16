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
  const [cancelling, setCancelling] = useState(false);
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
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-sm">
                    {jobResult.state === 'succeeded'
                      ? 'Update Installed and Verified!'
                      : jobResult.state === 'restart_required'
                      ? 'System Restart Required'
                      : jobResult.state === 'cancelled'
                      ? 'Update cancelled'
                      : 'Update could not be verified'}
                  </p>
                  <p className="text-neutral-300 text-xs mt-1">
                    {jobResult.verificationResult || `Exit code: ${jobResult.exitCode}`}
                  </p>
                </div>
              </div>

              {jobResult.outputLogs && (
                <div>
                  <div className="flex items-center gap-1.5 text-neutral-400 mb-1.5 font-semibold">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Process Output Logs</span>
                  </div>
                  <pre className="p-3 rounded-lg bg-surface-muted text-neutral-300 text-[11px] font-mono overflow-x-auto max-h-48 border border-surface-border whitespace-pre-wrap">
                    {jobResult.outputLogs}
                  </pre>
                </div>
              )}
            </div>
          ) : isExecuting ? (
            /* Live execution progress */
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <div>
                <p role="status" className="font-bold text-foreground text-sm">
                  {jobState === 'queued' ? 'Queued — Waiting for agent' : 'Running WinGet update'}
                </p>
                <p className="text-neutral-400 text-xs mt-1">
                  {jobState === 'queued'
                    ? 'Update is queued. The agent executes one package at a time to prevent Windows installer collisions.'
                    : 'The agent will check the installed version when WinGet finishes.'}
                </p>
                {error && <p role="alert">{error}</p>}
              </div>
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
