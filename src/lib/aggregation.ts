import { Item, NormalizedValue, PRSummary, IssueSummary } from "./types";

export function aggregateMaps(items: Item[]): {
  labelMap: Map<string, { id: string; name: string }>;
  milestoneMap: Map<string, { id: string; title: string }>;
  repoMap: Map<string, { nameWithOwner?: string; url?: string }>;
  prMap: Map<string, PRSummary>;
  issueMap: Map<string, IssueSummary>;
  repoNames: string[];
} {
  const labelMap = new Map<string, { id: string; name: string }>();
  const milestoneMap = new Map<string, { id: string; title: string }>();
  const repoMap = new Map<string, { nameWithOwner?: string; url?: string }>();
  const prMap = new Map<string, PRSummary>();
  const issueMap = new Map<string, IssueSummary>();

  for (const it of items) {
    const fvs: NormalizedValue[] = Array.isArray(it.fieldValues)
      ? it.fieldValues
      : [];
    for (const fv of fvs) {
      if ((fv as any).type === "labels" && Array.isArray((fv as any).labels)) {
        for (const l of (fv as any).labels) {
          if (l && l.id) labelMap.set(l.id, { id: l.id, name: l.name });
        }
      }
      if ((fv as any).type === "milestone" && (fv as any).milestone) {
        const m = (fv as any).milestone;
        if (m?.id) milestoneMap.set(m.id, { id: m.id, title: m.title });
      }
      if ((fv as any).type === "repository" && (fv as any).repository) {
        const r = (fv as any).repository;
        if (r?.nameWithOwner) repoMap.set(r.nameWithOwner, r);
      }
      if (
        (fv as any).type === "pull_request" &&
        Array.isArray((fv as any).pullRequests)
      ) {
        for (const p of (fv as any).pullRequests) if (p?.id) prMap.set(p.id, p);
      }
      if ((fv as any).type === "issue" && Array.isArray((fv as any).issues)) {
        for (const iss of (fv as any).issues)
          if (iss?.id) issueMap.set(iss.id, iss);
      }
    }
  }

  const repoNamesSet = new Set<string>();
  for (const [k] of repoMap.entries()) repoNamesSet.add(k);
  for (const p of prMap.values())
    if (p?.repository?.nameWithOwner)
      repoNamesSet.add(p.repository.nameWithOwner);
  for (const it of issueMap.values())
    if (it?.repository?.nameWithOwner)
      repoNamesSet.add(it.repository.nameWithOwner);

  const repoNames = Array.from(repoNamesSet);

  return { labelMap, milestoneMap, repoMap, prMap, issueMap, repoNames };
}

export function mergeOptions(
  existing: any[] | undefined,
  repoOptions?: Record<string, any[]>,
  inferred?: any[],
): any[] {
  const byKey = new Map<string, any>();
  const push = (o: any) => {
    const key = o?.id ?? (o?.name || "").toLowerCase();
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, o);
  };
  if (existing) for (const o of existing) push(o);
  if (repoOptions)
    for (const rn of Object.keys(repoOptions))
      for (const o of repoOptions[rn] || []) push(o);
  if (inferred) for (const o of inferred) push(o);
  return Array.from(byKey.values());
}
