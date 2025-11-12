import * as vscode from 'vscode';
import { graphql } from '@octokit/graphql';

export type ProjectV2ViewLayout = 'TABLE' | 'BOARD' | 'CALENDAR' | 'ROADMAP' | 'TABLE_LAYOUT' | string;

export interface TableFieldOption {
  id: string;
  name: string;
  color?: string;
}

export type TableFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'SINGLE_SELECT'
  | 'ITERATION'
  | 'ASSIGNEES'
  | 'LABELS'
  | 'MILESTONE'
  | 'REPOSITORY'
  | 'LINKED_PULL_REQUESTS'
  | string;

export interface TableFieldMeta {
  id: string;
  name: string;
  dataType: TableFieldType;
  options?: TableFieldOption[];
}

export interface SortByField {
  fieldId: string;
  direction: 'ASC' | 'DESC';
}

export interface TableViewMeta {
  viewId: string;
  viewNumber: number;
  viewName: string;
  layout: ProjectV2ViewLayout;
  filter?: string | null;
  sortBy?: SortByField[];
  groupBy?: string[];
  verticalGroupBy?: string[];
  visibleFieldIds: string[];
  fieldsById: Record<string, TableFieldMeta>;
}

export interface ItemFieldValueMap {
  [fieldId: string]: any;
}

export interface TableItemRow {
  id: string;
  contentType: 'Issue' | 'PullRequest' | 'DraftIssue' | string;
  title: string;
  url?: string;
  number?: number;
  fieldValues: ItemFieldValueMap;
}

export interface TableDataPage {
  meta: TableViewMeta;
  items: TableItemRow[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
}

function authHeaders(token: string) {
  return { headers: { authorization: `token ${token}` } };
}

export async function fetchTableMeta(
  projectId: string,
  viewNumber: number,
  token: string
): Promise<TableViewMeta> {
  const query = `
    query($pid: ID!, $vnum: Int!) {
      node(id: $pid) {
        ... on ProjectV2 {
          id
          view(number: $vnum) {
            id
            name
            number
            layout
            filter
            sortByFields(first: 20) {
              nodes {
                direction
                field {
                  __typename
                  ... on ProjectV2Field { id name dataType }
                  ... on ProjectV2SingleSelectField { id name dataType }
                  ... on ProjectV2IterationField { id name dataType }
                }
              }
            }
            groupByFields(first: 5) {
              nodes {
                __typename
                ... on ProjectV2Field { id name dataType }
                ... on ProjectV2SingleSelectField { id name dataType }
                ... on ProjectV2IterationField { id name dataType }
              }
            }
            verticalGroupByFields(first: 5) {
              nodes {
                __typename
                ... on ProjectV2Field { id name dataType }
                ... on ProjectV2SingleSelectField { id name dataType }
                ... on ProjectV2IterationField { id name dataType }
              }
            }
            fields(first: 50, orderBy: { field: POSITION, direction: ASC }) {
              nodes {
                __typename
                ... on ProjectV2Field { id name dataType }
                ... on ProjectV2SingleSelectField { id name dataType options { id name color } }
                ... on ProjectV2IterationField { id name dataType }
              }
            }
          }
        }
      }
    }
  `;

  const data: any = await graphql(query, { pid: projectId, vnum: viewNumber, ...authHeaders(token) });
  const view = data?.node?.view;
  if (!view) throw new Error('View not found');
  const normalizeLayout = (l: string | undefined) => {
    if (!l) return 'TABLE';
    if (l === 'TABLE_LAYOUT' || l === 'TABLE') return 'TABLE';
    if (l === 'BOARD_LAYOUT' || l === 'BOARD') return 'BOARD';
    if (l === 'CALENDAR_LAYOUT' || l === 'CALENDAR') return 'CALENDAR';
    if (l === 'ROADMAP_LAYOUT' || l === 'ROADMAP') return 'ROADMAP';
    return l;
  };

  const fieldsById: Record<string, TableFieldMeta> = {};
  const visibleFieldIds: string[] = [];
  for (const f of view.fields?.nodes ?? []) {
    if (!f?.id || !f?.name) continue;
    const meta: TableFieldMeta = {
      id: f.id,
      name: f.name,
      dataType: f.dataType ?? 'TEXT',
      options: Array.isArray(f.options)
        ? f.options.map((o: any) => ({ id: String(o.id), name: o.name, color: o.color }))
        : undefined,
    };
    fieldsById[f.id] = meta;
    visibleFieldIds.push(f.id);
  }

  const sortBy: SortByField[] = (view.sortByFields?.nodes ?? [])
    .map((n: any) => ({ fieldId: n?.field?.id, direction: n?.direction }))
    .filter((s: any) => s.fieldId && s.direction);

  const groupBy: string[] = (view.groupByFields?.nodes ?? [])
    .map((n: any) => n?.id)
    .filter((id: any) => !!id);
  const verticalGroupBy: string[] = (view.verticalGroupByFields?.nodes ?? [])
    .map((n: any) => n?.id)
    .filter((id: any) => !!id);

  const meta: TableViewMeta = {
    viewId: view.id,
    viewNumber: view.number,
    viewName: view.name,
    layout: normalizeLayout(view.layout),
    filter: view.filter,
    sortBy,
    groupBy,
    verticalGroupBy,
    visibleFieldIds,
    fieldsById,
  };
  return meta;
}

export async function fetchTableItems(
  projectId: string,
  viewMeta: TableViewMeta,
  token: string,
  after?: string | null
): Promise<TableDataPage> {
  const query = `
    query($pid: ID!, $q: String, $after: String) {
      node(id: $pid) {
        ... on ProjectV2 {
          id
          items(first: 50, after: $after, query: $q) {
            nodes {
              id
              type
              content {
                __typename
                ... on Issue { title url number }
                ... on PullRequest { title url number }
                ... on DraftIssue { title }
              }
              fieldValues(first: 50) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldTextValue {
                    field { ...FieldConf }
                    text
                  }
                  ... on ProjectV2ItemFieldNumberValue {
                    field { ...FieldConf }
                    number
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    field { ...FieldConf }
                    date
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field { ...FieldConf }
                    name
                    optionId
                  }
                  ... on ProjectV2ItemFieldIterationValue {
                    field { ...FieldConf }
                    title
                    id
                  }
                  ... on ProjectV2ItemFieldUserValue {
                    field { ...FieldConf }
                    users(first: 10) { nodes { login } }
                  }
                  ... on ProjectV2ItemFieldLabelValue {
                    field { ...FieldConf }
                    labels(first: 20) { nodes { name } }
                  }
                  ... on ProjectV2ItemFieldRepositoryValue {
                    field { ...FieldConf }
                    repository { nameWithOwner }
                  }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }

    fragment FieldConf on ProjectV2FieldConfiguration {
      __typename
      ... on ProjectV2Field { id name dataType }
      ... on ProjectV2SingleSelectField { id name dataType }
      ... on ProjectV2IterationField { id name dataType }
    }
  `;

  const variables: any = { pid: projectId, after: after ?? null };
  if (viewMeta.filter) variables.q = viewMeta.filter;
  const data: any = await graphql(query, { ...variables, ...authHeaders(token) });
  const conn = data?.node?.items;
  const items: TableItemRow[] = [];
  for (const it of conn?.nodes ?? []) {
    const content = it.content;
    const title = content?.title ?? '';
    const url = content?.url ?? undefined;
    const number = content?.number ?? undefined;
    const row: TableItemRow = {
      id: it.id,
      contentType: content?.__typename ?? 'Unknown',
      title,
      url,
      number,
      fieldValues: {},
    };

    for (const fv of it.fieldValues?.nodes ?? []) {
      const fid = fv?.field?.id;
      if (!fid) continue;
      let value: any = null;
      switch (fv.__typename) {
        case 'ProjectV2ItemFieldTextValue':
          value = fv.text ?? '';
          break;
        case 'ProjectV2ItemFieldNumberValue':
          value = typeof fv.number === 'number' ? fv.number : Number(fv.number ?? NaN);
          break;
        case 'ProjectV2ItemFieldDateValue':
          value = fv.date ?? null;
          break;
        case 'ProjectV2ItemFieldSingleSelectValue':
          value = fv.optionId ?? null;
          break;
        case 'ProjectV2ItemFieldIterationValue':
          value = fv.title ?? fv.id ?? null;
          break;
        case 'ProjectV2ItemFieldUserValue':
          value = (fv.users?.nodes ?? []).map((u: any) => u.login);
          break;
        default:
          value = null;
      }
      row.fieldValues[fid] = value;
    }
    items.push(row);
  }

  const pageInfo = { hasNextPage: !!conn?.pageInfo?.hasNextPage, endCursor: conn?.pageInfo?.endCursor };
  return { meta: viewMeta, items, pageInfo };
}

export async function updateItemFieldValue(
  projectId: string,
  itemId: string,
  field: TableFieldMeta,
  newValue: any,
  token: string
): Promise<void> {
  const input: any = {
    projectId,
    itemId,
    fieldId: field.id,
  };
  switch (field.dataType) {
    case 'TEXT':
      input.value = { text: String(newValue ?? '') };
      break;
    case 'NUMBER':
      input.value = { number: Number(newValue ?? 0) };
      break;
    case 'DATE':
      input.value = { date: newValue ?? null };
      break;
    case 'SINGLE_SELECT':
      input.value = { singleSelectOptionId: String(newValue ?? '') };
      break;
    case 'ITERATION':
      input.value = { iterationId: String(newValue ?? '') };
      break;
    case 'ASSIGNEES':
      input.value = { users: (Array.isArray(newValue) ? newValue : []) };
      break;
    default:
      input.value = { text: String(newValue ?? '') };
      break;
  }

  const mutation = `
    mutation($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) { clientMutationId projectV2Item { id } }
    }
  `;
  await graphql(mutation, { input, ...authHeaders(token) });
}

export async function addDraftRow(
  projectId: string,
  title: string,
  token: string
): Promise<{ itemId: string }> {
  const mutation = `
    mutation($input: AddProjectV2DraftIssueInput!) {
      addProjectV2DraftIssue(input: $input) {
        projectItem { id }
      }
    }
  `;
  const data: any = await graphql(mutation, { input: { projectId, title }, ...authHeaders(token) });
  const id = data?.addProjectV2DraftIssue?.projectItem?.id;
  if (!id) throw new Error('Failed to create draft row');
  return { itemId: id };
}

export async function deleteRow(projectId: string, itemId: string, token: string): Promise<void> {
  const mutation = `
    mutation($input: DeleteProjectV2ItemInput!) {
      deleteProjectV2Item(input: $input) { deletedItemId }
    }
  `;
  await graphql(mutation, { input: { projectId, itemId }, ...authHeaders(token) });
}
