import React from 'react';
import { AuditData, getRefreshInterval, usePolarisData } from './polaris';

/**
 * Shared Polaris data context value provided to all plugin components.
 */
interface PolarisDataContextValue {
  /** Polaris audit data (null if not loaded or error) */
  data: AuditData | null;
  /** Whether data is currently being loaded */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Function to manually trigger a data refresh */
  refresh: () => void;
}

const PolarisDataContext = React.createContext<PolarisDataContextValue | null>(null);

/**
 * React Context provider for shared Polaris data across all plugin components.
 *
 * Fetches data once and shares it with all consuming components to avoid
 * duplicate API requests. Auto-refreshes based on user's configured interval.
 *
 * @param props - Component props
 * @param props.children - Child components that will consume the context
 *
 * @example
 * ```typescript
 * <PolarisDataProvider>
 *   <DashboardView />
 *   <NamespacesListView />
 * </PolarisDataProvider>
 * ```
 */
export function PolarisDataProvider(props: { children: React.ReactNode }) {
  // Re-read interval on every render to pick up changes from settings
  const [refreshInterval, setRefreshInterval] = React.useState(getRefreshInterval());

  // Poll for interval changes (localStorage changes from settings)
  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      const newInterval = getRefreshInterval();
      setRefreshInterval(prev => (prev !== newInterval ? newInterval : prev));
    }, 1000); // Check every second

    return () => window.clearInterval(intervalId);
  }, []);

  const state = usePolarisData(refreshInterval);

  // Rename triggerRefresh to refresh for consistency
  const value = React.useMemo(
    () => ({
      data: state.data,
      loading: state.loading,
      error: state.error,
      refresh: state.triggerRefresh,
    }),
    [state]
  );

  return <PolarisDataContext.Provider value={value}>{props.children}</PolarisDataContext.Provider>;
}

/**
 * React hook to access the shared Polaris data context.
 *
 * Must be used within a PolarisDataProvider. Throws an error if used outside.
 *
 * @returns Polaris data context value (data, loading, error, refresh)
 * @throws Error if used outside PolarisDataProvider
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { data, loading, error, refresh } = usePolarisDataContext();
 *   if (loading) return <Loader />;
 *   if (error) return <Error message={error} />;
 *   return <div>{data.DisplayName}</div>;
 * }
 * ```
 */
export function usePolarisDataContext(): PolarisDataContextValue {
  const ctx = React.useContext(PolarisDataContext);
  if (ctx === null) {
    throw new Error('usePolarisDataContext must be used within a PolarisDataProvider');
  }
  return ctx;
}
