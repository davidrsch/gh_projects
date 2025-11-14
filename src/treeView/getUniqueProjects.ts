type ProjectNode = { id?: string; title?: string; shortDescription?: string; url?: string };

export function normalizeKey(p: ProjectNode) {
  if (p.id) return `id:${p.id}`;
  if (p.url) return `url:${p.url}`;
  if (p.title) return `title:${p.title}`;
  return JSON.stringify(p);
}

export function uniqueProjectsFromResults(parsed: any[]) {
  const map = new Map<string, { id?: string; title?: string; shortDescription?: string; url?: string; repos: { owner?: string; name?: string }[] }>();
  for (const entry of parsed) {
    const owner = entry && entry.owner;
    const name = entry && entry.name;
    const projects = entry && entry.projects ? entry.projects : [];
    if (!Array.isArray(projects)) continue;
    for (const p of projects) {
      const key = normalizeKey(p);
      const existing = map.get(key);
      if (existing) {
        if (!existing.repos.find((r) => r.owner === owner && r.name === name)) {
          existing.repos.push({ owner, name });
        }
      } else {
        map.set(key, { id: p.id, title: p.title, shortDescription: p.shortDescription, url: p.url, repos: [{ owner, name }] });
      }
    }
  }
  return Array.from(map.values());
}

export default uniqueProjectsFromResults;
