'use client';

import React, { useState } from 'react';
export type InventorySort = 'name' | 'name_desc' | 'publisher' | 'status' | 'recent';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Info,
  ArrowUpCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface ApplicationsViewProps {
  applications: any[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  search: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (source: string) => void;
  sort: InventorySort;
  onSortChange: (sort: InventorySort) => void;
  onSelectApp: (app: any) => void;
  onOpenUpdateModal: (app: any) => void;
}

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({
  applications,
  total,
  page,
  totalPages,
  onPageChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  sort,
  onSortChange,
  onSelectApp,
  onOpenUpdateModal,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Application Inventory</h1>
          <p className="text-sm text-neutral-400">
            {total} detected applications on current host machine.
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl bg-surface border border-surface-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-app-search"
            aria-label="Search applications"
            type="text"
            placeholder="Search by application name, package ID, or publisher..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-surface-muted text-foreground placeholder:text-neutral-500 pl-10 pr-4 py-2 rounded-lg text-xs border border-surface-border focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            id="select-status-filter"
            aria-label="Filter by update status"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-surface-muted text-foreground text-xs px-3 py-2 rounded-lg border border-surface-border focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="update_available">Update Available</option>
            <option value="up_to_date">Up to Date</option>
            <option value="unsupported">Unsupported / Registry</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            id="select-source-filter"
            aria-label="Filter by package source"
            value={sourceFilter}
            onChange={(e) => onSourceFilterChange(e.target.value)}
            className="bg-surface-muted text-foreground text-xs px-3 py-2 rounded-lg border border-surface-border focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Sources</option>
            <option value="winget">WinGet</option>
            <option value="registry">Windows Registry</option>
          </select>
          <select aria-label="Sort applications" value={sort}
            onChange={event => onSortChange(event.target.value as InventorySort)}
            className="rounded-lg border border-surface-border bg-surface-muted px-3 py-2 text-xs">
            <option value="name">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="publisher">Publisher</option>
            <option value="status">Update status</option>
            <option value="recent">Recently scanned</option>
          </select>
        </div>
      </div>

      {/* Applications Data Table */}
      <div className="rounded-xl bg-surface border border-surface-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-surface-border text-neutral-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Application & Publisher</th>
                <th className="py-3 px-4">Package Identifier</th>
                <th className="py-3 px-4">Installed Version</th>
                <th className="py-3 px-4">Available Version</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {applications && applications.length > 0 ? (
                applications.map((app) => {
                  const hasUpdate = app.updateStatus === 'update_available';
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-surface-muted/50 transition-colors group cursor-pointer"
                      onClick={() => onSelectApp(app)}
                    >
                      {/* Name & Publisher */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground group-hover:text-brand-500 transition-colors">
                          {app.displayName}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {app.publisher || 'Unknown Publisher'}
                        </div>
                      </td>

                      {/* Package ID */}
                      <td className="py-3.5 px-4">
                        {app.packageId ? (
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-muted text-neutral-300 border border-surface-border">
                            {app.packageId}
                          </span>
                        ) : (
                          <span className="text-neutral-500 italic text-[11px]">Unmatched</span>
                        )}
                      </td>

                      {/* Installed Version */}
                      <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                        {app.installedVersion}
                      </td>

                      {/* Available Version */}
                      <td className="py-3.5 px-4">
                        {app.availableVersion ? (
                          <span className="font-mono text-amber-500 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                            {app.availableVersion}
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-0.5 rounded text-[11px] font-medium bg-surface-muted text-neutral-400 border border-surface-border">
                          {app.source}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {app.updateStatus === 'update_available' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Update Ready
                          </span>
                        )}
                        {app.updateStatus === 'up_to_date' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Up to Date
                          </span>
                        )}
                        {app.updateStatus === 'unsupported' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                            Registry Unmanaged
                          </span>
                        )}
                        {app.updateStatus === 'unknown' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                            Unknown
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectApp(app)}
                          className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-border text-neutral-400 hover:text-foreground transition-colors"
                          title="View Application Details"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        {hasUpdate && (
                          <button
                            onClick={() => onOpenUpdateModal(app)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span>Update</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <p className="text-sm font-medium">No applications match your criteria</p>
                    <p className="text-xs text-neutral-500 mt-1">Try adjusting your search query or status filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-surface-border bg-surface flex items-center justify-between text-xs text-neutral-400">
          <div>
            Page <span className="font-semibold text-foreground">{page}</span> of{' '}
            <span className="font-semibold text-foreground">{Math.max(1, totalPages)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-border disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-border disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
