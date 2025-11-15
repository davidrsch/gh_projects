import {
  NormalizedValue,
  FieldConfig,
  PRSummary,
  IssueSummary,
  Label,
  UserSummary,
  ProjectV2ItemNode,
  PRNode,
  IssueNode,
  LabelNode,
} from "../types";

function parseByTypename(node: ProjectV2ItemNode): NormalizedValue {
  const t: string = node.__typename || "";

  switch (t) {
    case "ProjectV2ItemFieldTextValue":
      return { type: "text", fieldId: node.field?.id, text: node.text ?? null };
    case "ProjectV2ItemFieldDateValue":
      return { type: "date", fieldId: node.field?.id, date: node.date ?? null };
    case "ProjectV2ItemFieldNumberValue":
      return {
        type: "number",
        fieldId: node.field?.id,
        number:
          typeof node.number === "number"
            ? node.number
            : node.number
              ? Number(node.number)
              : null,
      };
    case "ProjectV2ItemFieldSingleSelectValue": {
      const opt: Label | undefined = node
        ? {
            id: (node as any).optionId ?? (node as any).id,
            name: (node as any).name ?? undefined,
            color: ((node as any).color as string) ?? undefined,
            description: ((node as any).description as string) ?? undefined,
          }
        : undefined;
      return { type: "single_select", fieldId: node.field?.id, option: opt };
    }
    case "ProjectV2ItemFieldRepositoryValue":
      return {
        type: "repository",
        fieldId: node.field?.id,
        repository: node.repository
          ? {
              nameWithOwner:
                node.repository.nameWithOwner ?? node.repository.name,
              url: node.repository.url,
            }
          : undefined,
      };
    case "ProjectV2ItemFieldPullRequestValue": {
      const prs: PRSummary[] = (node.pullRequests?.nodes || []).map(
        (p: PRNode) => ({
          id: p.id,
          number: p.number,
          title: p.title,
          url: p.url,
          state: p.state,
          merged: p.merged,
          mergedAt: p.mergedAt,
          repository: p.repository?.nameWithOwner
            ? { nameWithOwner: p.repository.nameWithOwner }
            : undefined,
          author: p.author
            ? {
                login: p.author.login,
                avatarUrl: p.author.avatarUrl,
                url: p.author.url,
              }
            : undefined,
          labels: (p.labels?.nodes || []).map((l: LabelNode) => ({
            id: l.id,
            name: l.name,
            color: l.color,
          })),
        }),
      );
      return {
        type: "pull_request",
        fieldId: node.field?.id,
        pullRequests: prs,
      };
    }
    case "ProjectV2ItemFieldLabelValue":
      return {
        type: "labels",
        fieldId: node.field?.id,
        labels: (node.labels?.nodes || []).map((l: LabelNode) => ({
          id: l.id,
          name: l.name,
          color: l.color,
        })),
      };
    case "ProjectV2ItemFieldIssueValue": {
      const issues: IssueSummary[] = (node.issues?.nodes || []).map(
        (iss: IssueNode) => ({
          id: iss.id,
          number: iss.number,
          title: iss.title,
          url: iss.url,
          state: iss.state,
          repository: iss.repository?.nameWithOwner
            ? { nameWithOwner: iss.repository.nameWithOwner }
            : undefined,
          author: iss.author
            ? {
                login: iss.author.login,
                avatarUrl: iss.author.avatarUrl,
                url: iss.author.url,
              }
            : undefined,
          labels: (iss.labels?.nodes || []).map((l: LabelNode) => ({
            id: l.id,
            name: l.name,
            color: l.color,
          })),
          parent: iss.parent
            ? iss.parent.id
              ? {
                  id: iss.parent.id,
                  number: iss.parent.number,
                  url: iss.parent.url,
                  title: iss.parent.title,
                  repository: iss.parent.repository?.nameWithOwner
                    ? { nameWithOwner: iss.parent.repository.nameWithOwner }
                    : undefined,
                }
              : iss.parent
            : undefined,
          subIssuesSummary: iss.subIssuesSummary
            ? {
                total: iss.subIssuesSummary.total,
                percentCompleted: iss.subIssuesSummary.percentCompleted,
                completed: iss.subIssuesSummary.completed,
              }
            : undefined,
        }),
      );
      const extraIssues: IssueSummary[] = (node as any).issue
        ? [
            {
              id: (node as any).issue.id,
              number: (node as any).issue.number,
              title: (node as any).issue.title,
              url: (node as any).issue.url,
              state: (node as any).issue.state,
              repository: (node as any).issue.repository?.nameWithOwner
                ? {
                    nameWithOwner: (node as any).issue.repository.nameWithOwner,
                  }
                : undefined,
              author: (node as any).issue.author
                ? {
                    login: (node as any).issue.author.login,
                    avatarUrl: (node as any).issue.author.avatarUrl,
                    url: (node as any).issue.author.url,
                  }
                : undefined,
              labels: ((node as any).issue.labels?.nodes || []).map(
                (l: LabelNode) => ({ id: l.id, name: l.name, color: l.color }),
              ),
            },
          ]
        : [];
      return {
        type: "issue",
        fieldId: node.field?.id,
        issues: issues.concat(extraIssues),
      };
    }
    case "ProjectV2ItemFieldReviewerValue":
      return {
        type: "requested_reviewers",
        fieldId: node.field?.id,
        reviewers: (node.reviewers?.nodes || []).map((r: any) => {
          const kind = r.__typename || "Unknown";
          if (kind === "User" || kind === "Mannequin")
            return { kind, id: r.id, login: r.login };
          if (kind === "Team") return { kind, id: r.id, name: r.name };
          return { kind, raw: r };
        }),
      };
    case "ProjectV2ItemFieldUserValue":
      return {
        type: "assignees",
        fieldId: node.field?.id,
        assignees:
          (node.users?.nodes || []).map((u: any) => ({
            id: u.id,
            login: u.login,
            avatarUrl: u.avatarUrl,
            url: u.url,
          })) || [],
      };
    case "ProjectV2ItemFieldIterationValue":
      return {
        type: "iteration",
        fieldId: node.field?.id,
        iterationId: node.iterationId ?? node.id,
        title: node.title ?? null,
        startDate: node.startDate ?? null,
      };
    case "ProjectV2ItemFieldMilestoneValue":
      return {
        type: "milestone",
        fieldId: node.field?.id,
        milestone: node.milestone ?? null,
      };
    case "ProjectV2ItemFieldProgressValue":
      return {
        type: "sub_issues_progress",
        fieldId: node.field?.id,
        total: node.totalCount ?? null,
        done: node.completedCount ?? null,
        percent: node.percentage ?? null,
      };
    default:
      return { type: "unknown", raw: node };
  }
}

export function parseFieldValue(
  node: ProjectV2ItemNode | any,
): NormalizedValue {
  const field: FieldConfig | undefined = node.field as FieldConfig | undefined;

  // Special handling for Title: include both the normalized form and raw/content
  if (
    field &&
    (field.dataType === "TITLE" ||
      (field.name && (field.name as string).toLowerCase() === "title"))
  ) {
    const out: any = {
      type: "title",
      fieldId: field.id,
      title: { raw: node, content: (node as any).itemContent ?? null },
    };
    out.raw = node;
    out.content = (node as any).itemContent ?? null;
    return out as any;
  }

  const parsed = parseByTypename(node) as any;
  try {
    if (parsed && typeof parsed === "object" && !parsed.raw) parsed.raw = node;
    if (parsed && typeof parsed === "object" && parsed.content === undefined)
      parsed.content = (node as any).itemContent ?? null;
  } catch {
    // ignore attachment errors
  }
  return parsed;
}
