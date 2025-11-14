import { execFile } from 'child_process';
import { ghGraphQL } from '../lib/fields_base/graphql';
import { normalizeFieldConfig } from '../lib/fields_base/parsers/fieldConfigParser';
import { parseFieldValue } from '../lib/fields_base/parsers/valueParsers';
import { makeLimits, buildCandidateFragments, buildRepoSelections, buildItemsQuery, buildFieldsQuery } from '../lib/fields_base/helpers';
import { aggregateMaps, mergeOptions } from '../lib/fields_base/aggregation';

export async function fetchProjectViews(projectId: string): Promise<any[]> {
  // Request `layout` and `number` for each view so the frontend can
  // detect the view type reliably (ProjectV2View.layout -> BOARD_LAYOUT, ROADMAP_LAYOUT, TABLE_LAYOUT)
  const gql = `query ($id: ID!) { node(id: $id) { __typename ... on ProjectV2 { id title shortDescription url views(first: 100) { nodes { id name number layout } } } } }`;

  return new Promise((resolve) => {
    const args = ['api', 'graphql', '-f', `id=${projectId}`, '-f', `query=${gql}`];
    execFile('gh', args, { maxBuffer: 10 * 1024 * 1024 }, (err: any, stdout: string, stderr: string) => {
      if (err) {
        console.error('gh graphql error', err, stderr);
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout);
        const nodes = parsed && parsed.data && parsed.data.node && parsed.data.node.views && parsed.data.node.views.nodes;
        if (!Array.isArray(nodes)) return resolve([]);
        // Normalize nodes to ensure layout and number are simple, predictable fields
        const mapped = nodes.map((n: any) => ({
          id: n.id,
          name: n.name,
          number: n.number ?? null,
          layout: n.layout ?? null,
        }));
        return resolve(mapped);
      } catch (e) {
        console.error('Failed to parse gh graphql output', e, stdout, stderr);
        return resolve([]);
      }
    });
  });
}

export async function fetchProjectFields(projectId: string, opts?: { first?: number }): Promise<{ project: { id: string; title?: string }, fields: any[], items: any[] }> {
  const first = opts?.first ?? 50;
  const LIMITS = makeLimits(first);

  // Fetch project metadata
  const metaQuery = `query{ node(id:${JSON.stringify(projectId)}){ __typename ... on ProjectV2 { id title } } }`;
  let project: any = undefined;
  try {
    const metaRes = await ghGraphQL(metaQuery);
    project = metaRes?.data?.node;
  } catch (e) {
    console.error('GraphQL error fetching project metadata:', (e as any).message || e);
  }

  if (!project) {
    throw new Error('No project found or insufficient permissions');
  }

  // Fields
  const fieldsQuery = buildFieldsQuery(project.id, LIMITS);
  const fieldsRes = await ghGraphQL(fieldsQuery).catch((e) => {
    console.error('GraphQL error fetching fields:', (e as any).message || e);
    return {} as any;
  });
  const rawFields = fieldsRes?.data?.node?.fields?.nodes || [];
  const fields = (rawFields || []).map((n: any) => normalizeFieldConfig(n));

  // Per-field detailed node fetch for options/configuration
  const configTypeNames = ['ProjectV2SingleSelectField', 'ProjectV2IterationField'];
  const configIntroQuery = `query{\n${configTypeNames.map((n, i) =>   `t${i}: __type(name:${JSON.stringify(n)}){ name }`).join('\n')}\n}`;
  let presentConfigTypes = new Set<string>();
  try {
    const cIntro = await ghGraphQL(configIntroQuery);
    for (let i = 0; i < configTypeNames.length; i++) {
      const key = `t${i}`;
      const name = cIntro?.data?.[key]?.name;
      if (name) presentConfigTypes.add(name);
    }
  } catch (e) {
    presentConfigTypes = new Set(configTypeNames);
  }

  const fieldNodeSelections: string[] = [];
  for (const f of fields) {
    const fid = f.id;
    const selParts: string[] = ['__typename'];

    if (f.dataType === 'SINGLE_SELECT' && presentConfigTypes.has('ProjectV2SingleSelectField')) {
      selParts.push('... on ProjectV2SingleSelectField{ options{ id name description color } }');
    }
    if (f.dataType === 'ITERATION' && presentConfigTypes.has('ProjectV2IterationField')) {
      selParts.push('... on ProjectV2IterationField{ configuration{ iterations{ id title startDate } } }');
    }
    if (selParts.length > 1) {
       fieldNodeSelections.push(`n_${fid.replace(/[^a-zA-Z0-9_]/g, '_')}: node(id:${JSON.stringify(fid)}){ ${selParts.join(' ')} }`);
    }
  }

  if (fieldNodeSelections.length > 0) {
    const fieldsDetailQuery = `query{\n  ${fieldNodeSelections.join('\n  ')}\n}`;
    try {
      const detailRes = await ghGraphQL(fieldsDetailQuery);
      for (const f of fields) {
        const key = `n_${f.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const node = detailRes?.data?.[key];
        if (!node) continue;
        if (node.options && Array.isArray(node.options) && node.options.length > 0) {
          f.options = node.options.map((o: any) => ({ id: o.id, name: o.name, description: o.description, color: o.color }));
        }
        if (node.configuration) {
          f.configuration = node.configuration;
        }
      }
    } catch (e) {
      // ignore per-field detail failures - best-effort
    }
  }

  // Introspect ItemFieldValue types
  const introspectQuery = `query { __type(name: "ProjectV2ItemFieldValue") { possibleTypes { name } } }`;
  let possibleTypes: string[] = [];
  try {
    const introRes = await ghGraphQL(introspectQuery);
    possibleTypes = (introRes?.data?.__type?.possibleTypes || []).map((p: any) => p.name);
  } catch (e) {
    possibleTypes = [];
  }

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
      .join('\n              ');
    const sel = `${alias}: fieldValueByName(name:${JSON.stringify(f.name)}){ __typename\n              ${fragments}\n            }`;
    aliasSelections.push(sel);
  }

  const itemsQuery = buildItemsQuery(project.id, aliasSelections.join('\n          '), LIMITS);
  const itemsRes = await ghGraphQL(itemsQuery).catch((e) => {
    console.error('GraphQL error fetching items (by-name):', (e as any).message || e);
    return {} as any;
  });

  const rawItems = itemsRes?.data?.node?.items?.nodes || [];
  const items = (rawItems || []).map((item: any) => {
    const fv: any[] = [];
    for (let i = 0; i < fieldAliases.length; i++) {
      const { alias } = fieldAliases[i];
      const node = item[alias];
      if (node) {
        node.field = fields[i];
        node.itemContent = item.content;
        const parsed = parseFieldValue(node) as any;
        try {
          if (parsed && typeof parsed === 'object') {
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
        if (fconf && fconf.dataType === 'PARENT_ISSUE' && content && content.parent) {
          const p = content.parent;
          const inferred: any = {
            type: 'issue',
            fieldId: fconf.id,
            issues: [
              {
                id: p.id,
                number: p.number,
                title: p.title,
                url: p.url,
                repository: p.repository ? { nameWithOwner: p.repository.nameWithOwner } : undefined,
                parent: p.parent ? { id: p.parent.id, number: p.parent.number, url: p.parent.url, title: p.parent.title } : undefined,
              },
            ],
            raw: { issue: p },
            content: content,
          };
          fv.push(inferred);
        } else if (fconf && fconf.dataType === 'SUB_ISSUES_PROGRESS' && content && content.subIssuesSummary) {
          const s = content.subIssuesSummary;
          const inferred: any = {
            type: 'sub_issues_progress',
            fieldId: fconf.id,
            total: s.total ?? null,
            done: s.completed ?? null,
            percent: s.percentCompleted ?? null,
            raw: { subIssuesSummary: s },
            content: content,
          };
          fv.push(inferred);
        } else {
          fv.push({ type: 'missing', fieldId: fields[i].id, fieldName: fields[i].name, raw: null, content: item.content ?? null });
        }
      }
    }
    return { id: item.id, fieldValues: fv, content: item.content };
  });

  const { labelMap, milestoneMap, repoMap, prMap, issueMap, repoNames } = aggregateMaps(items);
  const repoOptionsMap: Record<string, any> = {};
  if (repoNames.length > 0) {
    const repoSelections = buildRepoSelections(repoNames, LIMITS);
    const repoQuery = `query{\n    ${repoSelections}\n  }`;
    try {
      const repoRes = await ghGraphQL(repoQuery);
      for (let i = 0; i < repoNames.length; i++) {
        const rn = repoNames[i];
        const key = `r${i}`;
        const repoNode = repoRes?.data?.[key];
        if (!repoNode) continue;
        const labels = (repoNode.labels?.nodes || []).map((l: any) => ({ id: l.id, name: l.name, color: l.color, description: l.description }));
        const milestones = (repoNode.milestones?.nodes || []).map((m: any) => ({ id: m.id, title: m.title, description: m.description, dueOn: m.dueOn }));
        repoOptionsMap[rn] = { labels, milestones };
      }
    } catch (e) {
      // ignore
    }
  }

  for (const f of fields) {
    if (f.dataType === 'LABELS') {
      if (Object.keys(repoOptionsMap).length > 0) {
        f.repoOptions = {};
        for (const rn of Object.keys(repoOptionsMap)) f.repoOptions[rn] = repoOptionsMap[rn].labels;
      } else {
        f.options = Array.from(labelMap.values()).map((l) => ({ id: l.id, name: l.name, color: (l as any).color }));
      }
    }
    if (f.dataType === 'MILESTONE') {
      if (Object.keys(repoOptionsMap).length > 0) {
        f.repoOptions = {};
        for (const rn of Object.keys(repoOptionsMap)) f.repoOptions[rn] = repoOptionsMap[rn].milestones;
      } else {
        f.options = Array.from(milestoneMap.values()).map((m) => ({ id: m.id, name: m.title }));
      }
    }
    if (f.dataType === 'REPOSITORY') {
      f.options = Array.from(repoMap.values()).map((r) => ({ id: r.nameWithOwner, name: r.nameWithOwner }));
    }
    if (f.dataType === 'LINKED_PULL_REQUESTS') {
      f.options = Array.from(prMap.values());
    }
    if (f.dataType === 'TRACKS' || f.dataType === 'PARENT_ISSUE') {
      f.options = Array.from(issueMap.values());
    }
  }

  for (const f of fields) {
    if (f.dataType === 'LABELS') {
      const inferred = Array.from(labelMap.values()).map((l) => ({ id: l.id, name: l.name, color: (l as any).color }));
      f.options = mergeOptions(f.options, undefined, inferred);
    }
    if (f.dataType === 'MILESTONE') {
      const inferred = Array.from(milestoneMap.values()).map((m) => ({ id: m.id, name: m.title }));
      f.options = mergeOptions(f.options, undefined, inferred);
    }
  }

  const result = {
    project: { id: project.id, title: project.title },
    fields: fields,
    items: items,
  };

  return result;
}

export default { fetchProjectViews, fetchProjectFields };
