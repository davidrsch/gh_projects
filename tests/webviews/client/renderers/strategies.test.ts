/**
 * Tests for metadata field renderer strategies
 */

import {
  TitleRenderer,
  RepositoryRenderer,
  PullRequestRenderer,
  IssueRenderer,
  SubIssuesProgressRenderer,
  ParentIssueRenderer,
} from "../../../../src/webviews/client/renderers/strategies";

describe("Metadata Field Renderers", () => {
  describe("TitleRenderer", () => {
    it("should render with tooltip containing title and number", () => {
      const renderer = new TitleRenderer();
      const value = {
        title: {
          content: {
            title: "Test Issue",
            number: 123,
            url: "https://github.com/owner/repo/issues/123",
          },
        },
      };
      const result = renderer.render(value, {}, { content: value.title.content }, []);
      
      expect(result).toContain('href="https://github.com/owner/repo/issues/123"');
      expect(result).toContain('title="Test Issue #123"');
      expect(result).toContain('target="_blank"');
    });

    it("should render without number in tooltip if not available", () => {
      const renderer = new TitleRenderer();
      const value = {
        title: {
          content: {
            title: "Test Issue",
            url: "https://github.com/owner/repo/issues/123",
          },
        },
      };
      const result = renderer.render(value, {}, {}, []);
      
      expect(result).toContain('title="Test Issue"');
    });
  });

  describe("RepositoryRenderer", () => {
    it("should render clickable repository with data-gh-open", () => {
      const renderer = new RepositoryRenderer();
      const value = {
        repository: {
          nameWithOwner: "owner/repo",
          url: "https://github.com/owner/repo",
        },
      };
      const result = renderer.render(value);
      
      expect(result).toContain('data-gh-open="https://github.com/owner/repo"');
      expect(result).toContain('cursor:pointer');
      expect(result).toContain('owner/repo');
    });

    it("should render with constructed URL from nameWithOwner", () => {
      const renderer = new RepositoryRenderer();
      const value = {
        repository: {
          nameWithOwner: "owner/repo",
        },
      };
      const result = renderer.render(value);
      
      expect(result).toContain('data-gh-open="https://github.com/owner/repo"');
    });

    it("should render without clickability if no URL available", () => {
      const renderer = new RepositoryRenderer();
      const value = {
        repository: {
          name: "repo",
        },
      };
      const result = renderer.render(value);
      
      expect(result).not.toContain('data-gh-open');
      expect(result).not.toContain('cursor:pointer');
    });
  });

  describe("PullRequestRenderer", () => {
    it("should render with tooltip containing number and title", () => {
      const renderer = new PullRequestRenderer();
      const value = {
        pullRequests: [
          {
            number: 42,
            title: "Fix bug",
            url: "https://github.com/owner/repo/pull/42",
            state: "OPEN",
          },
        ],
      };
      const result = renderer.render(value);
      
      expect(result).toContain('href=\'https://github.com/owner/repo/pull/42\'');
      expect(result).toContain('title=\'#42 Fix bug\'');
      expect(result).toContain('target=\'_blank\'');
    });
  });

  describe("IssueRenderer", () => {
    it("should render with tooltip and ellipsis styling", () => {
      const renderer = new IssueRenderer();
      const value = {
        issues: [
          {
            number: 100,
            title: "Long issue title that should be truncated",
            url: "https://github.com/owner/repo/issues/100",
          },
        ],
      };
      const result = renderer.render(value);
      
      expect(result).toContain('href=\'https://github.com/owner/repo/issues/100\'');
      expect(result).toContain('title=\'#100 Long issue title that should be truncated\'');
      expect(result).toContain('overflow:hidden');
      expect(result).toContain('text-overflow:ellipsis');
    });
  });

  describe("SubIssuesProgressRenderer", () => {
    it("should render with detailed tooltip", () => {
      const renderer = new SubIssuesProgressRenderer();
      const value = {
        total: 10,
        done: 7,
      };
      const result = renderer.render(value);
      
      expect(result).toContain('title=\'7 of 10 sub-issues complete (70%)\'');
      expect(result).toContain('7/10');
      expect(result).toContain('70%');
    });

    it("should not render if total is 0", () => {
      const renderer = new SubIssuesProgressRenderer();
      const value = {
        total: 0,
        done: 0,
      };
      const result = renderer.render(value);
      
      expect(result).toBe("");
    });
  });

  describe("ParentIssueRenderer", () => {
    it("should render with data-gh-open for clickability", () => {
      const renderer = new ParentIssueRenderer();
      const value = {
        parent: {
          number: 50,
          title: "Parent Issue",
          url: "https://github.com/owner/repo/issues/50",
        },
      };
      const result = renderer.render(value, {}, {}, []);
      
      expect(result).toContain('data-gh-open=\'https://github.com/owner/repo/issues/50\'');
      expect(result).toContain('cursor:pointer');
    });

    it("should not be clickable if no URL", () => {
      const renderer = new ParentIssueRenderer();
      const value = {
        parent: {
          number: 50,
          title: "Parent Issue",
        },
      };
      const result = renderer.render(value, {}, {}, []);
      
      // Should not have data-gh-open attribute when no URL
      expect(result).not.toContain('data-gh-open');
      // Should not have parent-issue-wrapper class
      expect(result).not.toContain('parent-issue-wrapper');
      // Should still display the title and number
      expect(result).toContain('Parent Issue');
      expect(result).toContain('#50');
    });
  });
});
