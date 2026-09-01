export const PROPOSAL_RISKS = ['low', 'medium', 'high'] as const;
export type ProposalRisk = (typeof PROPOSAL_RISKS)[number];

/** High-risk writes require this word. Compared trim + lower-case. */
export const HIGH_RISK_CONFIRM_WORD = 'apply';

export type ProposalDiff = {
  before: string;
  after: string;
};

export type ProposalBlock = {
  time: string;
  title: string;
  why: string;
};

export function isProposalRisk(value: string): value is ProposalRisk {
  return (PROPOSAL_RISKS as readonly string[]).includes(value);
}

export function proposalApplyEnabled(risk: ProposalRisk, typed: string): boolean {
  if (risk !== 'high') return true;
  return typed.trim().toLowerCase() === HIGH_RISK_CONFIRM_WORD;
}

export function proposalRiskLabel(risk: ProposalRisk): string {
  if (risk === 'low') return 'low risk · applies with undo';
  if (risk === 'medium') return 'medium risk · preview first';
  return 'high risk · needs the word';
}

export function proposalApplyLabel(risk: ProposalRisk): string {
  if (risk === 'low') return 'Apply';
  if (risk === 'medium') return 'Confirm';
  return 'Apply target';
}
