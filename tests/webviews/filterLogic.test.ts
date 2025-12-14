
import { computeMatches } from "../../src/webviews/client/filterLogic";

describe("filterLogic", () => {
    const items = [
        {
            id: "1",
            content: { title: "Fix bug", state: "OPEN" },
            fieldValues: [
                { type: "text", text: "High priority" },
                { type: "number", number: 5 },
                { type: "single_select", option: { name: "Bug" } }
            ]
        },
        {
            id: "2",
            content: { title: "Add feature", state: "CLOSED" },
            fieldValues: [
                { type: "text", text: "Low priority" },
                { type: "number", number: 10 },
                { type: "single_select", option: { name: "Feature" } }
            ]
        }
    ];

    const fields = [
        { name: "Priority", type: "text" }, // index 0
        { name: "Estimate", type: "number" }, // index 1
        { name: "Type", type: "single_select" } // index 2
    ];

    test("should return all items when filter is empty", () => {
        const result = computeMatches("", items, fields);
        expect(result).toHaveLength(2);
        expect(result).toContain("1");
        expect(result).toContain("2");
    });

    test("should filter by text", () => {
        const result = computeMatches("Fix", items, fields);
        expect(result).toHaveLength(1);
        expect(result).toContain("1");
    });

    test("should filter by qualifier is:open", () => {
        const result = computeMatches("is:open", items, fields);
        expect(result).toHaveLength(1);
        expect(result).toContain("1");
    });

    test("should filter by field value", () => {
        const result = computeMatches("Type:Bug", items, fields);
        expect(result).toHaveLength(1);
        expect(result).toContain("1");
    });

    test("should filter by numeric comparison", () => {
        const result = computeMatches("Estimate:>5", items, fields);
        expect(result).toHaveLength(1);
        expect(result).toContain("2");
    });

    test("should support negation", () => {
        const result = computeMatches("-is:open", items, fields);
        expect(result).toHaveLength(1);
        expect(result).toContain("2");
    });

    test("should filter by parent title", () => {
        const itemWithParent = {
            id: "3",
            content: { title: "Subtask" },
            fieldValues: [
                { type: "parent_issue", parent: { title: "Big Feature" } }
            ]
        };
        const allItems = [...items, itemWithParent];

        const result = computeMatches("parent:Big", allItems, fields);
        expect(result).toHaveLength(1);
        expect(result).toContain("3");
    });

    // BUG REPRO: Parent exclusion
    test("should NOT match the parent item itself when filtering by parent", () => {
        const parentItem = {
            id: "p1",
            content: { title: "Big Feature" },
            fieldValues: []
        };
        const childItem = {
            id: "c1",
            content: { title: "Child Task" },
            fieldValues: [
                { type: "parent_issue", parent: { title: "Big Feature" } }
            ]
        };
        const allItems = [parentItem, childItem];

        // Filter "parent:Big Feature" should match c1 (has parent) but NOT p1 (is the parent)
        const result = computeMatches('parent:"Big Feature"', allItems, []);
        expect(result).toContain("c1");
        expect(result).not.toContain("p1"); // Currently likely matches p1 due to text fallback
    });

    // BUG REPRO: Milestone filtering
    test("should filter by milestone", () => {
        const itemWithMilestone = {
            id: "m1",
            fieldValues: [
                { type: "milestone", milestone: { title: "v1.0" } }
            ]
        };
        const itemNoMilestone = { id: "m2", fieldValues: [] };
        const allItems = [itemWithMilestone, itemNoMilestone];
        const localFields = [{ name: "Milestone", type: "milestone" }]; // matches case in code

        const result = computeMatches("Milestone:v1.0", allItems, localFields);
        expect(result).toContain("m1");
        expect(result).not.toContain("m2");
    });
    test("should use exact match for text fields", () => {
        const item1 = { id: "1", fieldValues: [{ type: "text", text: "Future" }] };
        // "Near Future" contains "Future", but should not match in exact mode
        const item2 = { id: "2", fieldValues: [{ type: "text", text: "Near Future" }] };
        const allItems = [item1, item2];
        const localFields = [{ name: "Status", type: "text" }];

        const res1 = computeMatches("Status:Future", allItems, localFields);
        expect(res1).toContain("1");
        expect(res1).not.toContain("2");
    });

    test("should use exact match for single_select", () => {
        const item1 = { id: "1", fieldValues: [{ type: "single_select", option: { name: "Bug" } }] };
        const item2 = { id: "2", fieldValues: [{ type: "single_select", option: { name: "LadyBug" } }] };
        const allItems = [item1, item2];
        const localFields = [{ name: "Type", type: "single_select" }];

        const res1 = computeMatches("Type:Bug", allItems, localFields);
        expect(res1).toContain("1");
        expect(res1).not.toContain("2");
    });
    test("should use exact match for date fields (normalized)", () => {
        // Item has full ISO date
        const item1 = { id: "1", fieldValues: [{ type: "date", date: "2023-11-15T12:00:00Z" }] };
        const item2 = { id: "2", fieldValues: [{ type: "date", date: "2023-11-16T12:00:00Z" }] };
        const allItems = [item1, item2];
        const localFields = [{ name: "Start Date", type: "date" }];

        // Filter uses YYYY-MM-DD (format sent by pill)
        const res1 = computeMatches('"Start Date":2023-11-15', allItems, localFields);
        expect(res1).toContain("1");
        expect(res1).not.toContain("2");
    });

    test("should filter by assignee", () => {
        const item1 = {
            id: "1",
            content: {
                assignees: { nodes: [{ login: "octocat" }] }
            },
            fieldValues: [{ type: "assignees", assignees: [{ login: "octocat" }] }]
        };
        const item2 = {
            id: "2",
            content: {
                assignees: { nodes: [{ login: "monalisa" }] }
            },
            fieldValues: [{ type: "assignees", assignees: [{ login: "monalisa" }] }]
        };
        const allItems = [item1, item2];
        const localFields = [{ name: "Assignees", type: "assignees" }];

        const res1 = computeMatches("Assignees:octocat", allItems, localFields);
        expect(res1).toContain("1");
        expect(res1).not.toContain("2");

        const res2 = computeMatches("assignee:monalisa", allItems, localFields);
        expect(res2).toContain("2");
        expect(res2).not.toContain("1");
    });
});
