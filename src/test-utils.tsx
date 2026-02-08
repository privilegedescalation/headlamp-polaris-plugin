import React from 'react';
import { AuditData, Result } from './api/polaris';

// --- Fixtures ---

export function makeResult(overrides: Partial<Result> = {}): Result {
  return {
    Name: 'my-deploy',
    Namespace: 'default',
    Kind: 'Deployment',
    Results: {},
    CreatedTime: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeAuditData(results: Result[]): AuditData {
  return {
    PolarisOutputVersion: '1.0',
    AuditTime: '2025-01-01T00:00:00Z',
    SourceType: 'Cluster',
    SourceName: 'test',
    DisplayName: 'test',
    ClusterInfo: { Version: '1.28', Nodes: 3, Pods: 10, Namespaces: 2, Controllers: 5 },
    Results: results,
  };
}

// --- Mock Polaris Context Provider ---

interface MockPolarisProviderProps {
  data?: AuditData | null;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
}

// We dynamically import PolarisDataContext to inject mock values.
// This avoids mocking the hook module — we supply real context with controlled values.
const PolarisDataContext = React.createContext<{
  data: AuditData | null;
  loading: boolean;
  error: string | null;
} | null>(null);

export function MockPolarisProvider({
  data = null,
  loading = false,
  error = null,
  children,
}: MockPolarisProviderProps) {
  return (
    <PolarisDataContext.Provider value={{ data, loading, error }}>
      {children}
    </PolarisDataContext.Provider>
  );
}

// The context reference used in test-utils must be the SAME object the components import.
// We achieve this by having component tests mock `usePolarisDataContext` to read from our context.
export { PolarisDataContext };
