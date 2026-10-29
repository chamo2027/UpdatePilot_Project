'use client';

import React from 'react';
import {
  Download,
  History,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface HistoryViewProps {
  history: any[];
  applications: any[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  applications,
}) => {
  // Export applications inventory to CSV
  const exportCsv = () => {
    if (!applications || applications.length === 0) return;

    const headers = [
      'Application Name',
      'Package Identifier',
      'Installed Version',
      'Available Version',
      'Status',
      'Source',
      'Publisher',
    ];

    const rows = applications.map((app) => [
      `"${(app.displayName || '').replace(/"/g, '""')}"`,
      `"${(app.packageId || '').replace(/"/g, '""')}"`,
      `"${app.installedVersion || ''}"`,
      `"${app.availableVersion || ''}"`,
      `"${app.updateStatus || ''}"`,
      `"${app.source || ''}"`,
      `"${(app.publisher || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `UpdatePilot_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export applications inventory to JSON
  const exportJson = () => {
    const jsonStr = JSON.stringify(applications, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `UpdatePilot_Inventory_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit & History</h1>
          <p className="text-sm text-neutral-400">
            Immutable log of all scans, update executions, and diagnostic results.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-export-csv"
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export CSV</span>
          </button>
          <button
            id="btn-export-json"
            onClick={exportJson}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-brand-500" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl bg-surface border border-surface-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-surface-border text-neutral-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target / Description</th>
                <th className="py-3 px-4">Diagnostic Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {history && history.length > 0 ? (
                history.map((evt) => {
                  let metadataObj: any = null;
                  try {
                    if (evt.metadata) metadataObj = JSON.parse(evt.metadata);
                  } catch {}

                  return (
                    <tr key={evt.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-400 whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-foreground px-2 py-0.5 rounded bg-surface-muted border border-surface-border">
                          {evt.eventType}
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize text-neutral-300">
                        {evt.actor}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {evt.target}
                      </td>
                      <td className="py-3 px-4 text-neutral-400 font-mono text-[11px]">
                        {metadataObj ? (
                          <span>
                            {Object.entries(metadataObj)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' | ')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    No history events logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
