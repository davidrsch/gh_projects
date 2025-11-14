export enum ProjectV2FieldType {
  ASSIGNEES = 'ASSIGNEES',
  DATE = 'DATE',
  ISSUE_TYPE = 'ISSUE_TYPE',
  ITERATION = 'ITERATION',
  LABELS = 'LABELS',
  LINKED_PULL_REQUESTS = 'LINKED_PULL_REQUESTS',
  MILESTONE = 'MILESTONE',
  NUMBER = 'NUMBER',
  PARENT_ISSUE = 'PARENT_ISSUE',
  REPOSITORY = 'REPOSITORY',
  REVIEWERS = 'REVIEWERS',
  SINGLE_SELECT = 'SINGLE_SELECT',
  SUB_ISSUES_PROGRESS = 'SUB_ISSUES_PROGRESS',
  TEXT = 'TEXT',
  TITLE = 'TITLE',
  TRACKED_BY = 'TRACKED_BY',
  TRACKS = 'TRACKS'
}

export interface FieldConfig {
  id: string;
  name: string;
  dataType: string; // This will be one of the ProjectV2FieldType enum values
  __typename?: string;
  options?: Array<{ id?: string; name?: string; description?: string; color?: string }>;
  configuration?: any;
  repoOptions?: Record<string, any[]>; // Transient property for processing
}

export type NormalizedValue =
  | { type: 'text'; fieldId?: string; text: string | null }
  | { type: 'date'; fieldId?: string; date: string | null }
  | { type: 'number'; fieldId?: string; number: number | null }
  | { type: 'single_select'; fieldId?: string; option?: { id?: string; name?: string; color?: string; description?: string } }
  | { type: 'repository'; fieldId?: string; repository?: { nameWithOwner?: string; url?: string } }
  | { type: 'pull_request'; fieldId?: string; pullRequests?: Array<{ id?: string; number?: number; title?: string; url?: string; state?: string; merged?: boolean; mergedAt?: string; repository?: { nameWithOwner?: string }; author?: { login?: string; avatarUrl?: string; url?: string }; labels?: Array<{ id?: string; name?: string; color?: string }>; details?: any }> }
  | { type: 'labels'; fieldId?: string; labels?: Array<{ id?: string; name?: string; color?: string }> }
  | { type: 'issue'; fieldId?: string; issues?: Array<{ id?: string; number?: number; title?: string; url?: string; state?: string; repository?: { nameWithOwner?: string }; author?: { login?: string; avatarUrl?: string; url?: string }; labels?: Array<{ id?: string; name?: string; color?: string }>; details?: any }> }
  | { type: 'requested_reviewers'; fieldId?: string; reviewers?: any[] }
  | { type: 'assignees'; fieldId?: string; assignees?: any[] }
  | { type: 'iteration'; fieldId?: string; iterationId?: string; title?: string; startDate?: string }
  | { type: 'milestone'; fieldId?: string; milestone?: any }
  | { type: 'sub_issues_progress'; fieldId?: string; fieldName?: string; total: number; done: number; percent: number }
  | { type: 'missing'; fieldId?: string; fieldName?: string }
  | { type: 'title'; fieldId?: string; title?: { normalized?: any; raw?: any; content?: any } }
  | { type: 'unknown'; raw: any };
