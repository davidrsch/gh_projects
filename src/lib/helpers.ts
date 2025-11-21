export function makeLimits(first: number): Record<string, number> {
  return {
    fieldsFirst: 50,
    itemsFirst: first,
    subIssuesFirst: 50,
    issuePullRequestsFirst: 5,
    labelsFirst: 10,
    usersFirst: 10,
    repoLabelsFirst: 100,
    repoMilestonesFirst: 100,
  };
}

export function buildCandidateFragments(
  LIMITS: Record<string, number>
): Array<{ typename: string; selection: string }> {
  return [
    {
      typename: "ProjectV2ItemFieldTextValue",
      selection: "... on ProjectV2ItemFieldTextValue{ text }",
    },
    {
      typename: "ProjectV2ItemFieldDateValue",
      selection: "... on ProjectV2ItemFieldDateValue{ date }",
    },
    {
      typename: "ProjectV2ItemFieldNumberValue",
      selection: "... on ProjectV2ItemFieldNumberValue{ number }",
    },
    {
      typename: "ProjectV2ItemFieldSingleSelectValue",
      selection:
        "... on ProjectV2ItemFieldSingleSelectValue{ optionId name description color }",
    },
    {
      typename: "ProjectV2ItemFieldRepositoryValue",
      selection:
        "... on ProjectV2ItemFieldRepositoryValue{ repository{ id nameWithOwner url } }",
    },
    {
      typename: "ProjectV2ItemFieldPullRequestValue",
      selection: `... on ProjectV2ItemFieldPullRequestValue{ pullRequests(first:${LIMITS.issuePullRequestsFirst}){ nodes{ id number title url state merged mergedAt repository{ nameWithOwner } author{ login avatarUrl url } labels(first:${LIMITS.labelsFirst}){ nodes{ id name color } } } } }`,
    },
    {
      typename: "ProjectV2ItemFieldLabelValue",
      selection: `... on ProjectV2ItemFieldLabelValue{ labels(first:${LIMITS.labelsFirst}){ nodes{ id name color } } }`,
    },
    {
      typename: "ProjectV2ItemFieldUserValue",
      selection: `... on ProjectV2ItemFieldUserValue{ users(first:${LIMITS.usersFirst}){ nodes{ id login avatarUrl url } } }`,
    },
    {
      typename: "ProjectV2ItemFieldIterationValue",
      selection:
        "... on ProjectV2ItemFieldIterationValue{ iterationId title startDate duration }",
    },
    {
      typename: "ProjectV2ItemFieldMilestoneValue",
      selection:
        "... on ProjectV2ItemFieldMilestoneValue{ milestone{ id title } }",
    },
    {
      typename: "ProjectV2ItemFieldProgressValue",
      selection:
        "... on ProjectV2ItemFieldProgressValue{ totalCount completedCount percentage }",
    },
    {
      typename: "ProjectV2ItemFieldIssueValue",
      selection: `... on ProjectV2ItemFieldIssueValue{
              issues(first:${LIMITS.subIssuesFirst}){ nodes{
                id
                number
                url
                title
                state
                repository{ nameWithOwner }
                author{ login url }
                parent { id number url title repository{ nameWithOwner } }
                subIssuesSummary { total percentCompleted completed }
                subIssues(first:${LIMITS.subIssuesFirst}){ nodes{ id number url title repository{ nameWithOwner } } }
                labels(first:${LIMITS.labelsFirst}){ nodes{ id name color } }
              } }
              issue { id number url title repository{ nameWithOwner } }
            }`,
    },
  ];
}

export function buildRepoSelections(
  repoNames: string[],
  LIMITS: Record<string, number>
): string {
  return repoNames
    .map((rn, idx) => {
      const [owner, name] = rn.split("/");
      return `r${idx}: repository(owner:${JSON.stringify(
        owner
      )}, name:${JSON.stringify(name)}){ labels(first:${
        LIMITS.repoLabelsFirst
      }){ nodes{ id name color description } } milestones(first:${
        LIMITS.repoMilestonesFirst
      }){ nodes{ id title description dueOn } } }`;
    })
    .join("\n    ");
}

export function buildItemsQuery(
  projectId: string,
  aliasSelections: string,
  LIMITS: Record<string, number>,
  query?: string
): string {
  const qArg =
    query && String(query).trim() ? `, query: ${JSON.stringify(query)}` : "";
  return `query{\n  node(id:${JSON.stringify(
    projectId
  )}){\n    ... on ProjectV2{\n      items(first:${
    LIMITS.itemsFirst
  }${qArg}){\n        nodes{\n          id\n          content{ __typename\n            ... on Issue{ \n              id\n              number\n              url\n              title\n              repository{ nameWithOwner }\n              parent { id number url title repository{ nameWithOwner } }\n              subIssuesSummary { total percentCompleted completed }\n              subIssues(first:${
    LIMITS.subIssuesFirst
  }){ nodes{ id number url title repository{ nameWithOwner } } }\n            }\n            ... on PullRequest{ id number url title repository{ nameWithOwner } }\n          }\n          ${aliasSelections}\n        }\n      }\n    }\n  }\n}`;
}

export function buildFieldsQuery(
  projectId: string,
  LIMITS: Record<string, number>
): string {
  return `query{\n  node(id:${JSON.stringify(
    projectId
  )}){\n    ... on ProjectV2{\n      fields(first:${
    LIMITS.fieldsFirst
  }){\n        nodes{\n          __typename\n          ... on ProjectV2Field{\n            id\n            name\n            dataType\n          }\n          ... on ProjectV2SingleSelectField{\n            id\n            name\n            dataType\n            options{ id name description color }\n          }\n          ... on ProjectV2IterationField{\n            id\n            name\n            dataType\n            configuration{ iterations{ id title startDate duration } }\n          }\n        }\n      }\n    }\n  }\n}`;
}
