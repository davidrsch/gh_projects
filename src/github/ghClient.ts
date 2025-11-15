import * as vscode from "vscode";
import { ghQueryWithErrors } from "../lib/ghApiHelper";
import logger from "../lib/logger";
import { createCodeError } from "../lib/errors";
import messages from "../lib/messages";
import { normalizeFieldConfig } from "../lib/parsers/fieldConfigParser";
import { parseFieldValue } from "../lib/parsers/valueParsers";
import {
  makeLimits,
  buildCandidateFragments,
  buildRepoSelections,
  buildItemsQuery,
  buildFieldsQuery,
} from "../lib/helpers";
import { aggregateMaps, mergeOptions } from "../lib/aggregation";
import {
  FieldConfig,
  NormalizedValue,
  ProjectSnapshot,
  ProjectView,
  Item,
  Label,
  Milestone,
  PRSummary,
  IssueSummary,
  GHResponse,
  FieldsQueryData,
  ItemsQueryData,
  RepoQueryData,
  ProjectMetaNode,
  GhApiResponse,
  ProjectV2ViewsData,
} from "../lib/types";

export async function fetchProjectViews(
  projectId: string,
): Promise<ProjectView[]> {
  // Request `layout` and `number` for each view so the frontend can
  // detect the view type reliably (ProjectV2View.layout -> BOARD_LAYOUT, ROADMAP_LAYOUT, TABLE_LAYOUT)
  const gql = `query ($id: ID!) { node(id: $id) { __typename ... on ProjectV2 { id title shortDescription url views(first: 100) { nodes { id name number layout } } } } }`;
  try {
    const parsed = (await ghQueryWithErrors(gql, {
      id: projectId,
    })) as GhApiResponse<ProjectV2ViewsData>;
    const nodes = parsed?.data?.node?.views?.nodes;
    if (!Array.isArray(nodes)) return [];
    const mapped: ProjectView[] = nodes.map((n) => ({
      id: String(n?.id),
      name: n?.name,
      number: n?.number ?? null,
      layout: n?.layout ?? null,
    }));
    return mapped;
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    logger.error("fetchProjectViews error: " + msg);
    if ((e as any).code === "ENOENT") {
      vscode.window
        .showErrorMessage(messages.GH_NOT_FOUND, "Open install docs")
        .then((sel) => {
          if (sel)
            vscode.env.openExternal(
              vscode.Uri.parse("https://cli.github.com/"),
            );
        });
    }
    if ((e as any).code === "EPERM") {
      vscode.window
        .showErrorMessage(messages.GH_PERMISSION_ERROR_HINT, "Authenticate GH")
        .then((sel) => {
          if (sel === "Authenticate GH")
            vscode.env.openExternal(
              vscode.Uri.parse("https://cli.github.com/manual/gh_auth_login"),
            );
        });
    }
    return [];
  }
}

// --- Helper functions split out for testability ---
async function fetchMeta(
  projectId: string,
): Promise<ProjectMetaNode | undefined> {
  const metaQuery = `query{ node(id:${JSON.stringify(projectId)}){ __typename ... on ProjectV2 { id title } } }`;
  try {
    const metaRes = (await ghQueryWithErrors(metaQuery)) as GHResponse<{
      node?: ProjectMetaNode;
    }>;
    return metaRes?.data?.node;
  } catch (e) {
    logger.error("fetchMeta error: " + String((e as any).message || e || ""));
    throw e;
  }
}

async function fetchFields(
  projectId: string,
  LIMITS: any,
): Promise<FieldConfig[]> {
  const fieldsQuery = buildFieldsQuery(projectId, LIMITS);
  const fieldsRes = (await ghQueryWithErrors(fieldsQuery).catch((e: any) => {
    logger.error(
      "GraphQL error fetching fields: " + String((e as any).message || e || ""),
    );
    return {} as GHResponse<FieldsQueryData>;
  })) as GHResponse<FieldsQueryData>;
  const rawFields = fieldsRes?.data?.node?.fields?.nodes || [];
  const fields: FieldConfig[] = (rawFields || []).map((n: any) =>
    normalizeFieldConfig(n),
  );
  return fields;
}

async function fetchFieldDetails(
  fields: FieldConfig[],
  presentConfigTypes: Set<string>,
) {
  const fieldNodeSelections: string[] = [];
  for (const f of fields) {
    const fid = f.id;
    const selParts: string[] = ["__typename"];

    if (
      f.dataType === "SINGLE_SELECT" &&
      presentConfigTypes.has("ProjectV2SingleSelectField")
    ) {
      selParts.push(
        "... on ProjectV2SingleSelectField{ options{ id name description color } }",
      );
    }
    if (
      f.dataType === "ITERATION" &&
      presentConfigTypes.has("ProjectV2IterationField")
    ) {
      selParts.push(
        "... on ProjectV2IterationField{ configuration{ iterations{ id title startDate } } }",
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
    const detailRes = (await ghQueryWithErrors(
      fieldsDetailQuery,
    )) as GHResponse<Record<string, any>>;
    for (const f of fields) {
      const key = `n_${f.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      const node = detailRes?.data?.[key];
      if (!node) continue;
      if (
        node.options &&
        Array.isArray(node.options) &&
        node.options.length > 0
      ) {
        f.options = node.options.map((o: any) => ({
          id: o.id,
          name: o.name,
          description: o.description,
          color: o.color,
        })) as Label[];
      }
      if (node.configuration) {
        f.configuration = node.configuration;
      }
    }
  } catch (e) {
    logger.debug(
      "per-field detail fetch failed: " +
        String((e as any)?.message || e || ""),
    );
    // best-effort; swallow errors
  }
}

async function introspectItemFieldTypes(): Promise<string[]> {
  const introspectQuery = `query { __type(name: "ProjectV2ItemFieldValue") { possibleTypes { name } } }`;
  try {
    const introRes = (await ghQueryWithErrors(
      introspectQuery,
    )) as GHResponse<any>;
    return (introRes?.data?.__type?.possibleTypes || []).map(
      (p: any) => p.name,
    );
  } catch (e) {
    logger.debug(
      "introspect query failed: " + String((e as any)?.message || e || ""),
    );
    return [];
  }
}

async function fetchItems(
  projectId: string,
  aliasSelections: string,
  LIMITS: any,
): Promise<Item[]> {
  const itemsQuery = buildItemsQuery(projectId, aliasSelections, LIMITS);
  const itemsRes = (await ghQueryWithErrors(itemsQuery).catch((e: any) => {
    logger.error(
      "GraphQL error fetching items (by-name): " +
        String((e as any).message || e || ""),
    );
    return {} as GHResponse<ItemsQueryData>;
  })) as GHResponse<ItemsQueryData>;

  const rawItems = itemsRes?.data?.node?.items?.nodes || [];
  return rawItems.map((item: any) => item as Item);
}

async function fetchRepoOptions(repoNames: string[], LIMITS: any) {
  const repoOptionsMap: Record<
    string,
    { labels?: Label[]; milestones?: Milestone[] }
  > = {};
  if (repoNames.length === 0) return repoOptionsMap;
  const repoSelections = buildRepoSelections(repoNames, LIMITS);
  const repoQuery = `query{\n    ${repoSelections}\n  }`;
  try {
    const repoRes = (await ghQueryWithErrors(
      repoQuery,
    )) as GHResponse<RepoQueryData>;
    for (let i = 0; i < repoNames.length; i++) {
      const rn = repoNames[i];
      const key = `r${i}`;
      const repoNode = repoRes?.data?.[key];
      if (!repoNode) continue;
      const labels: Label[] = (repoNode.labels?.nodes || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        description: l.description,
      }));
      const milestones: Milestone[] = (repoNode.milestones?.nodes || []).map(
        (m: any) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          dueOn: m.dueOn,
        }),
      );
      repoOptionsMap[rn] = { labels, milestones };
    }
  } catch (e) {
    // best-effort
  }
  return repoOptionsMap;
}

export async function fetchProjectFields(
  projectId: string,
  opts?: { first?: number },
): Promise<ProjectSnapshot> {
  const first = opts?.first ?? 50;
  const LIMITS = makeLimits(first);

  // Fetch project metadata
  let project: ProjectMetaNode | undefined;
  try {
    project = await fetchMeta(projectId);
  } catch (e: any) {
    logger.error(
      "GraphQL error fetching project metadata: " +
        String(e?.message || e || ""),
    );
    if ((e as any).code === "ENOENT") {
      vscode.window
        .showErrorMessage(messages.GH_NOT_FOUND, "Open install docs")
        .then((sel) => {
          if (sel)
            vscode.env.openExternal(
              vscode.Uri.parse("https://cli.github.com/"),
            );
        });
    }
    if ((e as any).code === "EPERM") {
      vscode.window
        .showErrorMessage(messages.GH_PERMISSION_ERROR_HINT, "Authenticate GH")
        .then((sel) => {
          if (sel)
            vscode.env.openExternal(
              vscode.Uri.parse("https://cli.github.com/manual/gh_auth_login"),
            );
        });
    }
  }

  if (!project) throw createCodeError("No project found or insufficient permissions", "ENOPROJECT");

  const fields = await fetchFields(project.id, LIMITS);

  // Determine configuration types present
  const configTypeNames = [
    "ProjectV2SingleSelectField",
    "ProjectV2IterationField",
  ];
  const configIntroQuery = `query{\n${configTypeNames.map((n, i) => `t${i}: __type(name:${JSON.stringify(n)}){ name }`).join("\n")}\n}`;
  let presentConfigTypes = new Set<string>();
  try {
    const cIntro = await ghQueryWithErrors(configIntroQuery).catch(
      () => ({}) as any,
    );
    for (let i = 0; i < configTypeNames.length; i++) {
      const key = `t${i}`;
      const name = cIntro?.data?.[key]?.name;
      if (name) presentConfigTypes.add(name);
    }
  } catch (e) {
    logger.debug("config introspect failed, assuming config types present");
    presentConfigTypes = new Set(configTypeNames);
  }

  await fetchFieldDetails(fields, presentConfigTypes);

  const possibleTypes = await introspectItemFieldTypes();

  const candidateFragments = buildCandidateFragments(LIMITS);
  const aliasSelections: string[] = [];
  const fieldAliases: { alias: string; name: string }[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const alias = `f${i}`;
    fieldAliases.push({ alias, name: f.name });
    const fragments = candidateFragments
      .filter(
        (c) => possibleTypes.length === 0 || possibleTypes.includes(c.typename),
      )
      .map((c) => c.selection)
      .join("\n              ");
    const sel = `${alias}: fieldValueByName(name:${JSON.stringify(f.name)}){ __typename\n              ${fragments}\n            }`;
    aliasSelections.push(sel);
  }

  // Fetch items and parse into normalized items
  const rawItems = (await (async () => {
    const itemsQuery = buildItemsQuery(
      project.id,
      aliasSelections.join("\n          "),
      LIMITS,
    );
    const itemsRes = (await ghQueryWithErrors(itemsQuery).catch((e: any) => {
      logger.error(
        "GraphQL error fetching items (by-name): " +
          String((e as any).message || e || ""),
      );
      if ((e as any).code === "EPERM") {
        vscode.window
          .showErrorMessage(
            messages.GH_PERMISSION_ERROR_HINT,
            "Authenticate GH",
          )
          .then((sel) => {
            if (sel)
              vscode.env.openExternal(
                vscode.Uri.parse("https://cli.github.com/manual/gh_auth_login"),
              );
          });
      }
      return {} as GHResponse<ItemsQueryData>;
    })) as GHResponse<ItemsQueryData>;
    return itemsRes?.data?.node?.items?.nodes || [];
  })()) as any[];

  const items: Item[] = (rawItems || []).map((item: any) => {
    const fv: any[] = [];
    for (let i = 0; i < fieldAliases.length; i++) {
      const { alias } = fieldAliases[i];
      const node = item[alias];
      if (node) {
        node.field = fields[i];
        node.itemContent = item.content;
        const parsed = parseFieldValue(node) as any;
        try {
          if (parsed && typeof parsed === "object") {
            if (!parsed.raw) parsed.raw = node;
            if (!parsed.content) parsed.content = item.content ?? null;
          }
        } catch (e) {
          // ignore
        }
        fv.push(parsed);
      } else {
        const fconf = fields[i];
        const content = item.content ?? null;
        if (
          fconf &&
          fconf.dataType === "PARENT_ISSUE" &&
          content &&
          content.parent
        ) {
          const p = content.parent;
          const inferred: any = {
            type: "issue",
            fieldId: fconf.id,
            issues: [
              {
                id: p.id,
                number: p.number,
                title: p.title,
                url: p.url,
                repository: p.repository
                  ? { nameWithOwner: p.repository.nameWithOwner }
                  : undefined,
                parent: p.parent
                  ? {
                      id: p.parent.id,
                      number: p.parent.number,
                      url: p.parent.url,
                      title: p.parent.title,
                    }
                  : undefined,
              },
            ],
            raw: { issue: p },
            content: content,
          };
          fv.push(inferred);
        } else if (
          fconf &&
          fconf.dataType === "SUB_ISSUES_PROGRESS" &&
          content &&
          content.subIssuesSummary
        ) {
          const s = content.subIssuesSummary;
          const inferred: any = {
            type: "sub_issues_progress",
            fieldId: fconf.id,
            total: s.total ?? null,
            done: s.completed ?? null,
            percent: s.percentCompleted ?? null,
            raw: { subIssuesSummary: s },
            content: content,
          };
          fv.push(inferred);
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
    }
    return {
      id: item.id,
      fieldValues: fv as NormalizedValue[],
      content: item.content,
    };
  });

  const { labelMap, milestoneMap, repoMap, prMap, issueMap, repoNames } =
    aggregateMaps(items);
  const repoOptionsMap = await fetchRepoOptions(repoNames, LIMITS);

  for (const f of fields) {
    if (f.dataType === "LABELS") {
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
    }
    if (f.dataType === "MILESTONE") {
      if (Object.keys(repoOptionsMap).length > 0) {
        f.repoOptions = {};
        for (const rn of Object.keys(repoOptionsMap)) {
          const mlist = repoOptionsMap[rn].milestones || [];
          f.repoOptions[rn] = mlist.map((m) => ({
            id: m.id,
            name: m.title,
            description: (m as any).description,
          }));
        }
      } else {
        f.options = Array.from(milestoneMap.values()).map((m: any) => ({
          id: m.id,
          name: m.title,
        }));
      }
    }
    if (f.dataType === "REPOSITORY") {
      f.options = Array.from(repoMap.values()).map((r: any) => ({
        id: r.nameWithOwner,
        name: r.nameWithOwner,
      }));
    }
    if (f.dataType === "LINKED_PULL_REQUESTS") {
      f.options = Array.from(prMap.values());
    }
    if (f.dataType === "TRACKS" || f.dataType === "PARENT_ISSUE") {
      f.options = Array.from(issueMap.values());
    }
  }

  for (const f of fields) {
    if (f.dataType === "LABELS") {
      const inferred = Array.from(labelMap.values()).map((l: any) => ({
        id: l.id,
        name: l.name,
        color: (l as any).color,
      }));
      f.options = mergeOptions(f.options, undefined, inferred);
    }
    if (f.dataType === "MILESTONE") {
      const inferred = Array.from(milestoneMap.values()).map((m: any) => ({
        id: m.id,
        name: m.title,
      }));
      f.options = mergeOptions(f.options, undefined, inferred);
    }
  }

  const result: ProjectSnapshot = {
    project: { id: project.id, title: project.title },
    fields: fields,
    items: items,
  };

  return result;
}

export default { fetchProjectViews, fetchProjectFields };
