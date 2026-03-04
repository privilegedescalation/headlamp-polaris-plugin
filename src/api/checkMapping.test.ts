import { describe, expect, it } from 'vitest';
import {
  CHECK_MAPPING,
  getCheckCategory,
  getCheckDescription,
  getCheckName,
  getSeverityStatus,
} from './checkMapping';

describe('checkMapping', () => {
  describe('getCheckName', () => {
    it('returns human-readable name for known check IDs', () => {
      expect(getCheckName('hostIPCSet')).toBe('Host IPC');
      expect(getCheckName('cpuRequestsMissing')).toBe('CPU Requests');
      expect(getCheckName('readinessProbeMissing')).toBe('Readiness Probe');
    });

    it('returns the raw check ID for unknown checks', () => {
      expect(getCheckName('unknownCheck')).toBe('unknownCheck');
    });
  });

  describe('getCheckDescription', () => {
    it('returns description for known checks', () => {
      expect(getCheckDescription('hostIPCSet')).toBe('Host IPC should not be configured');
    });

    it('returns "Unknown check" for unknown checks', () => {
      expect(getCheckDescription('unknownCheck')).toBe('Unknown check');
    });
  });

  describe('getCheckCategory', () => {
    it('returns correct category for each type', () => {
      expect(getCheckCategory('hostIPCSet')).toBe('Security');
      expect(getCheckCategory('cpuRequestsMissing')).toBe('Efficiency');
      expect(getCheckCategory('readinessProbeMissing')).toBe('Reliability');
    });

    it('defaults to Security for unknown checks', () => {
      expect(getCheckCategory('unknownCheck')).toBe('Security');
    });
  });

  describe('getSeverityStatus', () => {
    it('maps danger to error', () => {
      expect(getSeverityStatus('danger')).toBe('error');
    });

    it('maps warning to warning', () => {
      expect(getSeverityStatus('warning')).toBe('warning');
    });

    it('defaults to success for other values', () => {
      expect(getSeverityStatus('ignore')).toBe('success');
      expect(getSeverityStatus('unknown')).toBe('success');
    });
  });

  describe('CHECK_MAPPING', () => {
    it('has entries for all expected categories', () => {
      const categories = new Set(Object.values(CHECK_MAPPING).map(c => c.category));
      expect(categories).toContain('Security');
      expect(categories).toContain('Efficiency');
      expect(categories).toContain('Reliability');
    });

    it('all entries have required fields', () => {
      for (const [id, info] of Object.entries(CHECK_MAPPING)) {
        expect(info.name, `${id} missing name`).toBeTruthy();
        expect(info.description, `${id} missing description`).toBeTruthy();
        expect(['Security', 'Efficiency', 'Reliability']).toContain(info.category);
        expect(['danger', 'warning', 'ignore']).toContain(info.defaultSeverity);
      }
    });
  });
});
