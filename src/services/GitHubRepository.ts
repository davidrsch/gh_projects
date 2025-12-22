import logger from "../lib/logger";
import * as vscode from "vscode";
import {
  ProjectSnapshot,
  ProjectView,
  Item,
  FieldConfig,
  NormalizedValue,
  ParsedRepoEntry,
  ProjectV2FieldType,
  IssueSummary,
  PRSummary,
} from "../lib/types";
import { normalizeFieldConfig } from "../lib/parsers/fieldConfigParser";
import { parseFieldValue } from "../lib/parsers/valueParsers";
import {
  makeLimits,
  buildCandidateFragments,
  buildRepoSelections,
  buildItemsQuery,
  buildFieldsQuery,
} from "../lib/helpers";
import { aggregateMaps } from "../lib/aggregation";
import { createCodeError } from "../lib/errors";
import {
  GetProjectsResponse,
  GetProjectViewsResponse,
  GetProjectViewDetailsResponse,
  GetProjectFieldsResponse,
  GetProjectItemsResponse,
  ProjectV2FieldCommon,
  ProjectV2SingleSelectField,
  ProjectV2IterationField,
} from "./graphqlTypes";
import { GraphQLExecutor, getGraphQLExecutor } from "./graphqlExecutor";

export class GitHubRepository {
  private static instance: GitHubRepository;
  private executor: GraphQLExecutor;

  private constructor(executor?: GraphQLExecutor) {
    this.executor = executor || getGraphQLExecutor();
  }

  public static getInstance(): GitHubRepository {
    if (!GitHubRepository.instance) {
      GitHubRepository.instance = new GitHubRepository();
    }
    return GitHubRepository.instance;
  }

  /**
   * Executes a GraphQL query.
   */
  private async query<T>(
    query: string,
    variables?: Record<string, any>,
  ): Promise<T> {
    return this.executor.execute<T>(query, variables);
  }

  /**
   * Fetches projects for a given owner and repository name.
   */
  public async getProjects(
    owner: string,
    name: string,
  ): Promise<ParsedRepoEntry> {
    const gql = `
            query($owner: String!, $name: String!) {
                repository(owner: $owner, name: $name) {
                    projectsV2(first: 20) {
                        nodes {
                            id
                            title
                            shortDescription
                            url
                            number
                        }
                    }
                }
            }
        `;

    try {
      const response = await this.query<GetProjectsResponse>(gql, {
        owner,
        name,
      });
      const projects = response.repository?.projectsV2?.nodes || [];
      return { owner, name, projects };
    } catch (error: any) {
      return { owner, name, error: error.message };
    }
  }

  /**
   * Fetches project views.
   */
  public async fetchProjectViews(projectId: string): Promise<ProjectView[]> {
    const gql = `query ($id: ID!) { node(id: $id) { __typename ... on ProjectV2 { id title shortDescription url views(first: 100) { nodes { id name number layout } } } } }`;
    try {
      logger.info(`[ghProjects] Fetching views for ${projectId}`);
      const parsed = await this.query<GetProjectViewsResponse>(gql, {
        id: projectId,
      });

      const nodes = parsed?.node?.views?.nodes;
      if (!Array.isArray(nodes)) {
        logger.warn(
          `fetchProjectViews: No views found for project ${projectId}`,
        );
        return [];
      }
      const mapped: ProjectView[] = nodes.map((n) => ({
        id: String(n.id),
        name: n.name,
        number: n.number ?? null,
        layout: n.layout
          ? String(n.layout).toLowerCase().replace("_layout", "")
          : null,
      }));
      logger.debug(`[ghProjects] Mapped views: ${JSON.stringify(mapped)}`);
      return mapped;
    } catch (e: any) {
      const msg = "fetchProjectViews error: " + e.message;
      logger.error(msg);
      vscode.window.showErrorMessage(msg); // Show error to user
      return [];
    }
  }

  /**
   * Fetches details for a specific project view.
   */
  public async getProjectViewDetails(
    projectId: string,
    viewNumber: number,
  ): Promise<any> {
    const gql = `query($projectId: ID!, $viewNumber: Int!) { node(id: $projectId) { __typename ... on ProjectV2 { view(number: $viewNumber) { id name number layout filter fields(first: 100) { nodes { ... on ProjectV2FieldCommon { id name dataType } } } sortByFields(first: 20) { nodes { direction field { ... on ProjectV2FieldCommon { name } } } } groupByFields(first: 10) { nodes { ... on ProjectV2FieldCommon { name } } } verticalGroupByFields(first: 10) { nodes { ... on ProjectV2FieldCommon { name } } } } } } }`;
    try {
      const res = await this.query<GetProjectViewDetailsResponse>(gql, {
        projectId,
        viewNumber,
      });
      return res?.node?.view;
    } catch (error) {
      logger.error(`Failed to fetch view details: ${error}`);
      return null;
    }
  }

  /**
   * Fetches full project fields and items (snapshot).
   */
  public async fetchProjectFields(
    projectId: string,
    opts?: { first?: number; viewFilter?: string },
  ): Promise<ProjectSnapshot> {
    const first = opts?.first ?? 50;
    const viewFilter = opts?.viewFilter;
    const LIMITS = makeLimits(first);

    // 1. Fetch Project Metadata
    const metaQuery = `query{ node(id:${JSON.stringify(projectId)}){ __typename ... on ProjectV2 { id title repositories(first: 20) { nodes { nameWithOwner url } } } } }`;
    let project: any | undefined;
    try {
      const metaRes = await this.query<{ node?: any }>(metaQuery);
      project = metaRes?.node;
    } catch (e: any) {
      logger.error("fetchMeta error: " + e.message);
      throw e;
    }

    if (!project) throw createCodeError("No project found", "ENOPROJECT");

    // Parses repositories to format expected by ProjectEntry
    const projectRepos = (project.repositories?.nodes || []).map((r: any) => ({
      owner: r.nameWithOwner.split("/")[0],
      name: r.nameWithOwner.split("/")[1],
      url: r.url,
    }));

    // 2. Fetch Fields
    const fieldsQuery = buildFieldsQuery(project.id, LIMITS);
    const fieldsRes = await this.query<GetProjectFieldsResponse>(fieldsQuery);
    const rawFields = fieldsRes?.node?.fields?.nodes || [];
    const fields: FieldConfig[] = rawFields.map((n) =>
      normalizeFieldConfig(n as any),
    ); // cast to any for now as normalizeFieldConfig expects a specific shape

    // 3. Introspect Config Types
    const configTypeNames = [
      "ProjectV2SingleSelectField",
      "ProjectV2IterationField",
    ];
    const configIntroQuery = `query{\n${configTypeNames.map((n, i) => `t${i}: __type(name:${JSON.stringify(n)}){ name }`).join("\n")}\n}`;
    let presentConfigTypes = new Set<string>();
    try {
      const cIntro = await this.query<any>(configIntroQuery);
      for (let i = 0; i < configTypeNames.length; i++) {
        const key = `t${i}`;
        if (cIntro[key]?.name) presentConfigTypes.add(cIntro[key].name);
      }
    } catch (e) {
      presentConfigTypes = new Set(configTypeNames);
    }

    // 4. Fetch Field Details
    await this.fetchFieldDetails(fields, presentConfigTypes);

    // 5. Introspect Item Types
    const possibleTypes = await this.introspectItemFieldTypes();

    // 6. Build Item Query
    const candidateFragments = buildCandidateFragments(LIMITS);
    const aliasSelections: string[] = [];
    const fieldAliases: { alias: string; name: string }[] = [];
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const alias = `f${i}`;
      fieldAliases.push({ alias, name: f.name });
      const fragments = candidateFragments
        .filter(
          (c) =>
            possibleTypes.length === 0 || possibleTypes.includes(c.typename),
        )
        .map((c) => c.selection)
        .join("\n              ");

      const sel = `${alias}: fieldValueByName(name:${JSON.stringify(f.name)}){ __typename
              ${fragments}
            }`;
      aliasSelections.push(sel);
    }

    // 7. Fetch Items
    const itemsQuery = buildItemsQuery(
      project.id,
      aliasSelections.join("\n          "),
      LIMITS,
      viewFilter,
    );
    const itemsRes = await this.query<GetProjectItemsResponse>(itemsQuery);
    const rawItems = itemsRes?.node?.items?.nodes || [];

    // debug instrumentation removed

    // 8. Normalize Items
    const items: Item[] = rawItems.map((item) => {
      const fv: any[] = [];
      for (let i = 0; i < fieldAliases.length; i++) {
        const { alias } = fieldAliases[i];
        const node = item[alias];
        // For Parent issue and Sub-issues progress prefer the synthesized
        // value from the item's content (Issue content) rather than any
        // fieldValue alias the server might return. This makes the
        // content-based shape the canonical source of truth.
        try {
          const fdt = String(fields[i].dataType || "").toUpperCase();
          const content = item.content as any;
          if (fdt === ProjectV2FieldType.PARENT_ISSUE) {
            if (content && content.parent) {
              const parentNode: any = content.parent;
              const synthesized: any = {
                type: "parent_issue",
                fieldId: fields[i].id,
                parent: {
                  id: parentNode.id,
                  number: parentNode.number,
                  url: parentNode.url,
                  title: parentNode.title,
                  repository: parentNode.repository
                    ? { nameWithOwner: parentNode.repository.nameWithOwner }
                    : undefined,
                  state: parentNode.state ?? null,
                },
                raw: null,
                content: item.content ?? null,
              };
              fv.push(synthesized as any);
            } else {
              fv.push({
                type: "missing",
                fieldId: fields[i].id,
                fieldName: fields[i].name,
                raw: null,
                content: item.content ?? null,
              });
            }
          } else if (fdt === ProjectV2FieldType.SUB_ISSUES_PROGRESS) {
            if (content && content.subIssuesSummary) {
              const s = content.subIssuesSummary;
              const synthesized: any = {
                type: "sub_issues_progress",
                fieldId: fields[i].id,
                total: s?.total ?? null,
                done: s?.completed ?? null,
                percent: s?.percentCompleted ?? null,
                raw: null,
                content: item.content ?? null,
              };
              fv.push(synthesized as any);
            } else {
              fv.push({
                type: "missing",
                fieldId: fields[i].id,
                fieldName: fields[i].name,
                raw: null,
                content: item.content ?? null,
              });
            }
          } else {
            if (node) {
              node.field = fields[i];
              node.itemContent = item.content;
              const parsed = parseFieldValue(node) as any;
              if (parsed && typeof parsed === "object") {
                if (!parsed.raw) parsed.raw = node;
                if (!parsed.content) parsed.content = item.content ?? null;
              }
              fv.push(parsed);
            } else {
              fv.push({
                type: "missing",
                fieldId: fields[i].id,
                fieldName: fields[i].name,
                raw: null,
                content: item.content ?? null,
              });
            }
          }
        } catch (e) {
          fv.push({
            type: "missing",
            fieldId: fields[i].id,
            fieldName: fields[i].name,
            raw: null,
            content: item.content ?? null,
          });
        }
      }
      return {
        id: item.id,
        fieldValues: fv as NormalizedValue[],
        content: item.content,
      };
    });

    // 9. Aggregate Options
    const { labelMap, milestoneMap, repoNames } = aggregateMaps(items);
    const repoOptionsMap = await this.fetchRepoOptions(repoNames, LIMITS);

    // 10. Merge Options back to fields
    for (const f of fields) {
      if (f.dataType === ProjectV2FieldType.LABELS) {
        if (Object.keys(repoOptionsMap).length > 0) {
          f.repoOptions = {};
          for (const rn of Object.keys(repoOptionsMap)) {
            const lbls = repoOptionsMap[rn].labels || [];
            f.repoOptions[rn] = lbls.map((l) => ({
              id: l.id,
              name: l.name,
              description: (l as any).description,
              color: l.color,
            }));
          }
        } else {
          f.options = Array.from(labelMap.values()).map((l: any) => ({
            id: l.id,
            name: l.name,
            color: (l as any).color,
          }));
        }
      } else if (f.dataType === ProjectV2FieldType.MILESTONE) {
        if (Object.keys(repoOptionsMap).length > 0) {
          f.repoOptions = {};
          for (const rn of Object.keys(repoOptionsMap)) {
            const mls = repoOptionsMap[rn].milestones || [];
            f.repoOptions[rn] = mls.map((m) => ({
              id: m.id,
              title: m.title,
              description: (m as any).description,
              dueOn: m.dueOn,
            }));
          }
        } else if (milestoneMap && milestoneMap.size > 0) {
          // Fallback: use milestones inferred from existing item values
          f.options = Array.from(milestoneMap.values()).map((m: any) => ({
            id: m.id,
            title: m.title,
          }));
        }
      }
    }

    return {
      project: { id: project.id, title: project.title, repos: projectRepos },
      fields,
      items,
    };
  }

  private async fetchFieldDetails(
    fields: FieldConfig[],
    presentConfigTypes: Set<string>,
  ) {
    const fieldNodeSelections: string[] = [];
    for (const f of fields) {
      const fid = f.id;
      const selParts: string[] = ["__typename"];
      if (
        f.dataType === ProjectV2FieldType.SINGLE_SELECT &&
        presentConfigTypes.has("ProjectV2SingleSelectField")
      ) {
        selParts.push(
          "... on ProjectV2SingleSelectField{ options{ id name description color } }",
        );
      }
      if (
        f.dataType === ProjectV2FieldType.ITERATION &&
        presentConfigTypes.has("ProjectV2IterationField")
      ) {
        selParts.push(
          "... on ProjectV2IterationField{ configuration{ iterations{ id title startDate duration } } }",
        );
      }
      if (selParts.length > 1) {
        fieldNodeSelections.push(
          `n_${fid.replace(/[^a-zA-Z0-9_]/g, "_")}: node(id:${JSON.stringify(fid)}){ ${selParts.join(" ")} }`,
        );
      }
    }
    if (fieldNodeSelections.length === 0) return;
    const fieldsDetailQuery = `query{\n  ${fieldNodeSelections.join("\n  ")}\n}`;
    try {
      const detailRes = await this.query<any>(fieldsDetailQuery);
      for (const f of fields) {
        const key = `n_${f.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        const node = detailRes[key];
        if (!node) continue;
        if (node.options) {
          f.options = node.options.map((o: any) => ({
            id: o.id,
            name: o.name,
            description: o.description,
            color: o.color,
          }));
        }
        if (node.configuration) f.configuration = node.configuration;
      }
    } catch (e) {
      logger.debug("per-field detail fetch failed: " + e);
    }
  }

  private async introspectItemFieldTypes(): Promise<string[]> {
    const introspectQuery = `query { __type(name: "ProjectV2ItemFieldValue") { possibleTypes { name } } }`;
    try {
      const introRes = await this.query<any>(introspectQuery);
      return (introRes?.__type?.possibleTypes || []).map((p: any) => p.name);
    } catch (e) {
      return [];
    }
  }

  private async fetchRepoOptions(repoNames: string[], LIMITS: any) {
    const repoOptionsMap: Record<
      string,
      { labels?: any[]; milestones?: any[] }
    > = {};
    if (repoNames.length === 0) return repoOptionsMap;
    const repoSelections = buildRepoSelections(repoNames, LIMITS);
    const repoQuery = `query{\n    ${repoSelections}\n  }`;
    try {
      const repoRes = await this.query<any>(repoQuery);
      for (let i = 0; i < repoNames.length; i++) {
        const rn = repoNames[i];
        const key = `r${i}`;
        const repoNode = repoRes[key];
        if (!repoNode) continue;
        const labels = (repoNode.labels?.nodes || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          description: l.description,
        }));
        const milestones = (repoNode.milestones?.nodes || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          dueOn: m.dueOn,
        }));
        repoOptionsMap[rn] = { labels, milestones };
      }
    } catch (e) {
      logger.debug("fetchRepoOptions error: " + e);
    }
    return repoOptionsMap;
  }

  /**
   * Returns a list of open issues and pull requests for a repository.
   * Used by the Add Item from Repository flow to present candidate
   * items that are not yet part of the current project.
   */
  public async getOpenIssuesAndPullRequests(
    owner: string,
    name: string,
    first: number = 50,
  ): Promise<{ issues: IssueSummary[]; pullRequests: PRSummary[] }> {
    const gql = `
      query($owner: String!, $name: String!, $first: Int!) {
        repository(owner: $owner, name: $name) {
          issues(first: $first, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              url
              state
              repository { nameWithOwner url }
              author { login avatarUrl url }
              labels(first: 10) { nodes { id name color } }
            }
          }
          pullRequests(first: $first, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              url
              state
              merged
              mergedAt
              repository { nameWithOwner url }
              author { login avatarUrl url }
              labels(first: 10) { nodes { id name color } }
            }
          }
        }
      }
    `;

    try {
      const res = await this.query<any>(gql, { owner, name, first });
      const repo = res?.repository;
      const issuesNodes = (repo?.issues?.nodes || []) as any[];
      const prNodes = (repo?.pullRequests?.nodes || []) as any[];

      const issues: IssueSummary[] = issuesNodes.map((n) => ({
        id: n.id,
        number: n.number,
        title: n.title,
        url: n.url,
        state: n.state,
        repository: n.repository
          ? {
            id: undefined,
            nameWithOwner: n.repository.nameWithOwner,
            url: n.repository.url,
          }
          : undefined,
        author: n.author
          ? {
            id: undefined,
            login: n.author.login,
            avatarUrl: n.author.avatarUrl,
            url: n.author.url,
            name: undefined,
          }
          : undefined,
        labels: Array.isArray(n.labels?.nodes)
          ? n.labels.nodes.map((l: any) => ({
            id: l.id,
            name: l.name,
            color: l.color,
          }))
          : undefined,
      }));

      const pullRequests: PRSummary[] = prNodes.map((n) => ({
        id: n.id,
        number: n.number,
        title: n.title,
        url: n.url,
        state: n.state,
        merged: n.merged,
        mergedAt: n.mergedAt,
        repository: n.repository
          ? {
            id: undefined,
            nameWithOwner: n.repository.nameWithOwner,
            url: n.repository.url,
          }
          : undefined,
        author: n.author
          ? {
            id: undefined,
            login: n.author.login,
            avatarUrl: n.author.avatarUrl,
            url: n.author.url,
            name: undefined,
          }
          : undefined,
        labels: Array.isArray(n.labels?.nodes)
          ? n.labels.nodes.map((l: any) => ({
            id: l.id,
            name: l.name,
            color: l.color,
          }))
          : undefined,
      }));

      return { issues, pullRequests };
    } catch (e: any) {
      logger.error(
        `getOpenIssuesAndPullRequests failed for ${owner}/${name}: ${e.message || e}`,
      );
      return { issues: [], pullRequests: [] };
    }
  }

  /**
   * Fetches the canonical repository name (owner/name) to handle redirects/renames.
   */
  public async getRepoCanonicalName(
    owner: string,
    name: string,
  ): Promise<string | null> {
    const gql = `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          nameWithOwner
        }
      }
    `;
    try {
      const res = await this.query<any>(gql, { owner, name });
      return res?.repository?.nameWithOwner || null;
    } catch (e) {
      // It's common to fail if the repo doesn't exist or no access
      return null;
    }
  }

  /**
   * Updates a field value for a project item.
   * Supports: text, number, date, single_select, iteration, labels, assignees, reviewers, milestone
   * @param fieldType - The type of field being updated
   */
  public async updateFieldValue(
    projectId: string,
    itemId: string,
    fieldId: string,
    value: any,
    fieldType?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const type = fieldType?.toLowerCase();

      // Handle clearing field values (null or undefined)
      if (value === null || value === undefined) {
        return await this.clearFieldValue(projectId, itemId, fieldId);
      }

      // Route to appropriate mutation based on field type
      switch (type) {
        case "text":
        case "number":
        case "date":
        case "single_select":
        case "iteration":
          return await this.updateProjectV2Field(
            projectId,
            itemId,
            fieldId,
            value,
            type,
          );

        case "labels":
          return await this.updateLabels(itemId, value);

        case "assignees":
          return await this.updateAssignees(itemId, value);

        case "reviewers":
          return await this.updateReviewers(itemId, value);

        case "milestone":
          return await this.updateMilestone(itemId, value);

        default:
          // Try to infer type from value for backward compatibility
          if (typeof value === "string") {
            return await this.updateProjectV2Field(
              projectId,
              itemId,
              fieldId,
              value,
              "text",
            );
          } else if (typeof value === "number") {
            return await this.updateProjectV2Field(
              projectId,
              itemId,
              fieldId,
              value,
              "number",
            );
          }
          return {
            success: false,
            error: `Unsupported field type: ${type}`,
          };
      }
    } catch (error: any) {
      logger.error(`Failed to update field value: ${error.message || error}`);
      return {
        success: false,
        error: error.message || "Failed to update field value",
      };
    }
  }

  /**
   * Clears a project field value (sets to null/empty)
   */
  private async clearFieldValue(
    projectId: string,
    itemId: string,
    fieldId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mutation = `
        mutation($input: ClearProjectV2ItemFieldValueInput!) {
          clearProjectV2ItemFieldValue(input: $input) {
            projectV2Item {
              id
            }
          }
        }
      `;

      await this.query(mutation, {
        input: { projectId, itemId, fieldId },
      });

      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to clear field value: ${error.message || error}`);
      return {
        success: false,
        error: error.message || "Failed to clear field value",
      };
    }
  }

  /**
   * Updates ProjectV2 field values (text, number, date, single_select, iteration)
   */
  private async updateProjectV2Field(
    projectId: string,
    itemId: string,
    fieldId: string,
    value: any,
    type: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mutation = `
        mutation($input: UpdateProjectV2ItemFieldValueInput!) {
          updateProjectV2ItemFieldValue(input: $input) {
            projectV2Item {
              id
            }
          }
        }
      `;

      const input: any = {
        projectId,
        itemId,
        fieldId,
      };

      // Set the value based on type
      switch (type) {
        case "text":
          input.value = { text: String(value) };
          break;
        case "number":
          input.value = { number: Number(value) };
          break;
        case "date":
          input.value = { date: value };
          break;
        case "single_select":
          // value should be optionId (string)
          input.value = { singleSelectOptionId: String(value) };
          break;
        case "iteration":
          // value should be iterationId (string)
          input.value = { iterationId: String(value) };
          break;
        default:
          return {
            success: false,
            error: `Unsupported ProjectV2 field type: ${type}`,
          };
      }

      await this.query(mutation, { input });
      return { success: true };
    } catch (error: any) {
      logger.error(
        `Failed to update ProjectV2 field: ${error.message || error}`,
      );
      // If GraphQL reports an unresolvable node id, provide a clearer message
      const msg = String(error.message || error || "");
      if (msg.includes('Could not resolve to a node with the global id')) {
        const userMessage =
          "Invalid field id provided. The extension expects the GraphQL node id for the field (the global node id), not the field name. " +
          "Ensure you're passing the field's node id (e.g. from the project's field metadata) and not a human-friendly name.";
        try {
          vscode.window.showWarningMessage(userMessage);
        } catch (e) {
          // noop in tests or environments without a window
        }
        // Structured telemetry/log with context
        try {
          const { sendEvent } = await import('./telemetry');
          sendEvent('invalid_field_id_detected', { projectId, itemId, fieldId });
        } catch (e) {
          // best-effort
          logger.info('Telemetry: invalid_field_id_detected', { projectId, itemId, fieldId });
        }
        return { success: false, error: userMessage };
      }

      return {
        success: false,
        error: error.message || "Failed to update ProjectV2 field",
      };
    }
  }

  /**
   * Updates labels on an issue or pull request
   * Value should be an array of label IDs
   */
  private async updateLabels(
    itemId: string,
    value: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Value should be { labelIds: string[] }
      const labelIds = Array.isArray(value)
        ? value
        : Array.isArray(value?.labelIds)
          ? value.labelIds
          : [];

      // For labels, we need to get current labels and compute diff
      // For now, we'll use the simpler approach of adding all labels
      // A more sophisticated implementation would diff current vs new labels
      const mutation = `
        mutation($input: AddLabelsToLabelableInput!) {
          addLabelsToLabelable(input: $input) {
            clientMutationId
          }
        }
      `;

      await this.query(mutation, {
        input: {
          labelableId: itemId,
          labelIds: labelIds,
        },
      });

      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to update labels: ${error.message || error}`);
      return {
        success: false,
        error: error.message || "Failed to update labels",
      };
    }
  }

  /**
   * Updates assignees on an issue or pull request
   * Value should be an array of user IDs
   */
  private async updateAssignees(
    itemId: string,
    value: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Value should be { assigneeIds: string[] }
      const assigneeIds = Array.isArray(value)
        ? value
        : Array.isArray(value?.assigneeIds)
          ? value.assigneeIds
          : [];

      const mutation = `
        mutation($input: AddAssigneesToAssignableInput!) {
          addAssigneesToAssignable(input: $input) {
            clientMutationId
          }
        }
      `;

      await this.query(mutation, {
        input: {
          assignableId: itemId,
          assigneeIds: assigneeIds,
        },
      });

      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to update assignees: ${error.message || error}`);
      return {
        success: false,
        error: error.message || "Failed to update assignees",
      };
    }
  }

  /**
   * Updates reviewers on a pull request
   * Value should be { userIds?: string[], teamIds?: string[] }
   */
  private async updateReviewers(
    itemId: string,
    value: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Value should be { reviewerIds: string[] } or { userIds: string[], teamIds: string[] }
      const userIds = Array.isArray(value?.userIds) ? value.userIds : [];
      const teamIds = Array.isArray(value?.teamIds) ? value.teamIds : [];

      // If value.reviewerIds is provided, treat all as userIds for simplicity
      if (Array.isArray(value?.reviewerIds)) {
        userIds.push(...value.reviewerIds);
      }

      const mutation = `
        mutation($input: RequestReviewsInput!) {
          requestReviews(input: $input) {
            clientMutationId
          }
        }
      `;

      const input: any = {
        pullRequestId: itemId,
      };

      if (userIds.length > 0) {
        input.userIds = userIds;
      }
      if (teamIds.length > 0) {
        input.teamIds = teamIds;
      }

      await this.query(mutation, { input });

      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to update reviewers: ${error.message || error}`);
      return {
        success: false,
        error: error.message || "Failed to update reviewers",
      };
    }
  }

  /**
   * Updates milestone on an issue or pull request
   * Value should be a milestone ID (string)
   */
  private async updateMilestone(
    itemId: string,
    value: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Value should be { milestoneId: string } or just the milestoneId string
      const milestoneId =
        typeof value === "string"
          ? value
          : typeof value?.milestoneId === "string"
            ? value.milestoneId
            : null;

      if (!milestoneId) {
        return {
          success: false,
          error: "Milestone ID is required",
        };
      }

      // Try updateIssue first (works for both issues and PRs in GitHub API)
      const mutation = `
        mutation($input: UpdateIssueInput!) {
          updateIssue(input: $input) {
            clientMutationId
          }
        }
      `;

      await this.query(mutation, {
        input: {
          id: itemId,
          milestoneId: milestoneId,
        },
      });

      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to update milestone: ${error.message || error}`);
      return {
        success: false,
        error: error.message || "Failed to update milestone",
      };
    }
  }

  /**
   * Adds an issue or pull request to a project.
   * @param projectId - The global ID of the project
   * @param contentId - The global ID of the issue or pull request to add
   * @returns Result object with success status and optional error message
   */
  public async addItemToProject(
    projectId: string,
    contentId: string,
  ): Promise<{ success: boolean; error?: string; itemId?: string }> {
    try {
      const mutation = `
        mutation($input: AddProjectV2ItemByIdInput!) {
          addProjectV2ItemById(input: $input) {
            item {
              id
            }
          }
        }
      `;

      const result = await this.query<any>(mutation, {
        input: {
          projectId,
          contentId,
        },
      });

      const itemId = result?.addProjectV2ItemById?.item?.id;
      if (!itemId) {
        const technicalError =
          "Failed to add item to project - no item ID returned from GraphQL mutation";
        logger.error(technicalError);
        throw new Error("Failed to add item to project");
      }

      logger.info(
        `Successfully added item ${contentId} to project ${projectId}`,
      );
      return { success: true, itemId };
    } catch (error: any) {
      const technicalError = error.message || String(error);
      logger.error(`Failed to add item to project: ${technicalError}`);
      // Return a user-friendly error message
      const userMessage =
        technicalError.includes("not found") ||
          technicalError.includes("does not exist")
          ? "Item or project not found"
          : technicalError.includes("permission") ||
            technicalError.includes("unauthorized")
            ? "Permission denied"
            : "Failed to add item to project";
      return {
        success: false,
        error: userMessage,
      };
    }
  }
}
