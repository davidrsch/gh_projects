import { ProjectV2FieldType } from "../lib/types";

// -- Common Shared Types --

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface NodeList<T> {
  nodes: T[];
  pageInfo?: PageInfo;
  totalCount?: number;
}

export interface Actor {
  login: string;
  avatarUrl: string;
  url: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  dueOn?: string;
  number: number;
}

export interface Repository {
  id: string;
  name: string;
  nameWithOwner: string;
  url: string;
  isInOrganization: boolean;
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED";
  repository: Repository;
  author?: Actor;
  assignees?: NodeList<Actor>;
  labels?: NodeList<Label>;
  milestone?: Milestone;
  closedAt?: string;
  createdAt: string;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  repository: Repository;
  author?: Actor;
  merged: boolean;
  mergedAt?: string;
  createdAt: string;
}

// -- Project V2 Types --

export interface ProjectV2View {
  id: string;
  name: string;
  number: number;
  layout: "BOARD_LAYOUT" | "TABLE_LAYOUT" | "ROADMAP_LAYOUT";
  filter?: string;
  fields: NodeList<ProjectV2FieldCommon>;
  sortByFields: NodeList<{
    direction: "ASC" | "DESC";
    field: ProjectV2FieldCommon;
  }>;
  groupByFields: NodeList<ProjectV2FieldCommon>;
  verticalGroupByFields: NodeList<ProjectV2FieldCommon>;
}

export interface ProjectV2FieldCommon {
  __typename: string;
  id: string;
  name: string;
  dataType: ProjectV2FieldType;
}

export interface ProjectV2SingleSelectField extends ProjectV2FieldCommon {
  options: {
    id: string;
    name: string;
    color: string;
    description?: string;
  }[];
}

export interface ProjectV2IterationField extends ProjectV2FieldCommon {
  configuration: {
    iterations: {
      id: string;
      title: string;
      startDate: string;
      duration: number;
    }[];
  };
}

export interface ProjectV2ItemFieldValue {
  __typename: string;
}

export interface ProjectV2ItemFieldTextValue extends ProjectV2ItemFieldValue {
  text: string | null;
  field: ProjectV2FieldCommon;
}

export interface ProjectV2ItemFieldDateValue extends ProjectV2ItemFieldValue {
  date: string | null;
  field: ProjectV2FieldCommon;
}

export interface ProjectV2ItemFieldNumberValue extends ProjectV2ItemFieldValue {
  number: number | null;
  field: ProjectV2FieldCommon;
}

export interface ProjectV2ItemFieldSingleSelectValue extends ProjectV2ItemFieldValue {
  name: string | null;
  optionId: string | null;
  field: ProjectV2FieldCommon;
}

export interface ProjectV2ItemFieldIterationValue extends ProjectV2ItemFieldValue {
  title: string | null;
  startDate: string | null;
  duration: number | null;
  iterationId: string | null;
  field: ProjectV2FieldCommon;
}

// -- Query Responses --

export interface GetProjectsResponse {
  repository: {
    projectsV2: NodeList<{
      id: string;
      title: string;
      shortDescription: string;
      url: string;
      number: number;
    }>;
  };
}

export interface GetProjectViewsResponse {
  node: {
    __typename: string;
    id: string;
    title: string;
    shortDescription: string;
    url: string;
    views: NodeList<{
      id: string;
      name: string;
      number: number;
      layout: string;
    }>;
  } | null;
}

export interface GetProjectViewDetailsResponse {
  node: {
    view: ProjectV2View;
  } | null;
}

export interface GetProjectFieldsResponse {
  node: {
    fields: NodeList<
      | ProjectV2FieldCommon
      | ProjectV2SingleSelectField
      | ProjectV2IterationField
    >;
  } | null;
}

export interface GetProjectItemsResponse {
  node: {
    items: NodeList<{
      id: string;
      content: Issue | PullRequest | null;
      [key: string]: any; // Dynamic field values (f0, f1, etc.)
    }>;
  } | null;
}
