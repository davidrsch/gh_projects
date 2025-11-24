
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
});
