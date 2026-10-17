import { AIError } from '../errors';

export interface KeyContributorOverview {
  login: string;
  recentCommits: number;
  summary?: string;
}

export interface NotablePROverview {
  number: number;
  title: string;
  author: string;
  status: string;
}

export interface NotableIssueOverview {
  number: number;
  title: string;
  author: string;
}

export interface EvidenceReference {
  type: 'repository' | 'commit' | 'pull_request' | 'issue' | 'readme' | 'manifest';
  identifier: string;
  note: string;
}

export interface ProjectRepositoryContextOutput {
  suggestedDescription: string;
  purpose: string;
  problemDomain: string;
  primaryLanguages: string[];
  frameworksAndTools: string[];
  architectureHints: string[];
  recentActivitySummary: string;
  contributorOverview: {
    totalObserved: number;
    keyContributors: KeyContributorOverview[];
  };
  openPRSummary: {
    totalOpen: number;
    notablePRs: NotablePROverview[];
  };
  openIssueSummary: {
    totalOpen: number;
    notableIssues: NotableIssueOverview[];
  };
  notableBlockersOrFailedChecks: string[];
  confidenceNotes: string[];
  evidenceReferences: EvidenceReference[];
  unknownOrUnsupportedFields: string[];
}

export const REPOSITORY_CONTEXT_SCHEMA_VERSION = '1.0.0';

export function validateProjectRepositoryContext(raw: unknown): ProjectRepositoryContextOutput {
  if (!raw || typeof raw !== 'object') {
    throw new AIError('INVALID_OUTPUT', 'Output is not a valid JSON object');
  }

  const data = raw as Record<string, unknown>;

  const toString = (val: unknown, fallback = ''): string =>
    typeof val === 'string' ? val.trim() : fallback;

  const toStringArray = (val: unknown): string[] => {
    if (Array.isArray(val)) {
      return val
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((s) => s.length > 0);
    }
    return [];
  };

  const toContributors = (val: unknown): KeyContributorOverview[] => {
    if (!Array.isArray(val)) return [];
    return val
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const obj = item as Record<string, unknown>;
        return {
          login: toString(obj.login, 'unknown'),
          recentCommits: typeof obj.recentCommits === 'number' ? obj.recentCommits : 0,
          summary: obj.summary ? toString(obj.summary) : undefined,
        };
      })
      .filter((c) => c.login !== 'unknown');
  };

  const toPRs = (val: unknown): NotablePROverview[] => {
    if (!Array.isArray(val)) return [];
    return val
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const obj = item as Record<string, unknown>;
        return {
          number: typeof obj.number === 'number' ? obj.number : 0,
          title: toString(obj.title, 'Untitled PR'),
          author: toString(obj.author, 'unknown'),
          status: toString(obj.status, 'open'),
        };
      })
      .filter((pr) => pr.number > 0);
  };

  const toIssues = (val: unknown): NotableIssueOverview[] => {
    if (!Array.isArray(val)) return [];
    return val
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const obj = item as Record<string, unknown>;
        return {
          number: typeof obj.number === 'number' ? obj.number : 0,
          title: toString(obj.title, 'Untitled Issue'),
          author: toString(obj.author, 'unknown'),
        };
      })
      .filter((i) => i.number > 0);
  };

  const toEvidenceRefs = (val: unknown): EvidenceReference[] => {
    if (!Array.isArray(val)) return [];
    const validTypes = new Set(['repository', 'commit', 'pull_request', 'issue', 'readme', 'manifest']);
    return val
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const obj = item as Record<string, unknown>;
        const typeStr = toString(obj.type, 'repository');
        const type = validTypes.has(typeStr) ? (typeStr as EvidenceReference['type']) : 'repository';
        return {
          type,
          identifier: toString(obj.identifier, 'unknown'),
          note: toString(obj.note, ''),
        };
      });
  };

  const rawContrib = data.contributorOverview as Record<string, unknown> | undefined;
  const rawPRs = data.openPRSummary as Record<string, unknown> | undefined;
  const rawIssues = data.openIssueSummary as Record<string, unknown> | undefined;

  const result: ProjectRepositoryContextOutput = {
    suggestedDescription: toString(
      data.suggestedDescription || data.description,
      'No project description generated.'
    ),
    purpose: toString(data.purpose, 'Purpose not specified in available repository evidence.'),
    problemDomain: toString(data.problemDomain, 'General Software Development'),
    primaryLanguages: toStringArray(data.primaryLanguages),
    frameworksAndTools: toStringArray(data.frameworksAndTools),
    architectureHints: toStringArray(data.architectureHints),
    recentActivitySummary: toString(
      data.recentActivitySummary,
      'No recent repository activity found in evidence window.'
    ),
    contributorOverview: {
      totalObserved:
        typeof rawContrib?.totalObserved === 'number'
          ? rawContrib.totalObserved
          : Array.isArray(rawContrib?.keyContributors)
            ? rawContrib.keyContributors.length
            : 0,
      keyContributors: toContributors(rawContrib?.keyContributors),
    },
    openPRSummary: {
      totalOpen:
        typeof rawPRs?.totalOpen === 'number'
          ? rawPRs.totalOpen
          : Array.isArray(rawPRs?.notablePRs)
            ? rawPRs.notablePRs.length
            : 0,
      notablePRs: toPRs(rawPRs?.notablePRs),
    },
    openIssueSummary: {
      totalOpen:
        typeof rawIssues?.totalOpen === 'number'
          ? rawIssues.totalOpen
          : Array.isArray(rawIssues?.notableIssues)
            ? rawIssues.notableIssues.length
            : 0,
      notableIssues: toIssues(rawIssues?.notableIssues),
    },
    notableBlockersOrFailedChecks: toStringArray(data.notableBlockersOrFailedChecks),
    confidenceNotes: toStringArray(data.confidenceNotes),
    evidenceReferences: toEvidenceRefs(data.evidenceReferences),
    unknownOrUnsupportedFields: toStringArray(data.unknownOrUnsupportedFields),
  };

  return result;
}
