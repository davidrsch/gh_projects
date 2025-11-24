import { graphql } from '@octokit/graphql';
import { AuthenticationManager } from './AuthenticationManager';
import logger from '../lib/logger';
import * as vscode from 'vscode';
import {
    ProjectSnapshot,
    ProjectView,
    Item,
    FieldConfig,
    ProjectMetaNode,
    FieldsQueryData,
    GHResponse,
    GhApiResponse,
    ProjectV2ViewsData,
    ItemsQueryData,
    RepoQueryData,
    Label,
    Milestone,
    NormalizedValue,
    RepoItem,
    ParsedRepoEntry
} from '../lib/types';
import { normalizeFieldConfig } from "../lib/parsers/fieldConfigParser";
import { parseFieldValue, getGhColor } from "../lib/parsers/valueParsers";
import {
    makeLimits,
    buildCandidateFragments,
    buildRepoSelections,
    buildItemsQuery,
    buildFieldsQuery,
} from "../lib/helpers";
import { aggregateMaps, mergeOptions } from "../lib/aggregation";
import { createCodeError } from "../lib/errors";
import messages from "../lib/messages";

export class GitHubRepository {
    private static instance: GitHubRepository;
    private authManager: AuthenticationManager;

    private constructor() {
        this.authManager = AuthenticationManager.getInstance();
    }

    public static getInstance(): GitHubRepository {
        if (!GitHubRepository.instance) {
            GitHubRepository.instance = new GitHubRepository();
        }
        return GitHubRepository.instance;
    }

    /**
     * Executes a GraphQL query with the current user's token.
     */
    private async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
        const token = await this.authManager.ensureAuthenticated();
        try {
            return await graphql<T>(query, {
                ...variables,
                headers: {
                    authorization: `token ${token}`,
                },
            });
        } catch (error: any) {
            logger.error(`GitHubRepository: Query failed. ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetches projects for a given owner and repository name.
     */
    public async getProjects(owner: string, name: string): Promise<ParsedRepoEntry> {
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
            const response = await this.query<any>(gql, { owner, name });
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
        // Removed 'layout' field to rule out schema issues
        const gql = `query ($id: ID!) { node(id: $id) { __typename ... on ProjectV2 { id title shortDescription url views(first: 100) { nodes { id name number } } } } }`;
        try {
            logger.info(`[ghProjects] Fetching views for ${projectId}`);
            const parsed = await this.query<ProjectV2ViewsData>(gql, { id: projectId });
            logger.warn(`[ghProjects] Raw views response for ${projectId}: ${JSON.stringify(parsed)}`);

            const nodes = parsed?.node?.views?.nodes;
            if (!Array.isArray(nodes)) {
                logger.warn(`fetchProjectViews: No views found for project ${projectId}`);
                return [];
            }
            const mapped = nodes.map((n) => ({
                id: String(n?.id),
                name: n?.name,
                number: n?.number ?? null,
                layout: null,
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
     * Fetches project views.
                id: String(n?.id),
                name: n?.name,
                number: n?.number ?? null,
                layout: null,
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
    public async getProjectViewDetails(projectId: string, viewNumber: number): Promise<any> {
        const gql = `query($projectId: ID!, $viewNumber: Int!) { node(id: $projectId) { __typename ... on ProjectV2 { view(number: $viewNumber) { id name number layout filter fields(first: 100) { nodes { ... on ProjectV2FieldCommon { id name dataType } } } sortByFields(first: 20) { nodes { direction field { ... on ProjectV2FieldCommon { name } } } } groupByFields(first: 10) { nodes { ... on ProjectV2FieldCommon { name } } } verticalGroupByFields(first: 10) { nodes { ... on ProjectV2FieldCommon { name } } } } } } }`;
        try {
            const res = await this.query<any>(gql, { projectId, viewNumber });
            return res?.node?.view;
        } catch (error) {
            logger.error(`Failed to fetch view details: ${error}`);
            return null;
        }
    }

    /**
     * Fetches full project fields and items (snapshot).
     */
    public async fetchProjectFields(projectId: string, opts?: { first?: number; viewFilter?: string }): Promise<ProjectSnapshot> {
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
        const fieldsRes = await this.query<FieldsQueryData>(fieldsQuery);
        const rawFields = fieldsRes?.node?.fields?.nodes || [];
        const fields: FieldConfig[] = rawFields.map((n: any) => normalizeFieldConfig(n));

        // 3. Introspect Config Types
        const configTypeNames = ["ProjectV2SingleSelectField", "ProjectV2IterationField"];
        const configIntroQuery = `query{\n${configTypeNames.map((n, i) => `t${i}: __type(name:${JSON.stringify(n)}){ name }`).join("\n")}\n}`;
        let presentConfigTypes = new Set<string>();
        try {
            const cIntro = await this.query<any>(configIntroQuery);
            for (let i = 0; i < configTypeNames.length; i++) {
                const key = `t${i}`;
                if (cIntro[key]?.name) presentConfigTypes.add(cIntro[key].name);
            }
        } catch {
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
                .filter((c) => possibleTypes.length === 0 || possibleTypes.includes(c.typename))
                .map((c) => c.selection)
                .join("\n              ");
            const sel = `${alias}: fieldValueByName(name:${JSON.stringify(f.name)}){ __typename\n              ${fragments}\n            }`;
            aliasSelections.push(sel);
        }

        // 7. Fetch Items
        const itemsQuery = buildItemsQuery(project.id, aliasSelections.join("\n          "), LIMITS, viewFilter);
        const itemsRes = await this.query<ItemsQueryData>(itemsQuery);
        const rawItems = itemsRes?.node?.items?.nodes || [];

        // 8. Normalize Items
        const items: Item[] = rawItems.map((item: any) => {
            const fv: any[] = [];
            for (let i = 0; i < fieldAliases.length; i++) {
                const { alias } = fieldAliases[i];
                const node = item[alias];
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
                    // Handle missing/special fields (parent issue, sub-issues) logic here if needed
                    // For brevity, using simplified missing logic
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
        const { labelMap, milestoneMap, repoMap, prMap, issueMap, repoNames } = aggregateMaps(items);
        const repoOptionsMap = await this.fetchRepoOptions(repoNames, LIMITS);

        // 10. Merge Options back to fields
        for (const f of fields) {
            if (f.dataType === "LABELS") {
                if (Object.keys(repoOptionsMap).length > 0) {
                    f.repoOptions = {};
                    for (const rn of Object.keys(repoOptionsMap)) {
                        const lbls = repoOptionsMap[rn].labels || [];
                        f.repoOptions[rn] = lbls.map((l) => ({ id: l.id, name: l.name, description: (l as any).description, color: l.color }));
                    }
                } else {
                    f.options = Array.from(labelMap.values()).map((l: any) => ({ id: l.id, name: l.name, color: (l as any).color }));
                }
            }
            // ... (Add other field types logic: MILESTONE, REPOSITORY, etc.)
        }

        return {
            project: { id: project.id, title: project.title },
            fields,
            items
        };
    }

    private async fetchFieldDetails(fields: FieldConfig[], presentConfigTypes: Set<string>) {
        const fieldNodeSelections: string[] = [];
        for (const f of fields) {
            const fid = f.id;
            const selParts: string[] = ["__typename"];
            if (f.dataType === "SINGLE_SELECT" && presentConfigTypes.has("ProjectV2SingleSelectField")) {
                selParts.push("... on ProjectV2SingleSelectField{ options{ id name description color } }");
            }
            if (f.dataType === "ITERATION" && presentConfigTypes.has("ProjectV2IterationField")) {
                selParts.push("... on ProjectV2IterationField{ configuration{ iterations{ id title startDate } } }");
            }
            if (selParts.length > 1) {
                fieldNodeSelections.push(`n_${fid.replace(/[^a-zA-Z0-9_]/g, "_")}: node(id:${JSON.stringify(fid)}){ ${selParts.join(" ")} }`);
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
                    f.options = node.options.map((o: any) => ({ id: o.id, name: o.name, description: o.description, color: o.color }));
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
        } catch {
            return [];
        }
    }

    private async fetchRepoOptions(repoNames: string[], LIMITS: any) {
        const repoOptionsMap: Record<string, { labels?: Label[]; milestones?: Milestone[] }> = {};
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
                const labels = (repoNode.labels?.nodes || []).map((l: any) => ({ id: l.id, name: l.name, color: l.color, description: l.description }));
                const milestones = (repoNode.milestones?.nodes || []).map((m: any) => ({ id: m.id, title: m.title, description: m.description, dueOn: m.dueOn }));
                repoOptionsMap[rn] = { labels, milestones };
            }
        } catch (e) {
            logger.debug("fetchRepoOptions error: " + e);
        }
        return repoOptionsMap;
    }
}
