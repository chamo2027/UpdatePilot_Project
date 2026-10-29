'use client';

import React from 'react';
import {
  Layers,
  ArrowUpCircle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  ArrowRight,
  Laptop,
  Activity,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { NavTab } from './Sidebar';

interface OverviewViewProps {
  metrics: any;
  device: any;
  recentActivity: any[];
  onNavigate: (tab: NavTab) => void;
  onTriggerScan: () => void;
  isScanning: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  device,
  recentActivity,
  onNavigate,
  onTriggerScan,
  isScanning,
}) => {
  const chartData = [
    { name: 'Up to Date', value: metrics?.upToDate || 0, color: '#10b981' },
    { name: 'Update Available', value: metrics?.updatesAvailable || 0, color: '#f59e0b' },
    { name: 'Unsupported / Unmatched', value: metrics?.unsupportedOrUnknown || 0, color: '#64748b' },
  ].filter((d) => d.value > 0);

  const formattedLastScan = metrics?.lastScanTime
    ? new Date(metrics.lastScanTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Never';

  return (
    <div className="space-y-6">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">System Overview</h1>
          <p className="text-sm text-neutral-400">
            Real-time software update intelligence for your Windows host.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Last scanned:</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-surface-muted text-foreground border border-surface-border">
            {formattedLastScan}
          </span>
        </div>
      </div>

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Apps */}
        <div
          onClick={() => onNavigate('applications')}
          className="p-5 rounded-xl bg-surface border border-surface-border hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Installed Apps
            </span>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500 group-hover:scale-110 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {metrics?.totalApplications ?? 0}
          </div>
          <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1 group-hover:text-brand-500">
            <span>Explore full inventory</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        {/* Updates Available */}
        <div
          onClick={() => onNavigate('updates')}
          className="p-5 rounded-xl bg-surface border border-surface-border hover:border-amber-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Updates Available
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <ArrowUpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-500">
            {metrics?.updatesAvailable ?? 0}
          </div>
          <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1 group-hover:text-amber-500">
            <span>Review & update packages</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        {/* Up to Date */}
        <div className="p-5 rounded-xl bg-surface border border-surface-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Up to Date
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-500">
            {metrics?.upToDate ?? 0}
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Verified matches in sync with source
          </p>
        </div>

        {/* Security Findings */}
        <div
          onClick={() => onNavigate('security')}
          className="p-5 rounded-xl bg-surface border border-surface-border hover:border-rose-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Security Advisories
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-rose-500">
            {metrics?.securityAdvisoriesCount ?? 0}
          </div>
          <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1 group-hover:text-rose-500">
            <span>Inspect CVE findings</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </div>
      </div>

      {/* Middle Row: Visual Distribution + Host Machine Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution Chart */}
        <div className="p-5 rounded-xl bg-surface border border-surface-border lg:col-span-1 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Fleet Health</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Software inventory update breakdown</p>
          </div>

          <div className="h-48 w-full my-4 flex items-center justify-center">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-neutral-400">No scan data available yet</div>
            )}
          </div>

          <div className="space-y-2 text-xs">
            {chartData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-neutral-400">{d.name}</span>
                </div>
                <span className="font-semibold text-foreground">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Host Machine Profile & Status */}
        <div className="p-5 rounded-xl bg-surface border border-surface-border lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Target Host Environment</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Local Windows Agent telemetry & security state</p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  device?.status === 'online'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
                }`}
              >
                {device?.status === 'online' ? 'Active & Paired' : 'Awaiting Connection'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="p-3.5 rounded-lg bg-surface-muted border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Computer Name</span>
                </div>
                <div className="text-sm font-semibold text-foreground">{device?.name || 'Local Windows Host'}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-muted border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Operating System</span>
                </div>
                <div className="text-sm font-semibold text-foreground">{device?.osVersion || 'Windows 10/11'}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-muted border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Agent Version</span>
                </div>
                <div className="text-sm font-semibold text-foreground">{device?.agentVersion || '1.0.0-mvp'}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-muted border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Package Source</span>
                </div>
                <div className="text-sm font-semibold text-foreground">Windows Package Manager (WinGet)</div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-surface-border mt-6 flex flex-wrap gap-3">
            <button
              onClick={onTriggerScan}
              disabled={isScanning || device?.status !== 'online'}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 transition-colors"
            >
              {isScanning ? 'Scan In Progress...' : 'Run Full Host Scan'}
            </button>
            <button
              onClick={() => onNavigate('updates')}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
            >
              Inspect Available Updates
            </button>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-surface-muted hover:bg-surface-border text-foreground transition-colors"
            >
              View Audit Log
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="p-5 rounded-xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Recent Activity</h2>
            <p className="text-xs text-neutral-400">Audit log of system scans and package actions</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-medium text-brand-500 hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-3">
          {recentActivity && recentActivity.length > 0 ? (
            recentActivity.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-muted/60 border border-surface-border text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <div>
                    <span className="font-semibold text-foreground">{act.eventType}</span>
                    <span className="text-neutral-400 mx-2">·</span>
                    <span className="text-neutral-400">{act.target}</span>
                  </div>
                </div>
                <div className="text-neutral-400">
                  {new Date(act.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-neutral-400">
              No recent audit activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
