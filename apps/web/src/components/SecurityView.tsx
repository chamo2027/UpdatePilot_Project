'use client';

import React from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  Info,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface SecurityViewProps {
  findings: any[];
  onNavigateToUpdates: () => void;
}

export const SecurityView: React.FC<SecurityViewProps> = ({
  findings,
  onNavigateToUpdates,
}) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default:
        return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Security Insights</h1>
          <p className="text-sm text-neutral-400">
            Verified public vulnerability advisories (CVE / OSV) matched against installed packages.
          </p>
        </div>
      </div>

      {/* Advisory Freshness Banner */}
      <div className="p-4 rounded-xl bg-surface border border-surface-border flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground">Conservative Vulnerability Policy</p>
          <p className="text-neutral-400 mt-0.5 leading-relaxed">
            Per the UpdatePilot specification, security findings are only surfaced when the package
            identifier and affected version ranges are verifiable against public vulnerability databases.
            Unverified guesses are suppressed.
          </p>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        {findings && findings.length > 0 ? (
          findings.map((f) => (
            <div
              key={f.id}
              className="p-5 rounded-xl bg-surface border border-surface-border hover:border-rose-500/40 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`font-mono text-xs uppercase px-2.5 py-0.5 rounded font-bold border ${getSeverityBadge(
                      f.severity
                    )}`}
                  >
                    {f.severity}
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {f.advisoryId}
                  </span>
                  <span className="text-neutral-400">·</span>
                  <span className="text-xs font-semibold text-foreground">{f.packageName}</span>
                  <span className="font-mono text-[11px] text-neutral-400">({f.packageId})</span>
                </div>

                <div className="text-[11px] text-neutral-400">
                  Source: <span className="text-neutral-300 font-medium">{f.source}</span>
                </div>
              </div>

              {/* Title & Summary */}
              <div>
                <h4 className="text-sm font-bold text-foreground">{f.title}</h4>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">{f.summary}</p>
              </div>

              {/* Range & Remediation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-surface-border text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-neutral-400">Affected Versions: </span>
                    <span className="font-mono text-rose-400 font-medium">{f.affectedRange}</span>
                  </div>
                  {f.fixedVersion && (
                    <div>
                      <span className="text-neutral-400">Remediation: </span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        Upgrade to &ge; {f.fixedVersion}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={onNavigateToUpdates}
                  className="text-xs font-semibold text-amber-500 hover:text-amber-400 flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>Resolve in Update Center</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center rounded-xl bg-surface border border-surface-border">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground">No Vulnerabilities Identified</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              None of your currently matched applications match active high-severity CVE advisories.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
