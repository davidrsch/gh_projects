/**
 * @jest-environment jsdom
 */
import {
  getIconSvg,
  getIconNameForDataType,
  IconName,
} from "../../../../src/webviews/client/icons/iconRegistry";

describe("iconRegistry", () => {
  describe("getIconSvg", () => {
    test("returns valid SVG for table icon", () => {
      const svg = getIconSvg("table");
      expect(svg).toContain("<svg");
      expect(svg).toContain("octicon");
      expect(svg).toContain("octicon-table");
      expect(svg).toContain("viewBox");
      expect(svg).toContain("</svg>");
      expect(svg).toContain('fill="currentColor"');
      expect(svg).toContain('aria-hidden="true"');
    });

    test("returns valid SVG for people icon", () => {
      const svg = getIconSvg("people");
      expect(svg).toContain("octicon-people");
      expect(svg).toContain("<path");
    });

    test("supports custom size option", () => {
      const svg = getIconSvg("table", { size: 24 });
      expect(svg).toContain('width="24"');
      expect(svg).toContain('height="24"');
    });

    test("returns empty string for unknown icon", () => {
      const svg = getIconSvg("nonexistent" as IconName);
      expect(svg).toBe("");
    });

    test("all icon names return non-empty SVG", () => {
      const iconNames: IconName[] = [
        "table",
        "project",
        "people",
        "sort-asc",
        "rows",
        "sliceby",
      ];

      iconNames.forEach((iconName) => {
        const svg = getIconSvg(iconName);
        expect(svg).toBeTruthy();
        expect(svg).toContain("<svg");
        expect(svg).toContain("</svg>");
      });
    });
  });

  describe("getIconNameForDataType", () => {
    test("maps title to list icon", () => {
      expect(getIconNameForDataType("title")).toBe("list");
    });

    test("maps assignees to people icon", () => {
      expect(getIconNameForDataType("assignees")).toBe("people");
    });

    test("maps labels to tag icon", () => {
      expect(getIconNameForDataType("labels")).toBe("tag");
    });

    test("handles case insensitivity", () => {
      expect(getIconNameForDataType("TITLE")).toBe("list");
    });

    test("returns tag icon for unknown types", () => {
      expect(getIconNameForDataType("unknown")).toBe("tag");
    });
  });
});
