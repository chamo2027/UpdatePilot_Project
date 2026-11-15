'use client';

import React from 'react';
import { api } from '../lib/api';
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
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history }) => {
  const [exportError, setExportError] = React.useState('');
  const [exporting, setExporting] = React.useState(false);

  const exportReport = async (kind: 'inventory' | 'updates', format: 'csv' | 'json') => {
    setExporting(true);
    setExportError('');
    try {
      const records = await api.getReport(kind);
      const columns = kind === 'inventory'
        ? ['displayName', 'packageId', 'installedVersion', 'availableVersion', 'updateStatus', 'source', 'publisher']
        : ['applicationName', 'packageId', 'fromVersion', 'targetVersion', 'verifiedVersion', 'state', 'exitCode', 'verificationResult', 'createdAt', 'completedAt'];
      const cell = (value: unknown) => {
        const text = String(value ?? '');
        const safe = /^\s*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
        return '"' + safe.replace(/"/g, '""') + '"';
      };
      const contents = format === 'json' ? JSON.stringify(records, null, 2)
        : [columns.join(','), ...records.map(row => columns.map(column => cell(row[column])).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([contents], { type: format === 'json' ? 'application/json' : 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'UpdatePilot-' + kind + '.' + format;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export report.');
    } finally {
      setExporting(false);
    }
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
        {exportError && <p role="alert">{exportError}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={exporting} onClick={() => void exportReport('updates', 'csv')}
            className="rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold">
            Update report CSV
          </button>
          <button
            id="btn-export-csv"
            disabled={exporting}
            onClick={() => void exportReport('inventory', 'csv')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Inventory CSV</span>
          </button>
          <button
            id="btn-export-json"
            disabled={exporting}
            onClick={() => void exportReport('inventory', 'json')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-brand-500" />
            <span>Inventory JSON</span>
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
