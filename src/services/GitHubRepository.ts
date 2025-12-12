import logger from "../lib/logger";
import * as vscode from "vscode";
import {
  ProjectSnapshot,
  ProjectView,
  Item,
  FieldConfig,
  ProjectMetaNode,
  NormalizedValue,
  ParsedRepoEntry,
  ProjectV2FieldType,
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
      // logger.warn(`[ghProjects] Raw views response for ${projectId}: ${JSON.stringify(parsed)}`);

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
    const metaQuery = `query{ node(id:${JSON.stringify(projectId)}){ __typename ... on ProjectV2 { id title } } }`;
    let project: ProjectMetaNode | undefined;
    try {
      const metaRes = await this.query<{ node?: ProjectMetaNode }>(metaQuery);
      project = metaRes?.node;
    } catch (e: any) {
      logger.error("fetchMeta error: " + e.message);
      throw e;
    }

    if (!project) throw createCodeError("No project found", "ENOPROJECT");

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
      project: { id: project.id, title: project.title },
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
   * Updates a field value for a project item.
   * @param fieldType - The type of field being updated (text, number, date)
   */
  public async updateFieldValue(
    projectId: string,
    itemId: string,
    fieldId: string,
    value: any,
    fieldType?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // GitHub Projects V2 uses different mutations for different field types
      // For text, number, and date fields, we use updateProjectV2ItemFieldValue
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
      // Note: GitHub Projects V2 API doesn't support clearing field values to null
      // via updateProjectV2ItemFieldValue mutation. To clear a field, use
      // clearProjectV2ItemFieldValue mutation instead.
      if (value === null || value === undefined) {
        return {
          success: false,
          error: "Clearing fields to null is not supported via this mutation",
        };
      }

      // Use explicit field type if provided, otherwise infer from value
      const type = fieldType?.toLowerCase();
      if (type === "text" || (type === undefined && typeof value === "string")) {
        // Text value (default for strings if type not specified)
        input.value = { text: String(value) };
      } else if (type === "date" || (type === undefined && typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value))) {
        // ISO 8601 date string (more strict pattern)
        input.value = { date: value };
      } else if (type === "number" || (type === undefined && typeof value === "number")) {
        // Number value
        input.value = { number: value };
      } else {
        return {
          success: false,
          error: "Unsupported value type",
        };
      }

      await this.query(mutation, { input });

      return { success: true };
    } catch (error: any) {
      logger.error(
        `Failed to update field value: ${error.message || error}`,
      );
      return {
        success: false,
        error: error.message || "Failed to update field value",
      };
    }
  }
}
