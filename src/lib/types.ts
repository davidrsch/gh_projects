export enum ProjectV2FieldType {
  ASSIGNEES = "ASSIGNEES",
  DATE = "DATE",
  ISSUE_TYPE = "ISSUE_TYPE",
  ITERATION = "ITERATION",
  LABELS = "LABELS",
  LINKED_PULL_REQUESTS = "LINKED_PULL_REQUESTS",
  MILESTONE = "MILESTONE",
  NUMBER = "NUMBER",
  PARENT_ISSUE = "PARENT_ISSUE",
  REPOSITORY = "REPOSITORY",
  REVIEWERS = "REVIEWERS",
  SINGLE_SELECT = "SINGLE_SELECT",
  SUB_ISSUES_PROGRESS = "SUB_ISSUES_PROGRESS",
  TEXT = "TEXT",
  TITLE = "TITLE",
  TRACKED_BY = "TRACKED_BY",
  TRACKS = "TRACKS",
}

export type NormalizedValue =
  | { type: "text"; fieldId?: string; text: string | null }
  | { type: "date"; fieldId?: string; date: string | null }
  | { type: "number"; fieldId?: string; number: number | null }
  | {
      type: "single_select";
      fieldId?: string;
      option?: {
        id?: string;
        name?: string;
        color?: string;
        description?: string;
      };
    }
  | {
      type: "repository";
      fieldId?: string;
      repository?: { nameWithOwner?: string; url?: string };
    }
  | { type: "pull_request"; fieldId?: string; pullRequests?: PRSummary[] }
  | {
      type: "labels";
      fieldId?: string;
      labels?: Array<{ id?: string; name?: string; color?: string }>;
    }
  | { type: "issue"; fieldId?: string; issues?: IssueSummary[] }
  | { type: "requested_reviewers"; fieldId?: string; reviewers?: any[] }
  | { type: "assignees"; fieldId?: string; assignees?: any[] }
  | {
      type: "iteration";
      fieldId?: string;
      iterationId?: string;
      title?: string;
      startDate?: string;
    }
  | { type: "milestone"; fieldId?: string; milestone?: any }
  | {
      type: "sub_issues_progress";
      fieldId?: string;
      fieldName?: string;
      total: number;
      done: number;
      percent: number;
    }
  | { type: "missing"; fieldId?: string; fieldName?: string }
  | {
      type: "title";
      fieldId?: string;
      title?: { normalized?: any; raw?: any; content?: any };
    }
  | { type: "unknown"; raw: any };

export interface Item {
  id: string;
  fieldValues: NormalizedValue[];
  content?: any;
}

export interface ProjectSnapshot {
  project: { id: string; title?: string };
  fields: FieldConfig[];
  items: Item[];
}

export interface ProjectView {
  id: string;
  name?: string;
  number?: number | null;
  layout?: string | null;
}

// Domain types for parsed GraphQL fragments
export interface Label {
  id?: string;
  name?: string;
  color?: string;
  description?: string;
}

export interface Milestone {
  id?: string;
  title?: string;
  description?: string;
  dueOn?: string | null;
}

export interface RepoSummary {
  id?: string;
  nameWithOwner?: string;
  url?: string;
}

export interface UserSummary {
  id?: string;
  login?: string;
  avatarUrl?: string;
  url?: string;
  name?: string;
}

export interface PRSummary {
  id?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  state_color?: string;
  merged?: boolean;
  mergedAt?: string | null;
  repository?: RepoSummary | null;
  author?: UserSummary | null;
  labels?: Label[];
}

export interface IssueSummary {
  id?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  state_color?: string;
  repository?: RepoSummary | null;
  author?: UserSummary | null;
  labels?: Label[];
  parent?: IssueSummary | null;
  subIssuesSummary?: {
    total?: number;
    percentCompleted?: number;
    completed?: number;
  } | null;
}

export interface FieldOption {
  id?: string;
  name?: string;
  description?: string;
  color?: string;
}

// Refine FieldConfig to use FieldOption and configuration typing
export interface FieldConfig {
  id: string;
  name: string;
  dataType: string;
  __typename?: string;
  options?: FieldOption[];
  configuration?: any;
  repoOptions?: Record<string, FieldOption[]>;
}

// General GH API response wrapper for typed JSON results
export interface GHResponse<T = any> {
  data?: T;
}

// New alias for GraphQL-style responses with optional errors array
export interface GhApiResponse<T = any> {
  data?: T;
  errors?: any[];
}

// Small typed shape for ProjectV2 views query used in ghClient
export interface ProjectV2ViewsData {
  node?: {
    __typename?: string;
    id?: string;
    title?: string;
    shortDescription?: string;
    url?: string;
    views?: {
      nodes?: Array<{
        id?: string;
        name?: string;
        number?: number | null;
        layout?: string | null;
      }>;
    };
  };
}

// GraphQL node shapes used in ghClient builders
export interface ProjectMetaNode {
  id: string;
  title?: string;
}

export interface FieldNode {
  id: string;
  name: string;
  dataType: string;
  __typename?: string;
  options?: Array<{
    id?: string;
    name?: string;
    description?: string;
    color?: string;
  }>;
  configuration?: any;
}

export interface FieldsQueryData {
  node?: {
    fields?: { nodes?: FieldNode[] };
  };
}

export interface ItemsQueryData {
  node?: {
    items?: { nodes?: ProjectV2ItemNode[] };
  };
}

export interface RepoQueryData {
  // keys are dynamic (r0, r1, ...), but each value has optional labels & milestones
  [key: string]:
    | {
        labels?: { nodes?: Label[] };
        milestones?: { nodes?: Milestone[] };
      }
    | undefined;
}

// Detailed GraphQL fragment shapes used for ProjectV2 item field values
export interface UserNode {
  id?: string;
  login?: string;
  avatarUrl?: string;
  url?: string;
  name?: string;
}

export interface LabelNode {
  id?: string;
  name?: string;
  color?: string;
  description?: string;
}

export interface RepoNode {
  id?: string;
  nameWithOwner?: string;
  url?: string;
}

export interface PRNode {
  id?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  merged?: boolean;
  mergedAt?: string | null;
  repository?: RepoNode | null;
  author?: UserNode | null;
  labels?: { nodes?: LabelNode[] } | null;
}

export interface IssueNode {
  id?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  repository?: RepoNode | null;
  author?: UserNode | null;
  parent?: IssueNode | null;
  subIssuesSummary?: {
    total?: number;
    percentCompleted?: number;
    completed?: number;
  } | null;
  subIssues?: { nodes?: IssueNode[] } | null;
  labels?: { nodes?: LabelNode[] } | null;
}

export interface IssueConnection {
  nodes?: IssueNode[];
}

export interface PullRequestConnection {
  nodes?: PRNode[];
}

export interface LabelConnection {
  nodes?: LabelNode[];
}

export interface UsersConnection {
  nodes?: UserNode[];
}

// The dynamic item node returned by the items query. Field aliases are placed as
// extra properties on the node (e.g. f0, f1, etc), so we allow an index signature.
export interface ProjectV2ItemNode {
  id: string;
  content?: IssueNode | PRNode | null;
  // dynamic alias selections will be present here; keep as any to be flexible
  [alias: string]: any;
}
