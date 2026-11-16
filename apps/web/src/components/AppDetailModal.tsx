'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Globe,
  FileText,
  ShieldAlert,
  Clock,
  ExternalLink,
  History,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useModalFocus } from '../lib/useModalFocus';

interface AppDetailModalProps {
  appId: string;
  onClose: () => void;
  onTriggerUpdate?: (app: any) => void;
}

export const AppDetailModal: React.FC<AppDetailModalProps> = ({
  appId,
  onClose,
  onTriggerUpdate,
}) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const dialogRef = useModalFocus(onClose);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getApplicationById(appId);
        setDetails(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="app-detail-title" tabIndex={-1}
        className="bg-surface border border-surface-border rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="app-detail-title" className="text-base font-bold text-foreground">Application Details</h2>
              <p className="text-xs text-neutral-400">Package identity and release metadata</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close application details"
            className="p-1 rounded-lg text-neutral-400 hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              <span>Loading package specifications...</span>
            </div>
          ) : details ? (
            <div className="space-y-5">
              {/* Main Info */}
              <div>
                <h3 className="text-lg font-bold text-foreground">{details.displayName}</h3>
                <p className="text-neutral-400 mt-0.5">{details.publisher || 'Unknown Publisher'}</p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-surface-muted border border-surface-border">
                <div className="min-w-0">
                  <span className="text-neutral-400 block mb-0.5">Installed Version</span>
                  <span className="font-mono font-semibold text-foreground truncate block">{details.installedVersion}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-400 block mb-0.5">Available Version</span>
                  <span className="font-mono font-semibold text-amber-500 truncate block">
                    {details.availableVersion || 'Up to date'}
                  </span>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <span className="text-neutral-400 block mb-0.5">Package Identifier</span>
                  <span className="font-mono text-neutral-300 break-all text-[11px] block">{details.packageId || 'Unmatched'}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-400 block mb-0.5">Source Provider</span>
                  <span className="capitalize text-neutral-300 block">{details.source}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-400 block mb-0.5">Target Host</span>
                  <span className="text-neutral-300 truncate block">{details.device?.name}</span>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <span className="text-neutral-400 block mb-0.5">Last Scanned</span>
                  <span className="text-neutral-300 block">
                    {new Date(details.lastScannedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Release Metadata & External Links (only shown if data exists) */}
              {(details.releaseDate || details.homepageUrl || details.changelogUrl) && (
                <div className="space-y-2">
                  <span className="font-bold text-foreground block">Release information</span>
                  {details.releaseDate && <p className="text-neutral-300">Release date: {details.releaseDate}</p>}
                  <div className="flex flex-wrap gap-2">
                    {details.homepageUrl && (
                      <a
                        href={details.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-neutral-300 border border-surface-border transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5 text-brand-500" />
                        <span>Publisher website</span>
                        <ExternalLink className="w-3 h-3 text-neutral-500" />
                      </a>
                    )}

                    {details.changelogUrl && (
                      <a
                        href={details.changelogUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-neutral-300 border border-surface-border transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        <span>Release notes</span>
                        <ExternalLink className="w-3 h-3 text-neutral-500" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Security Advisories */}
              {details.securityFindings && details.securityFindings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-rose-500 font-bold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Associated Security Advisory</span>
                  </div>
                  {details.securityFindings.map((f: any) => (
                    <div key={f.id} className="text-[11px] text-neutral-300">
                      <span className="font-mono font-bold text-rose-400">{f.advisoryId}</span>: {f.title}
                      <p className="text-neutral-400 mt-1">Recommended Fix: Update to {f.fixedVersion}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Update History Log */}
              {details.updateJobs && details.updateJobs.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-foreground block">Execution History</span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {details.updateJobs.map((j: any) => (
                      <div
                        key={j.id}
                        className="p-2.5 rounded-lg bg-surface-muted border border-surface-border flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <span className="font-semibold text-foreground">
                            {j.fromVersion} → {j.targetVersion}
                          </span>
                          <span className="text-neutral-400 ml-2">({j.initiator})</span>
                        </div>
                        <span
                          className={`font-semibold capitalize ${
                            j.state === 'succeeded' ? 'text-emerald-500' : 'text-neutral-400'
                          }`}
                        >
                          {j.state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-neutral-400">Application not found.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-muted/30 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
          >
            Close
          </button>
          {details?.updateStatus === 'update_available' && onTriggerUpdate && (
            <button
              onClick={() => {
                onClose();
                onTriggerUpdate(details);
              }}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition-all"
            >
              Update This Application
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
