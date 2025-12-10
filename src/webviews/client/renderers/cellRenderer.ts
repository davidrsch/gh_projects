import {
  CellRendererStrategy,
  TitleRenderer,
  TextRenderer,
  NumberRenderer,
  DateRenderer,
  SingleSelectRenderer,
  IterationRenderer,
  RepositoryRenderer,
  LabelsRenderer,
  PullRequestRenderer,
  IssueRenderer,
  AssigneesRenderer,
  RequestedReviewersRenderer,
  MilestoneRenderer,
  SubIssuesProgressRenderer,
  ParentIssueRenderer,
} from "./strategies";

const strategies: Record<string, CellRendererStrategy> = {
  title: new TitleRenderer(),
  text: new TextRenderer(),
  number: new NumberRenderer(),
  date: new DateRenderer(),
  single_select: new SingleSelectRenderer(),
  iteration: new IterationRenderer(),
  repository: new RepositoryRenderer(),
  labels: new LabelsRenderer(),
  pull_request: new PullRequestRenderer(),
  issue: new IssueRenderer(),
  assignees: new AssigneesRenderer(),
  reviewers: new RequestedReviewersRenderer(),
  milestone: new MilestoneRenderer(),
  sub_issues_progress: new SubIssuesProgressRenderer(),
  parent_issue: new ParentIssueRenderer(),
  linked_pull_requests: new PullRequestRenderer(),
  tracks: new IssueRenderer(),
};

export function renderCell(e: any, n: any, s: any, allItems: any) {
  if (!e) return "";
  try {
    const strategy = strategies[e.type];
    if (strategy) {
      return strategy.render(e, n, s, allItems);
    }
    return "";
  } catch (err) {
    console.error("Error rendering cell", err);
    return "";
  }
}
