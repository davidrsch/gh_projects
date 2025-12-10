import type { ParsedRepoEntry } from "./types";

type ProjectNode = {
  id?: string;
  title?: string;
  shortDescription?: string;
  url?: string;
};

export function normalizeKey(p: ProjectNode) {
  if (p.id) return `id:${p.id}`;
  if (p.url) return `url:${p.url}`;
  if (p.title) return `title:${p.title}`;
  return JSON.stringify(p);
}

export interface UniqueProject {
  id?: string;
  title?: string;
  shortDescription?: string;
  url?: string;
  repos: { owner?: string; name?: string }[];
}

export function uniqueProjectsFromResults(
  parsed: ParsedRepoEntry[],
): UniqueProject[] {
  const map = new Map<string, UniqueProject>();
  for (const entry of parsed || []) {
    const owner = entry && entry.owner;
    const name = entry && entry.name;
    const projects =
      entry && (entry.projects as ProjectNode[])
        ? (entry.projects as ProjectNode[])
        : [];
    if (!Array.isArray(projects)) continue;
    for (const p of projects) {
      const key = normalizeKey(p);
      const existing = map.get(key);
      if (existing) {
        if (!existing.repos.find((r) => r.owner === owner && r.name === name)) {
          existing.repos.push({ owner, name });
        }
      } else {
        map.set(key, {
          id: p.id,
          title: p.title,
          shortDescription: p.shortDescription,
          url: p.url,
          repos: [{ owner, name }],
        });
      }
    }
  }
  return Array.from(map.values());
}

export function parseOwnerRepoFromUrl(
  url: string,
): { owner: string; name: string } | null {
  if (!url) return null;
  const s = url.trim();
  const m = s.match(
    /(?:[:\/])([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/,
  );
  if (m) {
    return { owner: m[1], name: m[2].replace(/\.git$/, "") };
  }
  return null;
}
