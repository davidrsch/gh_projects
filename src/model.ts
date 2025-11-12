export interface ProjectNode {
  id: string;
  title: string;
  url: string;
  repoPath: string;
  owner: string;
  repo: string;
  // Optional metadata for richer UI
  number?: number;
  public?: boolean;
  ownerLogin?: string;
  repoCount?: number;
  views?: Array<{
    id: string;
    name: string;
    number: number;
  }>;
}
