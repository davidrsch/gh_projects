/**
 * @jest-environment jsdom
 */
import {
  TitleRenderer,
  IssueRenderer,
  AssigneesRenderer,
  RequestedReviewersRenderer,
} from "../../../../src/webviews/client/renderers/strategies";

describe("TitleRenderer link behavior", () => {
  test("renders anchor with issue URL", () => {
    const renderer = new TitleRenderer();

    const value: any = {
      title: {
        content: {
          title: "Sample issue",
          number: 123,
          url: "https://github.com/org/repo/issues/123",
        },
      },
    };

    const html = renderer.render(value as any, {} as any, {} as any, [] as any);
    expect(html).toContain(
      "href=\"https://github.com/org/repo/issues/123\"",
    );
  });
});

describe("IssueRenderer link behavior", () => {
  test("renders anchor for each issue", () => {
    const renderer = new IssueRenderer();
    const value: any = {
      issues: [
        {
          number: 42,
          title: "Example",
          url: "https://github.com/org/repo/issues/42",
        },
      ],
    };

    const html = renderer.render(value as any);
    expect(html).toContain(
      "href='https://github.com/org/repo/issues/42'",
    );
  });
});

describe("AssigneesRenderer profile links", () => {
  test("renders data-gh-open profile URLs for assignees", () => {
    const renderer = new AssigneesRenderer();
    const value: any = {
      assignees: [
        {
          login: "user1",
          name: "User One",
          avatarUrl: "https://avatars.githubusercontent.com/u/1",
        },
        {
          login: "user2",
          name: "User Two",
        },
      ],
    };

    const html = renderer.render(value as any);

    // First assignee avatar
    expect(html).toContain("data-gh-open='https://github.com/user1'");
    // Summary text uses primary profile target
    expect(html).toContain("https://github.com/user1");
  });
});

describe("RequestedReviewersRenderer profile links", () => {
  test("renders reviewer names as clickable GitHub profile links", () => {
    const renderer = new RequestedReviewersRenderer();
    const value: any = {
      reviewers: [
        { login: "reviewer1" },
        { login: "reviewer2" },
      ],
    };

    const html = renderer.render(value as any);
    expect(html).toContain(
      "href='https://github.com/reviewer1'",
    );
    expect(html).toContain(
      "href='https://github.com/reviewer2'",
    );
  });
});
