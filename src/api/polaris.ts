import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';

// --- Polaris AuditData schema (matches pkg/validator/output.go) ---

/**
 * Severity level for a Polaris check result.
 */
type Severity = 'ignore' | 'warning' | 'danger';

/**
 * A single Polaris check result message.
 */
interface ResultMessage {
  /** Unique identifier for the check */
  ID: string;
  /** Human-readable message describing the check */
  Message: string;
  /** Additional details or context for the check */
  Details: string[];
  /** Whether the check passed (true) or failed (false) */
  Success: boolean;
  /** Severity level of the check */
  Severity: Severity;
  /** Category/group this check belongs to (e.g., "Security", "Efficiency") */
  Category: string;
}

/**
 * Collection of check results keyed by check ID.
 */
type ResultSet = Record<string, ResultMessage>;

/**
 * Polaris audit results for a single container within a pod.
 */
interface ContainerResult {
  /** Container name */
  Name: string;
  /** Check results for this container */
  Results: ResultSet;
}

/**
 * Polaris audit results for a pod and its containers.
 */
interface PodResult {
  /** Pod name */
  Name: string;
  /** Pod-level check results */
  Results: ResultSet;
  /** Per-container check results */
  ContainerResults: ContainerResult[];
}

/**
 * Polaris audit result for a single Kubernetes resource.
 */
export interface Result {
  /** Resource name */
  Name: string;
  /** Kubernetes namespace */
  Namespace: string;
  /** Kubernetes resource kind (e.g., "Deployment", "StatefulSet") */
  Kind: string;
  /** Resource-level check results */
  Results: ResultSet;
  /** Pod-level results (for workload controllers) */
  PodResult?: PodResult;
  /** ISO 8601 timestamp when resource was created */
  CreatedTime: string;
}

/**
 * Cluster metadata from Polaris audit.
 */
interface ClusterInfo {
  /** Kubernetes version */
  Version: string;
  /** Number of nodes in cluster */
  Nodes: number;
  /** Number of pods in cluster */
  Pods: number;
  /** Number of namespaces in cluster */
  Namespaces: number;
  /** Number of controllers (workloads) in cluster */
  Controllers: number;
}

/**
 * Complete Polaris audit data structure returned by the dashboard API.
 */
export interface AuditData {
  /** Polaris output schema version */
  PolarisOutputVersion: string;
  /** ISO 8601 timestamp of when audit was performed */
  AuditTime: string;
  /** Source type (e.g., "Cluster") */
  SourceType: string;
  /** Source identifier */
  SourceName: string;
  /** Human-readable cluster name */
  DisplayName: string;
  /** Cluster statistics */
  ClusterInfo: ClusterInfo;
  /** All audit results across the cluster */
  Results: Result[];
}

// --- Result counting ---

/**
 * Aggregated counts of check results by status.
 */
export interface ResultCounts {
  /** Total number of checks performed */
  total: number;
  /** Number of checks that passed */
  pass: number;
  /** Number of checks with warning severity that failed */
  warning: number;
  /** Number of checks with danger severity that failed */
  danger: number;
  /** Number of checks with severity "ignore" that failed (skipped by Polaris config) */
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

/**
 * Counts check results by status across all resources in the audit data.
 *
 * @param data - Complete Polaris audit data
 * @returns Aggregated counts (total, pass, warning, danger, skipped)
 */
export function countResults(data: AuditData): ResultCounts {
  return countResultItems(data.Results);
}

/**
 * Counts check results for a specific set of resources.
 *
 * @param results - Array of Polaris audit results
 * @returns Aggregated counts (total, pass, warning, danger, skipped)
 */
export function countResultsForItems(results: Result[]): ResultCounts {
  return countResultItems(results);
}

/**
 * Extracts unique namespaces from audit data, sorted alphabetically.
 *
 * @param data - Complete Polaris audit data
 * @returns Sorted array of namespace names
 */
export function getNamespaces(data: AuditData): string[] {
  const namespaces = new Set<string>();
  for (const result of data.Results) {
    if (result.Namespace) {
      namespaces.add(result.Namespace);
    }
  }
  return Array.from(namespaces).sort();
}

/**
 * Filters audit results to only those in a specific namespace.
 *
 * @param data - Complete Polaris audit data
 * @param namespace - Target namespace name
 * @returns Array of results matching the namespace
 */
export function filterResultsByNamespace(data: AuditData, namespace: string): Result[] {
  return data.Results.filter(r => r.Namespace === namespace);
}

// --- Settings ---

/**
 * Predefined refresh interval options for the plugin settings UI.
 */
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

/**
 * Retrieves the configured refresh interval from localStorage.
 *
 * @returns Refresh interval in seconds (default: 300)
 */
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

/**
 * Saves the refresh interval to localStorage.
 *
 * @param seconds - Refresh interval in seconds
 */
export function setRefreshInterval(seconds: number): void {
  localStorage.setItem(REFRESH_STORAGE_KEY, String(seconds));
}

/**
 * Retrieves the configured Polaris dashboard URL from localStorage.
 *
 * @returns Dashboard URL (default: Kubernetes service proxy path)
 */
export function getDashboardUrl(): string {
  const stored = localStorage.getItem(URL_STORAGE_KEY);
  if (stored !== null && stored.trim() !== '') {
    return stored.trim();
  }
  return DEFAULT_DASHBOARD_URL;
}

/**
 * Saves the Polaris dashboard URL to localStorage.
 *
 * @param url - Dashboard URL (service proxy path or full URL)
 */
export function setDashboardUrl(url: string): void {
  localStorage.setItem(URL_STORAGE_KEY, url.trim());
}

// --- Polaris dashboard proxy URL ---

/**
 * Returns the base URL for the Polaris dashboard proxy.
 *
 * @returns Dashboard base URL (without /results.json)
 */
export function getPolarisProxyUrl(): string {
  return getDashboardUrl();
}

// --- Score computation ---

/**
 * Computes the Polaris score as a percentage (0-100).
 *
 * Formula: (pass / total) * 100, rounded to nearest integer.
 *
 * @param counts - Result counts to compute score from
 * @returns Score percentage (0 if total is 0)
 */
export function computeScore(counts: ResultCounts): number {
  if (counts.total === 0) return 0;
  return Math.round((counts.pass / counts.total) * 100);
}

// --- Data fetching hook ---

/**
 * Constructs the full API path for fetching Polaris results.
 *
 * @returns Full path to results.json endpoint
 */
function getPolarisApiPath(): string {
  const baseUrl = getDashboardUrl();
  return baseUrl.endsWith('/') ? `${baseUrl}results.json` : `${baseUrl}/results.json`;
}

/**
 * Checks if a URL is a full URL (http:// or https://) vs. a relative path.
 *
 * @param url - URL to check
 * @returns true if full URL, false if relative path
 */
function isFullUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * State returned by the usePolarisData hook.
 */
interface PolarisDataState {
  /** Polaris audit data (null if not yet loaded or error occurred) */
  data: AuditData | null;
  /** Whether data is currently being loaded */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Function to manually trigger a data refresh */
  triggerRefresh: () => void;
}

/**
 * React hook for fetching and auto-refreshing Polaris audit data.
 *
 * Handles both Kubernetes service proxy paths and full URLs.
 * Automatically refreshes data at the specified interval.
 *
 * @param refreshIntervalSeconds - How often to refresh data (0 to disable auto-refresh)
 * @returns Polaris data state (data, loading, error, triggerRefresh)
 *
 * @example
 * ```typescript
 * const { data, loading, error, triggerRefresh } = usePolarisData(300);
 * if (loading) return <Loader />;
 * if (error) return <Error message={error} />;
 * return <Dashboard data={data} onRefresh={triggerRefresh} />;
 * ```
 */
export function usePolarisData(refreshIntervalSeconds: number): PolarisDataState {
  const [data, setData] = React.useState<AuditData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const triggerRefresh = React.useCallback(() => {
    setTick(t => t + 1);
  }, []);

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

  return { data, loading, error, triggerRefresh };
}
