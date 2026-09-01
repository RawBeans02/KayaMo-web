import { describe, expect, it } from 'vitest';
import {
  HIGH_RISK_CONFIRM_WORD,
  isProposalRisk,
  proposalApplyEnabled,
  proposalApplyLabel,
  proposalRiskLabel,
} from './proposal';

describe('proposalApplyEnabled', () => {
  it('lets low and medium through without typing', () => {
    expect(proposalApplyEnabled('low', '')).toBe(true);
    expect(proposalApplyEnabled('medium', 'nope')).toBe(true);
  });

  it('blocks high until the user types apply', () => {
    expect(proposalApplyEnabled('high', '')).toBe(false);
    expect(proposalApplyEnabled('high', 'Apply ')).toBe(true);
    expect(proposalApplyEnabled('high', 'APPLY')).toBe(true);
    expect(proposalApplyEnabled('high', 'ok')).toBe(false);
    expect(HIGH_RISK_CONFIRM_WORD).toBe('apply');
  });
});

describe('proposal copy', () => {
  it('names the three gates the product contract uses', () => {
    expect(proposalRiskLabel('low')).toContain('applies with undo');
    expect(proposalRiskLabel('medium')).toContain('preview first');
    expect(proposalRiskLabel('high')).toContain('needs the word');
    expect(proposalApplyLabel('low')).toBe('Apply');
    expect(proposalApplyLabel('medium')).toBe('Confirm');
    expect(proposalApplyLabel('high')).toBe('Apply target');
  });

  it('rejects unknown risk strings', () => {
    expect(isProposalRisk('low')).toBe(true);
    expect(isProposalRisk('critical')).toBe(false);
  });
});
