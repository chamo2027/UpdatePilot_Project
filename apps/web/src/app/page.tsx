'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../components/Header';
import { Sidebar, NavTab } from '../components/Sidebar';
import { OverviewView } from '../components/OverviewView';
import { ApplicationsView, InventorySort } from '../components/ApplicationsView';
import { UpdatesView } from '../components/UpdatesView';
import { SecurityView } from '../components/SecurityView';
import { HistoryView } from '../components/HistoryView';
import { SettingsView } from '../components/SettingsView';
import { SafeUpdateModal } from '../components/SafeUpdateModal';
import { AppDetailModal } from '../components/AppDetailModal';
import { ConnectDeviceModal } from '../components/ConnectDeviceModal';
import { Shield, Laptop, Plus } from 'lucide-react';
import { api } from '../lib/api';

export default function Home() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getMe()
      .then(user => {
        setCurrentUser(user);
        setSignedIn(true);
      })
      .catch(() => {
        fetch('/api/v1/session')
          .then(res => {
            if (res.ok) {
              setCurrentUser({ name: 'Admin', role: 'admin' });
              setSignedIn(true);
            } else {
              setSignedIn(false);
            }
          })
          .catch(() => setSignedIn(false));
      });

    const expire = () => {
      setSignedIn(false);
      setCurrentUser(null);
    };
    window.addEventListener('updatepilot:session-expired', expire);
    return () => window.removeEventListener('updatepilot:session-expired', expire);
  }, []);

  if (signedIn === null) {
    return (
      <main className="grid min-h-screen place-items-center p-6 bg-surface-muted/30">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-sm text-neutral-400">Loading UpdatePilot Cloud...</p>
        </div>
      </main>
    );
  }

  if (signedIn) {
    return (
      <Dashboard
        currentUser={currentUser}
        onSignOut={async () => {
          try {
            await api.logout();
          } catch {
            await fetch('/api/v1/session', { method: 'DELETE' }).catch(() => null);
          }
          setSignedIn(false);
          setCurrentUser(null);
        }}
      />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center p-6 bg-gradient-to-br from-surface to-surface-muted/40">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">UpdatePilot Cloud</h1>
          <p className="text-xs text-neutral-400">
            {authMode === 'login' ? 'Sign in to access your personal application inventory' : 'Create an account to monitor and update your Windows PC'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 rounded-xl bg-surface-muted p-1 border border-surface-border">
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setError(''); }}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              authMode === 'login'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-neutral-400 hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('register'); setError(''); }}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              authMode === 'register'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-neutral-400 hover:text-foreground'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form
          className="space-y-4"
          onSubmit={async event => {
            event.preventDefault();
            setSubmitting(true);
            setError('');
            try {
              if (authMode === 'register') {
                const user = await api.register({ email, password, name });
                setCurrentUser(user);
                setSignedIn(true);
              } else {
                if (email.includes('@')) {
                  const user = await api.login({ email, password });
                  setCurrentUser(user);
                  setSignedIn(true);
                } else {
                  // Legacy password-only login fallback
                  const response = await fetch('/api/v1/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                  });
                  if (!response.ok) {
                    const result = await response.json().catch(() => ({}));
                    throw new Error(result.error || 'Incorrect dashboard password.');
                  }
                  const me = await api.getMe().catch(() => ({ name: 'Admin', role: 'admin' }));
                  setCurrentUser(me);
                  setSignedIn(true);
                }
              }
            } catch (failure: any) {
              setError(failure.message || 'Could not connect to the server.');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1" htmlFor="user-name">
                Full Name
              </label>
              <input
                id="user-name"
                className="w-full rounded-xl border border-surface-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                type="text"
                placeholder="Chamodya"
                value={name}
                required
                onChange={event => setName(event.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1" htmlFor="user-email">
              {authMode === 'register' ? 'Email Address' : 'Email Address (or leave empty for admin password)'}
            </label>
            <input
              id="user-email"
              className="w-full rounded-xl border border-surface-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              type="text"
              placeholder={authMode === 'register' ? 'name@example.com' : 'name@example.com'}
              value={email}
              required={authMode === 'register'}
              onChange={event => setEmail(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1" htmlFor="user-password">
              Password {authMode === 'register' && '(min 8 characters)'}
            </label>
            <input
              id="user-password"
              className="w-full rounded-xl border border-surface-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              type="password"
              placeholder="••••••••"
              value={password}
              required
              onChange={event => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-[0.99] py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50"
          >
            {submitting
              ? 'Connecting…'
              : authMode === 'register'
              ? 'Create Account & Continue'
              : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}

function Dashboard({ onSignOut, currentUser }: { onSignOut: () => Promise<void>; currentUser?: any }) {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showConnectModal, setShowConnectModal] = useState(false);

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
  const [sort, setSort] = useState<InventorySort>('name');

  const [updates, setUpdates] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [connectionError, setConnectionError] = useState(false);
  const [scanError, setScanError] = useState('');
  const [notifications, setNotifications] = useState(false);
  const seenUpdates = useRef<Set<string> | null>(null);

  // Modals & Operations
  const [isScanning, setIsScanning] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [selectedAppForDetail, setSelectedAppForDetail] = useState<any | null>(null);
  const [selectedAppForUpdate, setSelectedAppForUpdate] = useState<any | null>(null);

  useEffect(() => {
    setNotifications(localStorage.getItem('updatepilot-notifications') === 'on');
    const saved = localStorage.getItem('updatepilot-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
      document.documentElement.classList.toggle('light', saved === 'light');
    }
  }, []);

  // Toggle Dark/Light Theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('updatepilot-theme', nextTheme);
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
      const devicesData = await api.getDevices().catch(() => []);
      const primaryDevice = devicesData[0] || null;
      setDevice(primaryDevice);

      const [metricsData, updatesData, findingsData, historyData] =
        await Promise.all([
          api.getDashboard().catch(() => null),
          api.getUpdates(primaryDevice?.id).catch(() => null),
          api.getSecurityFindings().catch(() => []),
          api.getHistory().catch(() => []),
        ]);

      setConnectionError(!metricsData);
      if (metricsData) setMetrics({ ...metricsData, securityAdvisoriesCount: findingsData.length });
      if (updatesData) setUpdates(updatesData);
      if (findingsData) setFindings(findingsData);
      if (historyData) setHistory(historyData);
    } catch (e) {
      console.error('Error refreshing core data:', e);
    }
  }, []);

  useEffect(() => {
    if (!metrics || connectionError) return;
    const keys = new Set(updates.map(app => app.id + ':' + app.availableVersion));
    const previous = seenUpdates.current;
    seenUpdates.current = keys;
    if (!previous || !notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const count = Array.from(keys).filter(key => !previous.has(key)).length;
    if (count) {
      try {
        new Notification('UpdatePilot', { body: count + (count === 1 ? ' new update is available.' : ' new updates are available.') });
      } catch {
        // Some browsers only support notifications through a service worker.
      }
    }
  }, [updates, metrics, connectionError, notifications]);

  // Fetch Applications (with filters/pagination)
  const refreshApplications = useCallback(async () => {
    try {
      const res = await api.getApplications({
        deviceId: device?.id,
        search,
        status: statusFilter,
        source: sourceFilter,
        sortBy: sort === 'publisher' ? 'publisher' : sort === 'status' ? 'updateStatus' :
          sort === 'recent' ? 'lastScannedAt' : 'displayName',
        sortOrder: sort === 'name_desc' || sort === 'recent' ? 'desc' : 'asc',
        page,
        pageSize: 15,
      });
      setApplications(res.items || []);
      setTotalApps(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error('Error refreshing applications:', e);
    }
  }, [device?.id, search, statusFilter, sourceFilter, sort, page]);

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
          if (scan.state === 'failed') setScanError(scan.errorMessage || 'The scan failed. Check the Windows agent.');
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
      setScanError('');
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
        user={currentUser}
        isScanning={isScanning}
        onTriggerScan={handleTriggerScan}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenConnectModal={() => setShowConnectModal(true)}
        onSignOut={onSignOut}
      />

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          updatesCount={updates.length}
          securityCount={findings.length}
        />

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 bg-background p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {connectionError && <p role="alert" className="mb-4 rounded border border-surface-border p-3">
              The server is unavailable. Displayed results may be out of date.
            </p>}
            {scanError && <p role="alert" className="mb-4 rounded border border-surface-border p-3">{scanError}</p>}

            {!device && !connectionError && (
              <div className="mb-6 rounded-2xl border border-dashed border-brand-500/40 bg-brand-500/5 p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 mx-auto">
                  <Laptop className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">No Windows Computer Connected</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Link this machine or any Windows laptop to your private UpdatePilot account using your personal pairing key.
                </p>
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Connect My Computer
                </button>
              </div>
            )}
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
                sort={sort}
                onSortChange={value => { setSort(value); setPage(1); }}
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
              <HistoryView history={history} />
            )}

            {currentTab === 'settings' && (
              <>
                <SettingsView
                  device={device}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onRefresh={refreshCore}
                />
                <button onClick={() => void onSignOut()} className="mt-4 rounded border border-surface-border px-4 py-2">
                  Sign out
                </button>
                <button type="button" aria-pressed={notifications}
                  className="ml-2 mt-4 rounded border border-surface-border px-4 py-2"
                  onClick={async () => {
                    if (notifications) {
                      setNotifications(false);
                      localStorage.setItem('updatepilot-notifications', 'off');
                      return;
                    }
                    if (typeof Notification === 'undefined' || await Notification.requestPermission() !== 'granted') {
                      window.alert('Allow notifications in your browser to enable this setting.');
                      return;
                    }
                    setNotifications(true);
                    localStorage.setItem('updatepilot-notifications', 'on');
                  }}>
                  {notifications ? 'Turn off update notifications' : 'Enable update notifications'}
                </button>
              </>
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

      {/* Connect PC Pairing Modal */}
      {showConnectModal && (
        <ConnectDeviceModal
          user={currentUser}
          onClose={() => {
            setShowConnectModal(false);
            refreshCore();
          }}
        />
      )}
    </div>
  );
}
