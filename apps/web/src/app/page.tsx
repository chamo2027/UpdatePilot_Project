'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Sidebar, NavTab } from '../components/Sidebar';
import { OverviewView } from '../components/OverviewView';
import { ApplicationsView } from '../components/ApplicationsView';
import { UpdatesView } from '../components/UpdatesView';
import { SecurityView } from '../components/SecurityView';
import { HistoryView } from '../components/HistoryView';
import { SettingsView } from '../components/SettingsView';
import { SafeUpdateModal } from '../components/SafeUpdateModal';
import { AppDetailModal } from '../components/AppDetailModal';
import { api } from '../lib/api';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Core Data States
  const [metrics, setMetrics] = useState<any>(null);
  const [device, setDevice] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [totalApps, setTotalApps] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const [updates, setUpdates] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // Modals & Operations
  const [isScanning, setIsScanning] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [selectedAppForDetail, setSelectedAppForDetail] = useState<any | null>(null);
  const [selectedAppForUpdate, setSelectedAppForUpdate] = useState<any | null>(null);

  // Toggle Dark/Light Theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  // Fetch Dashboard & Device
  const refreshCore = useCallback(async () => {
    try {
      const [metricsData, devicesData, updatesData, findingsData, historyData] =
        await Promise.all([
          api.getDashboard().catch(() => null),
          api.getDevices().catch(() => []),
          api.getUpdates().catch(() => []),
          api.getSecurityFindings().catch(() => []),
          api.getHistory().catch(() => []),
        ]);

      if (metricsData) setMetrics(metricsData);
      if (devicesData && devicesData.length > 0) setDevice(devicesData[0]);
      if (updatesData) setUpdates(updatesData);
      if (findingsData) setFindings(findingsData);
      if (historyData) setHistory(historyData);
    } catch (e) {
      console.error('Error refreshing core data:', e);
    }
  }, []);

  // Fetch Applications (with filters/pagination)
  const refreshApplications = useCallback(async () => {
    try {
      const res = await api.getApplications({
        search,
        status: statusFilter,
        source: sourceFilter,
        page,
        pageSize: 15,
      });
      setApplications(res.items || []);
      setTotalApps(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error('Error refreshing applications:', e);
    }
  }, [search, statusFilter, sourceFilter, page]);

  // Initial mount
  useEffect(() => {
    refreshCore();
  }, [refreshCore]);

  useEffect(() => {
    refreshApplications();
  }, [refreshApplications]);

  // Background refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      refreshCore();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshCore]);

  // Track scanning progress if activeScanId is set
  useEffect(() => {
    if (!activeScanId || !isScanning) return;

    const interval = setInterval(async () => {
      try {
        const scan = await api.getScanJob(activeScanId);
        if (scan.state === 'completed' || scan.state === 'failed') {
          setIsScanning(false);
          setActiveScanId(null);
          refreshCore();
          refreshApplications();
          clearInterval(interval);
        }
      } catch {
        // Retry
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeScanId, isScanning, refreshCore, refreshApplications]);

  // Trigger Scan
  const handleTriggerScan = async () => {
    if (!device?.id || isScanning) return;
    try {
      setIsScanning(true);
      const job = await api.triggerScan(device.id);
      setActiveScanId(job.id);
    } catch (err: any) {
      setIsScanning(false);
      alert(err.message || 'Scan trigger failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      {/* Top Header */}
      <Header
        device={device}
        isScanning={isScanning}
        onTriggerScan={handleTriggerScan}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          updatesCount={updates.length}
          securityCount={findings.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'overview' && (
              <OverviewView
                metrics={metrics}
                device={device}
                recentActivity={history}
                onNavigate={setCurrentTab}
                onTriggerScan={handleTriggerScan}
                isScanning={isScanning}
              />
            )}

            {currentTab === 'applications' && (
              <ApplicationsView
                applications={applications}
                total={totalApps}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                search={search}
                onSearchChange={(q) => {
                  setSearch(q);
                  setPage(1);
                }}
                statusFilter={statusFilter}
                onStatusFilterChange={(s) => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                sourceFilter={sourceFilter}
                onSourceFilterChange={(s) => {
                  setSourceFilter(s);
                  setPage(1);
                }}
                onSelectApp={setSelectedAppForDetail}
                onOpenUpdateModal={setSelectedAppForUpdate}
              />
            )}

            {currentTab === 'updates' && (
              <UpdatesView
                updates={updates}
                onOpenUpdateModal={setSelectedAppForUpdate}
                onRefresh={() => {
                  refreshCore();
                  refreshApplications();
                }}
              />
            )}

            {currentTab === 'security' && (
              <SecurityView
                findings={findings}
                onNavigateToUpdates={() => setCurrentTab('updates')}
              />
            )}

            {currentTab === 'history' && (
              <HistoryView history={history} applications={applications} />
            )}

            {currentTab === 'settings' && (
              <SettingsView
                device={device}
                theme={theme}
                onToggleTheme={toggleTheme}
                onRefresh={refreshCore}
              />
            )}
          </div>
        </main>
      </div>

      {/* Safe Update Confirmation Modal */}
      {selectedAppForUpdate && (
        <SafeUpdateModal
          app={selectedAppForUpdate}
          onClose={() => setSelectedAppForUpdate(null)}
          onSuccess={() => {
            refreshCore();
            refreshApplications();
          }}
        />
      )}

      {/* Application Detail Drawer / Modal */}
      {selectedAppForDetail && (
        <AppDetailModal
          appId={selectedAppForDetail.id}
          onClose={() => setSelectedAppForDetail(null)}
          onTriggerUpdate={(app) => {
            setSelectedAppForDetail(null);
            setSelectedAppForUpdate(app);
          }}
        />
      )}
    </div>
  );
}
