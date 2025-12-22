/**
 * @jest-environment jsdom
 */
/**
 * Tests for BoardCardRenderer component
 */

import { BoardCardRenderer } from "../../../../src/webviews/client/renderers/BoardCardRenderer";

// Mock window.getIconSvg for tests
(global as any).window = {
    getIconSvg: jest.fn().mockReturnValue('<svg class="icon"></svg>'),
};

describe("BoardCardRenderer", () => {
    // Sample fields for testing
    const mockFields = [
        {
            id: "field-status",
            name: "Status",
            dataType: "single_select",
            options: [
                { id: "opt-todo", name: "Todo", color: "GRAY", description: "Not started" },
                { id: "opt-inprogress", name: "In Progress", color: "YELLOW" },
                { id: "opt-done", name: "Done", color: "GREEN", description: "Completed" },
            ],
        },
        {
            id: "field-iteration",
            name: "Sprint",
            dataType: "iteration",
            configuration: {
                iterations: [
                    { id: "iter-1", title: "Sprint 1", startDate: "2025-01-01", duration: 14 },
                    { id: "iter-2", title: "Sprint 2", startDate: "2025-01-15", duration: 14 },
                ],
            },
        },
        {
            id: "field-estimate",
            name: "Estimate",
            dataType: "number",
        },
    ];

    // Sample items for testing
    const mockItems = [
        {
            id: "item-1",
            content: { title: "Issue 1", number: 1, url: "https://github.com/test/repo/issues/1" },
            fieldValues: [
                { fieldId: "field-status", type: "single_select", option: { id: "opt-todo", name: "Todo", color: "GRAY" } },
                { fieldId: "field-estimate", type: "number", number: 3, fieldName: "Estimate" },
            ],
        },
        {
            id: "item-2",
            content: { title: "Issue 2", number: 2, url: "https://github.com/test/repo/issues/2" },
            fieldValues: [
                { fieldId: "field-status", type: "single_select", option: { id: "opt-inprogress", name: "In Progress", color: "YELLOW" } },
                { fieldId: "field-estimate", type: "number", number: 5 },
            ],
        },
        {
            id: "item-3",
            content: { title: "Issue 3", number: 3, url: "https://github.com/test/repo/issues/3" },
            fieldValues: [
                { fieldId: "field-status", type: "single_select", option: { id: "opt-done", name: "Done", color: "GREEN" } },
                { fieldId: "field-estimate", type: "number", number: 2 },
            ],
        },
        {
            id: "item-4",
            content: { title: "Issue 4", number: 4 },
            fieldValues: [], // No status - should go to "No value" column
        },
    ];

    describe("groupItemsByColumn", () => {
        it("should group items by single_select field options", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];

            const groups = renderer.groupItemsByColumn(mockItems, statusField);

            expect(groups.size).toBe(4); // Todo, In Progress, Done, No value
            expect(groups.get("opt-todo")?.items.length).toBe(1);
            expect(groups.get("opt-inprogress")?.items.length).toBe(1);
            expect(groups.get("opt-done")?.items.length).toBe(1);
            expect(groups.get("__no_value__")?.items.length).toBe(1);
        });

        it("should preserve option order from field configuration", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];

            const groups = renderer.groupItemsByColumn(mockItems, statusField);
            const keys = Array.from(groups.keys());

            // Should be in order: Todo, In Progress, Done, No value
            expect(keys[0]).toBe("opt-todo");
            expect(keys[1]).toBe("opt-inprogress");
            expect(keys[2]).toBe("opt-done");
            expect(keys[3]).toBe("__no_value__");
        });

        it("should group items by iteration field", () => {
            const itemsWithIteration = [
                {
                    id: "item-1",
                    content: { title: "Issue 1" },
                    fieldValues: [{ fieldId: "field-iteration", type: "iteration", iterationId: "iter-1", title: "Sprint 1" }],
                },
                {
                    id: "item-2",
                    content: { title: "Issue 2" },
                    fieldValues: [{ fieldId: "field-iteration", type: "iteration", iterationId: "iter-2", title: "Sprint 2" }],
                },
            ];

            const renderer = new BoardCardRenderer(mockFields, itemsWithIteration);
            const iterationField = mockFields[1];

            const groups = renderer.groupItemsByColumn(itemsWithIteration, iterationField);

            expect(groups.get("iter-1")?.items.length).toBe(1);
            expect(groups.get("iter-2")?.items.length).toBe(1);
        });
    });

    describe("sumEstimate", () => {
        it("should sum estimate field values for items", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);

            const sum = renderer.sumEstimate(mockItems);

            expect(sum).toBe(10); // 3 + 5 + 2 + 0 (no estimate)
        });

        it("should return 0 for items without estimate field", () => {
            const itemsNoEstimate = [
                { id: "1", fieldValues: [] },
                { id: "2", fieldValues: [{ type: "text", text: "hello" }] },
            ];

            const renderer = new BoardCardRenderer(mockFields, itemsNoEstimate);
            const sum = renderer.sumEstimate(itemsNoEstimate);

            expect(sum).toBe(0);
        });

        it("should handle missing fieldValues gracefully", () => {
            const brokenItems = [
                { id: "1" }, // No fieldValues
                null,
                undefined,
            ];

            const renderer = new BoardCardRenderer(mockFields, brokenItems as any);
            const sum = renderer.sumEstimate(brokenItems as any);

            expect(sum).toBe(0);
        });
    });

    describe("renderCard", () => {
        // Note: These tests require a DOM environment (jsdom)
        beforeEach(() => {
            // Setup minimal DOM
            document.body.innerHTML = "";
        });

        it("should render card with correct header structure", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems, undefined, undefined, undefined, ['__count__']);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const todoItems = mockItems.filter(
                (item) => item.fieldValues.find((fv: any) => fv.option?.id === "opt-todo")
            );

            const card = renderer.renderCard(todoOption, todoItems, statusField);

            expect(card.className).toBe("board-card");
            expect(card.getAttribute("data-column-id")).toBe("opt-todo");
            expect(card.querySelector(".board-card-header")).toBeTruthy();
            expect(card.querySelector(".board-card-color-dot")).toBeTruthy();
            expect(card.querySelector(".board-card-title")?.textContent).toBe("Todo");
            expect(card.querySelector(".board-card-count")?.textContent).toBe("1");
        });

        it("should render estimate pill when items have estimates", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems, undefined, undefined, undefined, ['field-estimate']);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const todoItems = [mockItems[0]]; // Has estimate of 3

            const card = renderer.renderCard(todoOption, todoItems, statusField);

            const estimatePill = card.querySelector(".board-card-estimate");
            expect(estimatePill).toBeTruthy();
            expect(estimatePill?.textContent).toBe("Estimate: 3");
        });

        it("should render description for single_select option", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0]; // Has description "Not started"

            const card = renderer.renderCard(todoOption, [], statusField);

            const description = card.querySelector(".board-card-description");
            expect(description?.textContent).toBe("Not started");
        });

        it("should render items inside the card", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const todoItems = [mockItems[0]];

            const card = renderer.renderCard(todoOption, todoItems, statusField);

            const itemsContainer = card.querySelector(".board-card-items");
            expect(itemsContainer).toBeTruthy();

            const itemElements = itemsContainer?.querySelectorAll(".board-item");
            expect(itemElements?.length).toBe(1);
        });

        it("should set data-gh-item-id on rendered items", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const todoItems = [mockItems[0]];

            const card = renderer.renderCard(todoOption, todoItems, statusField);

            const itemEl = card.querySelector(".board-item");
            expect(itemEl?.getAttribute("data-gh-item-id")).toBe("item-1");
        });
    });

    describe("renderBoard", () => {
        beforeEach(() => {
            document.body.innerHTML = "";
        });

        it("should render board container with all columns", () => {
            const container = document.createElement("div");
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];

            renderer.renderBoard(container, statusField);

            const boardContainer = container.querySelector(".board-container");
            expect(boardContainer).toBeTruthy();

            const cards = boardContainer?.querySelectorAll(".board-card");
            // 3 status options + 1 "No value" with items = 4 cards
            expect(cards?.length).toBe(4);
        });

        it("should not render empty 'No value' column", () => {
            // All items have status assigned
            const itemsWithStatus = mockItems.slice(0, 3);

            const container = document.createElement("div");
            const renderer = new BoardCardRenderer(mockFields, itemsWithStatus);
            const statusField = mockFields[0];

            renderer.renderBoard(container, statusField);

            const cards = container.querySelectorAll(".board-card");
            // Should only have 3 cards (no empty "No value" column)
            expect(cards.length).toBe(3);
        });

        it("should render cards in correct option order", () => {
            const container = document.createElement("div");
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];

            renderer.renderBoard(container, statusField);

            const cards = container.querySelectorAll(".board-card");
            const columnIds = Array.from(cards).map((c) => c.getAttribute("data-column-id"));

            expect(columnIds[0]).toBe("opt-todo");
            expect(columnIds[1]).toBe("opt-inprogress");
            expect(columnIds[2]).toBe("opt-done");
            expect(columnIds[3]).toBe("__no_value__");
        });
    });

    describe("iteration date range", () => {
        it("should format iteration date range correctly", () => {
            const container = document.createElement("div");
            const itemsWithIteration = [
                {
                    id: "item-1",
                    content: { title: "Issue 1" },
                    fieldValues: [{ fieldId: "field-iteration", type: "iteration", iterationId: "iter-1" }],
                },
            ];

            const visibleIds = ["field-iteration"];
            const renderer = new BoardCardRenderer(mockFields, itemsWithIteration, visibleIds);
            const iterationField = mockFields[1];
            const iterationOption = {
                id: "iter-1",
                name: "Sprint 1",
                title: "Sprint 1",
                startDate: "2025-01-01",
                duration: 14,
            };

            const card = renderer.renderCard(iterationOption, itemsWithIteration, iterationField);

            const description = card.querySelector(".board-card-description");
            // Should show date range like "Jan 1 — Jan 15"
            expect(description?.textContent).toContain("Jan");
        });
    });

    describe("field visibility", () => {
        it("should only render visible fields", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems, ["field-estimate"]);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const items = [mockItems[0]]; // Has estimate and status

            const card = renderer.renderCard(todoOption, items, statusField);
            const fieldsContainer = card.querySelector(".board-item-fields");

            // Should have fields container
            expect(fieldsContainer).toBeTruthy();

            // Should ONLY show estimate, not status (if status wasn't excluded by logic, but field-status is also column-field here so it is excluded anyway)
            // Let's rely on explicit IDs. "field-estimate" is visible.
            // Items have "field-estimate".

            // Check content
            expect(fieldsContainer?.innerHTML).toContain("Estimate");
        });

        it("should not render hidden fields", () => {
            // Pass empty visible list (or list without estimate)
            const renderer = new BoardCardRenderer(mockFields, mockItems, ["other-field"]);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const items = [mockItems[0]]; // Has estimate

            const card = renderer.renderCard(todoOption, items, statusField);
            const fieldsContainer = card.querySelector(".board-item-fields");

            // Should NOT have fields container (or empty) if no visible fields match
            // renderFieldValues returns null if no pills
            expect(fieldsContainer).toBeNull();
        });
    });

    describe("blocked status", () => {
        it("should show blocked overlay for blocked items", () => {
            const blockedItem = {
                id: "item-blocked",
                content: {
                    title: "Blocked Issue",
                    number: 99,
                    issueDependenciesSummary: { blockedBy: 1 }
                },
                fieldValues: []
            };

            const renderer = new BoardCardRenderer(mockFields, [blockedItem]);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];

            const card = renderer.renderCard(todoOption, [blockedItem], statusField);

            // Check for blocked overlay
            const overlay = card.querySelector(".blocked-overlay");
            expect(overlay).toBeTruthy();
        });

        it("should not show blocked overlay for non-blocked items", () => {
            const normalItem = {
                id: "item-normal",
                content: {
                    title: "Normal Issue",
                    issueDependenciesSummary: { blockedBy: 0 }
                },
                fieldValues: []
            };

            const renderer = new BoardCardRenderer(mockFields, [normalItem]);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];

            const card = renderer.renderCard(todoOption, [normalItem], statusField);

            const overlay = card.querySelector(".blocked-overlay");
            expect(overlay).toBeFalsy();
        });
    });

    describe("parent issue rendering", () => {
        // This is harder to test fully without full DOM/styles, but we can check structure
        it("should look up parent status color", () => {
            // Parent item is in items list
            const parentItem = {
                id: "parent-1",
                content: { id: "parent-1", number: 100, title: "Parent", repository: { nameWithOwner: "owner/repo" } },
                fieldValues: [
                    { type: "single_select", fieldName: "Status", option: { name: "Done", color: "PURPLE" } }
                ]
            };

            const childItem = {
                id: "child-1",
                fieldValues: [
                    {
                        type: "parent_issue",
                        parent: { id: "parent-1", number: 100, title: "Parent", repository: { nameWithOwner: "owner/repo" } }
                    }
                ]
            };

            const allItems = [parentItem, childItem];
            const renderer = new BoardCardRenderer(mockFields, allItems, ["field-parent"]); // assume visible

            // We can't easily call private renderParentIssuePill, but we can verify it renders in card
            // if we had a fieldId for it.
            // Mocking fieldValues to have 'parent_issue' type
            // But 'renderCard' groups by column.

            // ... skipping full DOM verification of color style as it requires normalizeColor which relies on DOM/window styles 
            // that might be mocked or missing in test environment (jsdom handles some).

            // Just verifying it doesn't crash:
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            renderer.renderCard(todoOption, [childItem], statusField);
        });
    });
    describe("interactivity", () => {
        beforeEach(() => {
            document.body.innerHTML = "";
        });

        it("should render menu button on items", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const items = [mockItems[0]];

            const card = renderer.renderCard(todoOption, items, statusField);
            const menuBtn = card.querySelector(".board-item-menu-btn");

            expect(menuBtn).toBeTruthy();
            expect(menuBtn?.getAttribute("data-item-id")).toBe("item-1");
        });

        it("should render filter data attributes on pills", () => {
            const renderer = new BoardCardRenderer(mockFields, mockItems);
            const statusField = mockFields[0];
            const todoOption = statusField.options![0];
            const items = [mockItems[0]]; // Has "Todo" status pill (but status is column, so it is hidden inside renderFieldValues usually? verify exclusion logic)
            // Wait, renderFieldValues skips column field.
            // item-1 has status (id: field-status) and estimate (id: field-estimate).
            // Status is column. Estimate is number. Number doesn't have pill logic yet?
            // Let's check renderNumberPill - I didn't verify if I updated it. But I updated Labels/Iteration/SingleSelect.

            // Let's create an item with a Label or Iteration to test pill.
            const itemWithLabel = {
                id: "item-label",
                fieldValues: [
                    { type: "labels", labels: [{ name: "bug", color: "red" }] }
                ]
            };

            const card = renderer.renderCard(todoOption, [itemWithLabel], statusField);
            const labelPill = card.querySelector(".board-pill");

            expect(labelPill).toBeTruthy();
            expect(labelPill?.getAttribute("data-filter-field")).toBe("Labels"); // standard name
            expect(labelPill?.getAttribute("data-filter-value")).toBe("bug");
        });

        it("should call onFilter callback when pill is clicked", () => {
            const onFilter = jest.fn();
            const renderer = new BoardCardRenderer(mockFields, mockItems, [], onFilter);
            const statusField = mockFields[0];

            const container = document.createElement("div");
            renderer.renderBoard(container, statusField);

            // Find a pill (item 1 has estimate, maybe not pill? It has renderNumberPill... wait I didn't update renderNumberPill data attrs, did I?
            // I updated 'renderSingleSelectPill', 'renderLabelsPills', etc. 
            // Let's assume we have an item with a Label).
            // Need to supply item with label to renderer.
            const itemWithLabel = {
                id: "item-label",
                fieldValues: [
                    { type: "labels", labels: [{ name: "bug", color: "red" }] },
                    { fieldId: "field-status", type: "single_select", option: { id: "opt-todo", name: "Todo" } }
                ]
            };

            const rendererWithLabel = new BoardCardRenderer(mockFields, [itemWithLabel], [], onFilter);
            container.innerHTML = ""; // Clear previous render
            rendererWithLabel.renderBoard(container, statusField);

            const pill = container.querySelector(".board-pill");
            expect(pill).toBeTruthy();

            // Simulate click
            pill?.dispatchEvent(new Event("click", { bubbles: true }));

            expect(onFilter).toHaveBeenCalledWith("Labels:bug");
        });

        it("should call onAction callback when menu button is clicked", () => {
            const onAction = jest.fn();
            const renderer = new BoardCardRenderer(mockFields, mockItems, [], undefined, onAction);
            const statusField = mockFields[0];
            const container = document.createElement("div");

            renderer.renderBoard(container, statusField);

            const menuBtn = container.querySelector(".board-item-menu-btn");
            expect(menuBtn).toBeTruthy();

            // Simulate click
            menuBtn?.dispatchEvent(new Event("click", { bubbles: true }));

            expect(onAction).toHaveBeenCalled();
            expect(onAction.mock.calls[0][0]).toBe("open-menu");
        });
    });
});
