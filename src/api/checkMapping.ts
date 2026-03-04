/**
 * Mapping of Polaris check IDs to human-readable names and descriptions
 * Sourced from Polaris documentation
 */

export interface CheckInfo {
  name: string;
  description: string;
  category: 'Security' | 'Efficiency' | 'Reliability';
  defaultSeverity: 'danger' | 'warning' | 'ignore';
}

export const CHECK_MAPPING: Record<string, CheckInfo> = {
  // Security checks
  hostIPCSet: {
    name: 'Host IPC',
    description: 'Host IPC should not be configured',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  hostPIDSet: {
    name: 'Host PID',
    description: 'Host PID should not be configured',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  hostNetworkSet: {
    name: 'Host Network',
    description: 'Host network should not be configured',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  hostPortSet: {
    name: 'Host Port',
    description: 'Host port should not be configured',
    category: 'Security',
    defaultSeverity: 'warning',
  },
  runAsRootAllowed: {
    name: 'Run as Root',
    description: 'Should not be allowed to run as root',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  runAsPrivileged: {
    name: 'Privileged Container',
    description: 'Should not run as privileged',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  notReadOnlyRootFilesystem: {
    name: 'Read-Only Root Filesystem',
    description: 'Filesystem should be read-only',
    category: 'Security',
    defaultSeverity: 'warning',
  },
  privilegeEscalationAllowed: {
    name: 'Privilege Escalation',
    description: 'Privilege escalation should not be allowed',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  dangerousCapabilities: {
    name: 'Dangerous Capabilities',
    description: 'Dangerous capabilities should not be allowed',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  insecureCapabilities: {
    name: 'Insecure Capabilities',
    description: 'Insecure capabilities should not be allowed',
    category: 'Security',
    defaultSeverity: 'warning',
  },
  sensitiveContainerEnvVar: {
    name: 'Sensitive Environment Variables',
    description: 'Sensitive env vars detected',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  sensitiveConfigmapContent: {
    name: 'Sensitive ConfigMap',
    description: 'Sensitive ConfigMap content detected',
    category: 'Security',
    defaultSeverity: 'danger',
  },
  automountServiceAccountToken: {
    name: 'Service Account Token Auto-mount',
    description: 'Service account token auto-mount',
    category: 'Security',
    defaultSeverity: 'warning',
  },
  tlsSettingsMissing: {
    name: 'TLS Settings',
    description: 'TLS settings missing',
    category: 'Security',
    defaultSeverity: 'warning',
  },
  missingNetworkPolicy: {
    name: 'Network Policy',
    description: 'Missing NetworkPolicy',
    category: 'Security',
    defaultSeverity: 'warning',
  },

  // Reliability checks
  tagNotSpecified: {
    name: 'Image Tag',
    description: 'Image tag should be specified',
    category: 'Reliability',
    defaultSeverity: 'danger',
  },
  pullPolicyNotAlways: {
    name: 'Pull Policy',
    description: 'Pull policy should be Always',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },
  readinessProbeMissing: {
    name: 'Readiness Probe',
    description: 'Readiness probe should be configured',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },
  livenessProbeMissing: {
    name: 'Liveness Probe',
    description: 'Liveness probe should be configured',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },
  deploymentMissingReplicas: {
    name: 'Deployment Replicas',
    description: 'Deployment should have multiple replicas',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },
  priorityClassNotSet: {
    name: 'Priority Class',
    description: 'Priority class should be set',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },
  metadataAndNameMismatched: {
    name: 'Metadata Mismatch',
    description: 'Metadata and name should match',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },
  missingPodDisruptionBudget: {
    name: 'Pod Disruption Budget',
    description: 'PodDisruptionBudget should exist',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },
  pdbDisruptionsIsZero: {
    name: 'PDB Disruptions',
    description: 'PDB maxUnavailable should not be zero',
    category: 'Reliability',
    defaultSeverity: 'warning',
  },

  // Efficiency checks
  cpuRequestsMissing: {
    name: 'CPU Requests',
    description: 'CPU requests should be set',
    category: 'Efficiency',
    defaultSeverity: 'warning',
  },
  cpuLimitsMissing: {
    name: 'CPU Limits',
    description: 'CPU limits should be set',
    category: 'Efficiency',
    defaultSeverity: 'warning',
  },
  memoryRequestsMissing: {
    name: 'Memory Requests',
    description: 'Memory requests should be set',
    category: 'Efficiency',
    defaultSeverity: 'warning',
  },
  memoryLimitsMissing: {
    name: 'Memory Limits',
    description: 'Memory limits should be set',
    category: 'Efficiency',
    defaultSeverity: 'warning',
  },
};

/**
 * Get human-readable name for a check ID
 */
export function getCheckName(checkId: string): string {
  return CHECK_MAPPING[checkId]?.name || checkId;
}

/**
 * Get check description
 */
export function getCheckDescription(checkId: string): string {
  return CHECK_MAPPING[checkId]?.description || 'Unknown check';
}

/**
 * Get check category
 */
export function getCheckCategory(checkId: string): 'Security' | 'Efficiency' | 'Reliability' {
  return CHECK_MAPPING[checkId]?.category || 'Security';
}

/**
 * Get status for StatusLabel component
 */
export function getSeverityStatus(severity: string): 'error' | 'warning' | 'success' {
  switch (severity) {
    case 'danger':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'success';
  }
}
