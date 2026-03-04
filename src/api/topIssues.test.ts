import { describe, expect, it } from 'vitest';
import { makeAuditData, makeResult } from '../test-utils';
import { getTopIssues } from './topIssues';

describe('getTopIssues', () => {
  it('returns empty array when no results', () => {
    const data = makeAuditData([]);
    expect(getTopIssues(data)).toEqual([]);
  });

  it('returns empty array when all checks pass', () => {
    const data = makeAuditData([
      makeResult({
        Results: {
          c1: {
            ID: 'c1',
            Message: '',
            Details: [],
            Success: true,
            Severity: 'warning',
            Category: 'X',
          },
        },
      }),
    ]);
    expect(getTopIssues(data)).toEqual([]);
  });

  it('aggregates failing checks from controller-level results', () => {
    const data = makeAuditData([
      makeResult({
        Results: {
          cpuRequestsMissing: {
            ID: 'cpuRequestsMissing',
            Message: 'missing',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'Efficiency',
          },
        },
      }),
    ]);
    const issues = getTopIssues(data);
    expect(issues).toHaveLength(1);
    expect(issues[0].checkId).toBe('cpuRequestsMissing');
    expect(issues[0].checkName).toBe('CPU Requests');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].count).toBe(1);
  });

  it('aggregates failing checks from pod and container results', () => {
    const data = makeAuditData([
      makeResult({
        Results: {},
        PodResult: {
          Name: 'pod-1',
          Results: {
            hostIPCSet: {
              ID: 'hostIPCSet',
              Message: '',
              Details: [],
              Success: false,
              Severity: 'danger',
              Category: 'Security',
            },
          },
          ContainerResults: [
            {
              Name: 'container-1',
              Results: {
                cpuLimitsMissing: {
                  ID: 'cpuLimitsMissing',
                  Message: '',
                  Details: [],
                  Success: false,
                  Severity: 'warning',
                  Category: 'Efficiency',
                },
              },
            },
          ],
        },
      }),
    ]);
    const issues = getTopIssues(data);
    expect(issues).toHaveLength(2);
    // Danger first
    expect(issues[0].checkId).toBe('hostIPCSet');
    expect(issues[0].severity).toBe('danger');
    expect(issues[1].checkId).toBe('cpuLimitsMissing');
  });

  it('counts same check across multiple workloads', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'deploy-1',
        Results: {
          cpuRequestsMissing: {
            ID: 'cpuRequestsMissing',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'Efficiency',
          },
        },
      }),
      makeResult({
        Name: 'deploy-2',
        Results: {
          cpuRequestsMissing: {
            ID: 'cpuRequestsMissing',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'Efficiency',
          },
        },
      }),
    ]);
    const issues = getTopIssues(data);
    expect(issues).toHaveLength(1);
    expect(issues[0].count).toBe(2);
  });

  it('ignores checks with severity "ignore"', () => {
    const data = makeAuditData([
      makeResult({
        Results: {
          c1: {
            ID: 'c1',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'ignore',
            Category: 'X',
          },
        },
      }),
    ]);
    expect(getTopIssues(data)).toEqual([]);
  });

  it('sorts danger before warning, then by count descending', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'deploy-1',
        Results: {
          cpuRequestsMissing: {
            ID: 'cpuRequestsMissing',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'Efficiency',
          },
        },
      }),
      makeResult({
        Name: 'deploy-2',
        Results: {
          cpuRequestsMissing: {
            ID: 'cpuRequestsMissing',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'Efficiency',
          },
          hostIPCSet: {
            ID: 'hostIPCSet',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'danger',
            Category: 'Security',
          },
        },
      }),
    ]);

    const issues = getTopIssues(data);
    // Danger first regardless of count
    expect(issues[0].severity).toBe('danger');
    expect(issues[1].severity).toBe('warning');
    expect(issues[1].count).toBe(2);
  });

  it('returns at most 10 issues', () => {
    const results: Record<
      string,
      {
        ID: string;
        Message: string;
        Details: string[];
        Success: boolean;
        Severity: 'warning';
        Category: string;
      }
    > = {};
    for (let i = 0; i < 15; i++) {
      results[`check${i}`] = {
        ID: `check${i}`,
        Message: '',
        Details: [],
        Success: false,
        Severity: 'warning',
        Category: 'X',
      };
    }
    const data = makeAuditData([makeResult({ Results: results })]);
    expect(getTopIssues(data)).toHaveLength(10);
  });
});
