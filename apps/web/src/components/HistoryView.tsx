'use client';

import React, { useState, useMemo } from 'react';
import { api } from '../lib/api';
import {
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Laptop,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  Terminal,
} from 'lucide-react';

interface HistoryViewProps {
  history: any[];
}

interface DetailItem {
  label: string;
  value: string;
  isCode?: boolean;
  canCopy?: boolean;
}

interface FormattedEvent {
  title: string;
  summary: string;
  badgeLabel: string;
  badgeColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  details: DetailItem[];
  rawMeta: Record<string, any> | null;
}

function formatAuditEvent(evt: any): FormattedEvent {
  let meta: Record<string, any> = {};
  try {
    if (evt.metadata) {
      meta = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata;
    }
  } catch {
    meta = {};
  }

  const uuidMatch = evt.target && typeof evt.target === 'string'
    ? evt.target.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    : null;
  const targetJobId = meta.jobId || (uuidMatch ? uuidMatch[0] : null);

  let title = evt.target || 'System Operation';
  let summary = '';
  let badgeLabel = evt.eventType;
  let badgeColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'neutral' = 'neutral';
  let icon: React.ComponentType<{ className?: string }> = Clock;
  const details: DetailItem[] = [];

  switch (evt.eventType) {
    case 'SCAN_COMPLETED':
      title = 'Software Inventory Scan';
      badgeLabel = 'Scan Completed';
      badgeColor = 'emerald';
      icon = CheckCircle2;
      if (meta.totalApps !== undefined) {
        const total = meta.totalApps;
        const updates = meta.updatesFound ?? 0;
        summary = updates > 0
          ? `${total} applications scanned. ${updates} update${updates === 1 ? '' : 's'} available.`
          : `${total} applications scanned. All applications are up to date.`;
      } else {
        summary = 'System application scan completed successfully.';
      }
      if (targetJobId) details.push({ label: 'Job ID', value: targetJobId, isCode: true, canCopy: true });
      if (meta.totalApps !== undefined) details.push({ label: 'Applications Scanned', value: `${meta.totalApps} installed apps` });
      if (meta.updatesFound !== undefined) details.push({ label: 'Updates Detected', value: `${meta.updatesFound} updates available` });
      if (evt.device?.name) details.push({ label: 'Target Device', value: evt.device.name });
      break;

    case 'SCAN_REQUESTED':
      title = 'Inventory Scan Started';
      badgeLabel = 'Scan Started';
      badgeColor = 'blue';
      icon = Clock;
      summary = evt.actor === 'agent'
        ? 'Scheduled inventory scan initiated by the Windows agent.'
        : 'Manual inventory scan requested from the dashboard.';
      if (targetJobId) details.push({ label: 'Job ID', value: targetJobId, isCode: true, canCopy: true });
      details.push({ label: 'Initiated By', value: evt.actor === 'agent' ? 'Windows Host Agent' : 'Dashboard User' });
      if (evt.device?.name) details.push({ label: 'Target Device', value: evt.device.name });
      break;

    case 'SCAN_FAILED':
      title = 'Inventory Scan Failed';
      badgeLabel = 'Scan Failed';
      badgeColor = 'rose';
      icon = AlertTriangle;
      summary = meta.error || 'The inventory scan could not be completed. Check agent connection.';
      if (targetJobId) details.push({ label: 'Job ID', value: targetJobId, isCode: true, canCopy: true });
      if (meta.error) details.push({ label: 'Error Diagnostics', value: meta.error });
      break;

    case 'UPDATE_CONFIRMED': {
      badgeLabel = 'Update Authorized';
      badgeColor = 'amber';
      icon = ShieldCheck;
      const versionJump = typeof evt.target === 'string' && evt.target.match(/^(.*?)\s*\((.*?)\s*->\s*(.*?)\)$/);
      if (versionJump) {
        const [, appName, fromVer, toVer] = versionJump;
        title = `Authorized Update: ${appName}`;
        summary = `User confirmed update from version ${fromVer} to ${toVer}.`;
        details.push({ label: 'Application Name', value: appName });
        details.push({ label: 'Current Version', value: fromVer });
        details.push({ label: 'Target Version', value: toVer });
      } else {
        title = `Authorized Update: ${evt.target || 'Package'}`;
        summary = 'User reviewed release parameters and authorized package installation.';
      }
      if (meta.packageId) details.push({ label: 'Package Identifier', value: meta.packageId, isCode: true, canCopy: true });
      if (meta.jobId) details.push({ label: 'Job ID', value: meta.jobId, isCode: true, canCopy: true });
      if (evt.device?.name) details.push({ label: 'Device', value: evt.device.name });
      break;
    }

    case 'UPDATE_SUCCESS': {
      badgeLabel = 'Update Succeeded';
      badgeColor = 'emerald';
      icon = CheckCircle2;
      const toMatch = typeof evt.target === 'string' && evt.target.match(/^(.*?)\s+to\s+(.*)$/);
      if (toMatch) {
        const [, appName, toVer] = toMatch;
        title = `Successfully Updated ${appName}`;
        summary = meta.restartRequired
          ? `Version ${toVer} installed successfully. A system restart is required to complete setup.`
          : `Version ${toVer} installed and verified successfully.`;
        details.push({ label: 'Application Name', value: appName });
        details.push({ label: 'Upgraded Version', value: toVer });
      } else {
        title = `Successfully Updated ${evt.target}`;
        summary = 'Package installed and verified successfully.';
      }
      if (meta.verifiedVersion) details.push({ label: 'Verified Version', value: meta.verifiedVersion });
      if (meta.exitCode !== undefined) {
        details.push({
          label: 'Exit Code',
          value: meta.exitCode === 0 ? '0 (Success)' : `${meta.exitCode}`,
        });
      }
      details.push({
        label: 'System Restart',
        value: meta.restartRequired ? 'Required (Reboot to finish setup)' : 'Not Required',
      });
      if (meta.jobId) details.push({ label: 'Job ID', value: meta.jobId, isCode: true, canCopy: true });
      if (evt.device?.name) details.push({ label: 'Device', value: evt.device.name });
      break;
    }

    case 'UPDATE_FAILED': {
      badgeLabel = 'Update Failed';
      badgeColor = 'rose';
      icon = AlertTriangle;
      const toMatch = typeof evt.target === 'string' && evt.target.match(/^(.*?)\s+to\s+(.*)$/);
      if (toMatch) {
        const [, appName, toVer] = toMatch;
        title = `Update Failed: ${appName}`;
        summary = `Installation for version ${toVer} could not be verified or process exited with error.`;
        details.push({ label: 'Application Name', value: appName });
        details.push({ label: 'Target Version', value: toVer });
      } else {
        title = `Update Failed: ${evt.target}`;
        summary = 'The package update could not be completed.';
      }
      if (meta.exitCode !== undefined) {
        details.push({
          label: 'Exit Code',
          value: `${meta.exitCode} (Installation error)`,
        });
      }
      if (meta.verifiedVersion) details.push({ label: 'Detected Version', value: meta.verifiedVersion });
      if (meta.jobId) details.push({ label: 'Job ID', value: meta.jobId, isCode: true, canCopy: true });
      if (evt.device?.name) details.push({ label: 'Device', value: evt.device.name });
      break;
    }

    case 'UPDATE_CANCELLED':
      title = `Update Cancelled: ${evt.target}`;
      badgeLabel = 'Update Cancelled';
      badgeColor = 'neutral';
      icon = XCircle;
      summary = 'The queued update was cancelled by the user before execution.';
      if (targetJobId) details.push({ label: 'Job ID', value: targetJobId, isCode: true, canCopy: true });
      details.push({ label: 'Status', value: 'Cancelled prior to runner execution' });
      break;

    case 'UPDATE_RESTART_REQUIRED':
      title = `Restart Required: ${evt.target}`;
      badgeLabel = 'Restart Required';
      badgeColor = 'amber';
      icon = RefreshCw;
      summary = 'Installer reported success, but a Windows system reboot is required to finish.';
      if (meta.exitCode !== undefined) details.push({ label: 'Exit Code', value: `${meta.exitCode} (Reboot required)` });
      if (meta.jobId) details.push({ label: 'Job ID', value: meta.jobId, isCode: true, canCopy: true });
      break;

    case 'AGENT_PAIRED':
      title = 'Windows Agent Connected';
      badgeLabel = 'Agent Connected';
      badgeColor = 'blue';
      icon = Laptop;
      summary = `Device "${evt.target || 'Windows PC'}" successfully paired with UpdatePilot.`;
      details.push({ label: 'Device Hostname', value: evt.target });
      if (meta.osVersion) details.push({ label: 'Operating System', value: meta.osVersion });
      if (meta.agentVersion) details.push({ label: 'Agent Version', value: meta.agentVersion });
      break;

    case 'AGENT_REVOKED':
      title = 'Agent Access Revoked';
      badgeLabel = 'Agent Revoked';
      badgeColor = 'rose';
      icon = ShieldAlert;
      summary = `Host agent credentials for "${evt.target || 'Device'}" have been revoked.`;
      details.push({ label: 'Revoked Device', value: evt.target });
      break;

    default: {
      const cleanName = evt.eventType.replace(/_/g, ' ').toLowerCase();
      title = evt.target || cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      summary = Object.keys(meta).length > 0
        ? Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(' • ')
        : 'System event recorded.';
      badgeLabel = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      badgeColor = 'neutral';
      icon = Clock;
      for (const [k, v] of Object.entries(meta)) {
        details.push({ label: k, value: String(v) });
      }
      break;
    }
  }

  return {
    title,
    summary,
    badgeLabel,
    badgeColor,
    icon,
    details,
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
  };
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history }) => {
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'updates' | 'scans' | 'system'>('all');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

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
        : [columns.join(','), ...records.map((row: any) => columns.map(column => cell(row[column])).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([contents], { type: format === 'json' ? 'application/json' : 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `UpdatePilot-${kind}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export report.');
    } finally {
      setExporting(false);
    }
  };

  // Filter and search history
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    return history.filter((evt) => {
      // Category filter
      if (filterCategory === 'updates') {
        if (!evt.eventType.startsWith('UPDATE_')) return false;
      } else if (filterCategory === 'scans') {
        if (!evt.eventType.startsWith('SCAN_')) return false;
      } else if (filterCategory === 'system') {
        if (!evt.eventType.startsWith('AGENT_')) return false;
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTarget = evt.target && evt.target.toLowerCase().includes(q);
        const matchesType = evt.eventType && evt.eventType.toLowerCase().includes(q);
        const matchesMeta = evt.metadata && evt.metadata.toLowerCase().includes(q);
        const matchesActor = evt.actor && evt.actor.toLowerCase().includes(q);
        return matchesTarget || matchesType || matchesMeta || matchesActor;
      }

      return true;
    });
  }, [history, filterCategory, search]);

  const badgeColorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    neutral: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/20',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit & History</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Clear, immutable activity log of all software scans, update executions, and diagnostic results.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {exportError && (
            <span role="alert" className="text-rose-400 text-xs mr-2 font-medium">
              {exportError}
            </span>
          )}
          <button
            disabled={exporting}
            onClick={() => void exportReport('updates', 'csv')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors border border-surface-border"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
            <span>Update Report CSV</span>
          </button>
          <button
            id="btn-export-csv"
            disabled={exporting}
            onClick={() => void exportReport('inventory', 'csv')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors border border-surface-border"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Inventory CSV</span>
          </button>
          <button
            id="btn-export-json"
            disabled={exporting}
            onClick={() => void exportReport('inventory', 'json')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors border border-surface-border"
          >
            <FileCode className="w-3.5 h-3.5 text-brand-500" />
            <span>Inventory JSON</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-surface-border">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-medium">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              filterCategory === 'all'
                ? 'bg-brand-600 text-white font-semibold'
                : 'text-neutral-400 hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            All Activity ({history?.length ?? 0})
          </button>
          <button
            onClick={() => setFilterCategory('updates')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              filterCategory === 'updates'
                ? 'bg-brand-600 text-white font-semibold'
                : 'text-neutral-400 hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            Updates Only
          </button>
          <button
            onClick={() => setFilterCategory('scans')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              filterCategory === 'scans'
                ? 'bg-brand-600 text-white font-semibold'
                : 'text-neutral-400 hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            Scans Only
          </button>
          <button
            onClick={() => setFilterCategory('system')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              filterCategory === 'system'
                ? 'bg-brand-600 text-white font-semibold'
                : 'text-neutral-400 hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            Agent & System
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity, packages..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-surface-muted border border-surface-border text-foreground placeholder:text-neutral-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl bg-surface border border-surface-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-surface-border text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-44">Time & Actor</th>
                <th className="py-3 px-4 w-48">Event Status</th>
                <th className="py-3 px-4">Activity Description</th>
                <th className="py-3 px-4 text-right w-36">Diagnostics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filteredHistory && filteredHistory.length > 0 ? (
                filteredHistory.map((evt) => {
                  const formatted = formatAuditEvent(evt);
                  const isExpanded = expandedIds.has(evt.id);
                  const Icon = formatted.icon;

                  return (
                    <React.Fragment key={evt.id}>
                      <tr className="hover:bg-surface-muted/40 transition-colors group">
                        {/* Time & Actor */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-neutral-300 font-medium text-[11px] whitespace-nowrap">
                              {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                              {new Date(evt.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className={`inline-flex items-center gap-1 w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize mt-0.5 ${
                              evt.actor === 'user'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : evt.actor === 'agent'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}>
                              {evt.actor}
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              badgeColorClasses[formatted.badgeColor]
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatted.badgeLabel}</span>
                          </span>
                        </td>

                        {/* Target & Clear Description */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            <p className="font-bold text-foreground text-xs leading-snug">
                              {formatted.title}
                            </p>
                            <p className="text-neutral-400 text-xs leading-relaxed">
                              {formatted.summary}
                            </p>
                          </div>
                        </td>

                        {/* Expandable Details Button */}
                        <td className="py-3.5 px-4 align-top text-right">
                          {formatted.details.length > 0 ? (
                            <button
                              onClick={() => toggleExpand(evt.id)}
                              aria-expanded={isExpanded}
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                                isExpanded
                                  ? 'bg-brand-600/20 border-brand-500/30 text-brand-400'
                                  : 'bg-surface-muted hover:bg-surface-border border-surface-border text-neutral-400 hover:text-foreground'
                              }`}
                            >
                              <span>{isExpanded ? 'Hide' : 'View'} Details</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="text-neutral-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Technical Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-surface-muted/60 border-y border-surface-border/60">
                          <td colSpan={4} className="p-4 sm:px-6">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                                  <Terminal className="w-3.5 h-3.5 text-brand-400" />
                                  <span>Technical Diagnostic Metadata</span>
                                </div>
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
                                  Event ID: {evt.id.slice(0, 8)}...
                                </span>
                              </div>

                              {/* Details Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {formatted.details.map((detail, idx) => {
                                  const copyKey = `${evt.id}-${idx}`;
                                  const isCopied = copiedId === copyKey;

                                  return (
                                    <div
                                      key={idx}
                                      className="p-2.5 rounded-lg bg-surface border border-surface-border flex flex-col justify-between gap-1 shadow-sm"
                                    >
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                        {detail.label}
                                      </span>
                                      <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <span
                                          className={`text-xs text-foreground truncate ${
                                            detail.isCode ? 'font-mono text-neutral-300 text-[11px]' : ''
                                          }`}
                                          title={detail.value}
                                        >
                                          {detail.value}
                                        </span>
                                        {detail.canCopy && (
                                          <button
                                            onClick={() => copyToClipboard(detail.value, copyKey)}
                                            title="Copy to clipboard"
                                            className="p-1 rounded text-neutral-400 hover:text-foreground hover:bg-surface-muted transition-colors shrink-0"
                                          >
                                            {isCopied ? (
                                              <Check className="w-3 h-3 text-emerald-400" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Raw JSON toggle for advanced users */}
                              {formatted.rawMeta && (
                                <details className="text-[11px] text-neutral-400 pt-1 group/json">
                                  <summary className="cursor-pointer hover:text-foreground font-mono select-none">
                                    ▸ View Raw JSON Payload
                                  </summary>
                                  <pre className="mt-2 p-2.5 rounded-lg bg-surface border border-surface-border text-neutral-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(formatted.rawMeta, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="w-6 h-6 text-neutral-400 opacity-60" />
                      <p className="font-semibold text-sm">No activity events found</p>
                      <p className="text-xs text-neutral-400">
                        {search ? 'Try adjusting your search filter.' : 'All scans, updates, and authorizations will appear here.'}
                      </p>
                    </div>
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
