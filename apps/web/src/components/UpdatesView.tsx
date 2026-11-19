'use client';

import React, { useState } from 'react';
import {
  ArrowUpCircle,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';

interface UpdatesViewProps {
  updates: any[];
  onOpenUpdateModal: (app: any) => void;
  onRefresh: () => void;
}

export const UpdatesView: React.FC<UpdatesViewProps> = ({
  updates,
  onOpenUpdateModal,
  onRefresh,
}) => {
  const [dismissedNotice, setDismissedNotice] = useState(false);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Update Center</h1>
          <p className="text-sm text-neutral-400">
            {updates.length} applications with verified upgrades ready for review and installation.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors self-start sm:self-auto"
        >
          Refresh Updates
        </button>
      </div>

      {/* Safety Notice Banner */}
      {!dismissedNotice && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-500">Safe Update Guarantee</p>
              <p className="text-neutral-300 mt-0.5 leading-relaxed">
                UpdatePilot never performs silent or automated bulk updates. Each update preview validates
                the package identifier against the official Windows Package Manager repository and requires
                explicit confirmation before executing.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissedNotice(true)}
            className="p-1 rounded-lg text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/20 transition-colors shrink-0"
            title="Dismiss notice"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Updates Cards List */}
      <div className="space-y-3">
        {updates && updates.length > 0 ? (
          updates.map((app) => {
            const isMajorJump =
              app.installedVersion.split('.')[0] !==
              (app.availableVersion ? app.availableVersion.split('.')[0] : '');

            return (
              <div
                key={app.id}
                className="p-5 rounded-xl bg-surface border border-surface-border hover:border-amber-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* App Info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-base">
                      {app.displayName}
                    </span>
                    {app.packageId && (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-muted text-neutral-400 border border-surface-border">
                        {app.packageId}
                      </span>
                    )}
                    {isMajorJump && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        Major Version Jump
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-400">
                    Publisher: <span className="text-foreground">{app.publisher || 'Verified Package'}</span>
                  </p>

                  {/* Version jump pill */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-muted text-neutral-400 border border-surface-border">
                      Current: {app.installedVersion}
                    </span>
                    <span className="text-neutral-500 font-bold">→</span>
                    <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Target: {app.availableVersion}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    id={`btn-update-${app.id}`}
                    onClick={() => onOpenUpdateModal(app)}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white shadow-sm shadow-amber-500/20 transition-all"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>Review & Update</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center rounded-xl bg-surface border border-surface-border">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground">All Applications Up to Date</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              No pending upgrades were discovered on your Windows machine during the last scan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
