import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';

// --- Polaris AuditData schema (matches pkg/validator/output.go) ---

type Severity = 'ignore' | 'warning' | 'danger';

interface ResultMessage {
  ID: string;
  Message: string;
  Details: string[];
  Success: boolean;
  Severity: Severity;
  Category: string;
}

type ResultSet = Record<string, ResultMessage>;

interface ContainerResult {
  Name: string;
  Results: ResultSet;
}

interface PodResult {
  Name: string;
  Results: ResultSet;
  ContainerResults: ContainerResult[];
}

export interface Result {
  Name: string;
  Namespace: string;
  Kind: string;
  Results: ResultSet;
  PodResult?: PodResult;
  CreatedTime: string;
}

interface ClusterInfo {
  Version: string;
  Nodes: number;
  Pods: number;
  Namespaces: number;
  Controllers: number;
}

export interface AuditData {
  PolarisOutputVersion: string;
  AuditTime: string;
  SourceType: string;
  SourceName: string;
  DisplayName: string;
  ClusterInfo: ClusterInfo;
  Results: Result[];
}

// --- Result counting ---

export interface ResultCounts {
  total: number;
  pass: number;
  warning: number;
  danger: number;
  skipped: number;
}

function countResultSet(rs: ResultSet, counts: ResultCounts): void {
  for (const key of Object.keys(rs)) {
    const msg = rs[key];
    counts.total++;
    if (msg.Success) {
      counts.pass++;
    } else if (msg.Severity === 'ignore') {
      counts.skipped++;
    } else if (msg.Severity === 'warning') {
      counts.warning++;
    } else if (msg.Severity === 'danger') {
      counts.danger++;
    }
  }
}

function countResultItems(results: Result[]): ResultCounts {
  const counts: ResultCounts = { total: 0, pass: 0, warning: 0, danger: 0, skipped: 0 };
  for (const result of results) {
    countResultSet(result.Results, counts);
    if (result.PodResult) {
      countResultSet(result.PodResult.Results, counts);
      for (const container of result.PodResult.ContainerResults) {
        countResultSet(container.Results, counts);
      }
    }
  }
  return counts;
}

export function countResults(data: AuditData): ResultCounts {
  return countResultItems(data.Results);
}

export function countResultsForItems(results: Result[]): ResultCounts {
  return countResultItems(results);
}

export function getNamespaces(data: AuditData): string[] {
  const namespaces = new Set<string>();
  for (const result of data.Results) {
    if (result.Namespace) {
      namespaces.add(result.Namespace);
    }
  }
  return Array.from(namespaces).sort();
}

export function filterResultsByNamespace(data: AuditData, namespace: string): Result[] {
  return data.Results.filter(r => r.Namespace === namespace);
}

// --- Settings ---

export const INTERVAL_OPTIONS = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '30 minutes', value: 1800 },
];

const REFRESH_STORAGE_KEY = 'polaris-plugin-refresh-interval';
const DEFAULT_INTERVAL_SECONDS = 300; // 5 minutes

const URL_STORAGE_KEY = 'polaris-plugin-dashboard-url';
const DEFAULT_DASHBOARD_URL = '/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/';

export function getRefreshInterval(): number {
  const stored = localStorage.getItem(REFRESH_STORAGE_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_INTERVAL_SECONDS;
}

export function setRefreshInterval(seconds: number): void {
  localStorage.setItem(REFRESH_STORAGE_KEY, String(seconds));
}

export function getDashboardUrl(): string {
  const stored = localStorage.getItem(URL_STORAGE_KEY);
  if (stored !== null && stored.trim() !== '') {
    return stored.trim();
  }
  return DEFAULT_DASHBOARD_URL;
}

export function setDashboardUrl(url: string): void {
  localStorage.setItem(URL_STORAGE_KEY, url.trim());
}

// --- Polaris dashboard proxy URL ---

export function getPolarisProxyUrl(): string {
  return getDashboardUrl();
}

// --- Score computation ---

export function computeScore(counts: ResultCounts): number {
  if (counts.total === 0) return 0;
  return Math.round((counts.pass / counts.total) * 100);
}

// --- Data fetching hook ---

function getPolarisApiPath(): string {
  const baseUrl = getDashboardUrl();
  return baseUrl.endsWith('/') ? `${baseUrl}results.json` : `${baseUrl}/results.json`;
}

function isFullUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

interface PolarisDataState {
  data: AuditData | null;
  loading: boolean;
  error: string | null;
}

export function usePolarisData(refreshIntervalSeconds: number): PolarisDataState {
  const [data, setData] = React.useState<AuditData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const apiPath = getPolarisApiPath();
        let result: AuditData;

        if (isFullUrl(apiPath)) {
          // Direct fetch for full URLs
          const response = await fetch(apiPath);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          result = await response.json();
        } else {
          // Kubernetes proxy for relative URLs
          result = await ApiProxy.request(apiPath);
        }

        if (!cancelled) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const apiPath = getPolarisApiPath();
        const status = (err as { status?: number }).status;

        if (isFullUrl(apiPath)) {
          // Full URL errors
          if (status === 403) {
            setError('Access denied (403). Check authentication and CORS configuration.');
          } else if (status === 404) {
            setError('Polaris dashboard not found (404). Verify the URL is correct.');
          } else {
            setError(`Failed to fetch from ${apiPath}: ${String(err)}`);
          }
        } else {
          // Kubernetes proxy errors
          if (status === 403) {
            setError(
              'Access denied (403). Check that your RBAC permissions allow proxying to the Polaris service.'
            );
          } else if (status === 404 || status === 503) {
            setError(
              'Polaris dashboard not reachable. Ensure Polaris is installed in the configured namespace.'
            );
          } else {
            setError(`Failed to fetch Polaris data: ${String(err)}`);
          }
        }
        setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Periodic refresh
  React.useEffect(() => {
    if (refreshIntervalSeconds <= 0) return;
    const intervalId = window.setInterval(() => {
      setTick(t => t + 1);
    }, refreshIntervalSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [refreshIntervalSeconds]);

  return { data, loading, error };
}
