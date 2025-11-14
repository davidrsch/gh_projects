export function aggregateMaps(items: any[]) {
  const labelMap = new Map<string, { id: string; name: string }>();
  const milestoneMap = new Map<string, { id: string; title: string }>();
  const repoMap = new Map<string, { nameWithOwner?: string; url?: string }>();
  const prMap = new Map<string, any>();
  const issueMap = new Map<string, any>();

  for (const it of items) {
    for (const fv of it.fieldValues) {
      if (fv.type === 'labels' && Array.isArray(fv.labels)) {
        for (const l of fv.labels) {
          if (l && l.id) labelMap.set(l.id, { id: l.id, name: l.name });
        }
      }
      if (fv.type === 'milestone' && fv.milestone) {
        const m = fv.milestone;
        if (m?.id) milestoneMap.set(m.id, { id: m.id, title: m.title });
      }
      if (fv.type === 'repository' && fv.repository) {
        const r = fv.repository;
        if (r?.nameWithOwner) repoMap.set(r.nameWithOwner, r);
      }
      if (fv.type === 'pull_request' && Array.isArray(fv.pullRequests)) {
        for (const p of fv.pullRequests) if (p?.id) prMap.set(p.id, p);
      }
      if (fv.type === 'issue' && Array.isArray(fv.issues)) {
        for (const iss of fv.issues) if (iss?.id) issueMap.set(iss.id, iss);
      }
    }
  }

  const repoNamesSet = new Set<string>();
  for (const [k, r] of repoMap.entries()) repoNamesSet.add(k);
  for (const p of prMap.values()) if (p?.repository?.nameWithOwner) repoNamesSet.add(p.repository.nameWithOwner);
  for (const it of issueMap.values()) if (it?.repository?.nameWithOwner) repoNamesSet.add(it.repository.nameWithOwner);

  const repoNames = Array.from(repoNamesSet);

  return { labelMap, milestoneMap, repoMap, prMap, issueMap, repoNames };
}

export function mergeOptions(existing: any[] | undefined, repoOptions?: Record<string, any[]>, inferred?: any[]) {
  const byKey = new Map<string, any>();
  const push = (o: any) => {
    const key = o?.id ?? (o?.name || '').toLowerCase();
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, o);
  };
  if (existing) for (const o of existing) push(o);
  if (repoOptions) for (const rn of Object.keys(repoOptions)) for (const o of repoOptions[rn] || []) push(o);
  if (inferred) for (const o of inferred) push(o);
  return Array.from(byKey.values());
}
