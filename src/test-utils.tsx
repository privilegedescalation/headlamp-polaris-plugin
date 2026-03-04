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
