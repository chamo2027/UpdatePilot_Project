const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) window.dispatchEvent(new Event('updatepilot:session-expired'));
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  getDashboard: () => fetchJson<any>(`${API_BASE}/dashboard`),
  getDevices: () => fetchJson<any[]>(`${API_BASE}/devices`),
  triggerScan: (deviceId: string) =>
    fetchJson<any>(`${API_BASE}/devices/${deviceId}/scans`, { method: 'POST' }),
  getScanJob: (jobId: string) => fetchJson<any>(`${API_BASE}/scans/${jobId}`),
  getApplications: (params?: {
    deviceId?: string;
    search?: string;
    status?: string;
    source?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const query = new URLSearchParams();
    if (params?.deviceId) query.set('deviceId', params.deviceId);
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.source && params.source !== 'all') query.set('source', params.source);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
    return fetchJson<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `${API_BASE}/applications?${query.toString()}`
    );
  },
  getApplicationById: (id: string) => fetchJson<any>(`${API_BASE}/applications/${id}`),
  getUpdates: (deviceId?: string) =>
    fetchJson<any[]>(`${API_BASE}/updates${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''}`),
  previewUpdate: (appId: string) =>
    fetchJson<any>(`${API_BASE}/updates/${appId}/preview`, { method: 'POST' }),
  executeUpdate: (appId: string, targetVersion: string) =>
    fetchJson<any>(`${API_BASE}/updates/${appId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ applicationId: appId, targetVersion, confirmedByUser: true }),
    }),
  getJob: (jobId: string) => fetchJson<any>(`${API_BASE}/jobs/${jobId}`),
  getHistory: () => fetchJson<any[]>(`${API_BASE}/history`),
  cancelUpdate: (jobId: string) =>
    fetchJson<any>(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' }),
  getReport: (kind: 'inventory' | 'updates') =>
    fetchJson<Record<string, unknown>[]>(`${API_BASE}/reports/${kind}`),
  getSecurityFindings: () => fetchJson<any[]>(`${API_BASE}/security/findings`),
  revokeDevice: (deviceId: string) =>
    fetchJson<any>(`${API_BASE}/devices/${deviceId}/revoke`, { method: 'POST' }),
  register: (data: { email: string; password: string; name: string }) =>
    fetchJson<any>(`${API_BASE}/auth/register`, { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    fetchJson<any>(`${API_BASE}/auth/login`, { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => fetchJson<any>(`${API_BASE}/auth/me`),
  logout: () => fetchJson<any>(`${API_BASE}/auth/logout`, { method: 'POST' }),
};
