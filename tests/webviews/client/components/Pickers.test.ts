/**
 * @jest-environment jsdom
 */
import { LabelsPicker } from "../../../../src/webviews/client/components/LabelsPicker";
import { AssigneesPicker } from "../../../../src/webviews/client/components/AssigneesPicker";
import { ReviewersPicker } from "../../../../src/webviews/client/components/ReviewersPicker";
import { MilestonePicker } from "../../../../src/webviews/client/components/MilestonePicker";

// Mock window.getIconSvg and webview messaging bridge
(global as any).window = {
  getIconSvg: jest.fn().mockReturnValue("<svg></svg>"),
  __APP_MESSAGING__: {
    postMessage: jest.fn(),
  },
};

describe("LabelsPicker", () => {
  let container: HTMLElement;
  let anchorElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    anchorElement = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(anchorElement);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("renders labels picker with options", () => {
    const field = {
      id: "labels",
      name: "Labels",
      type: "labels",
      options: [
        { id: "1", name: "bug", color: "#d73a4a", description: "Bug reports" },
        {
          id: "2",
          name: "enhancement",
          color: "#a2eeef",
          description: "Feature requests",
        },
      ],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentLabels: any[] = [];

    const picker = new LabelsPicker({
      anchorElement,
      field,
      item,
      currentLabels,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    // Check that picker is rendered
    const pickerEl = document.querySelector(".field-picker");
    expect(pickerEl).toBeTruthy();

    // Check that labels are rendered
    const labelItems = document.querySelectorAll(".label-item");
    expect(labelItems.length).toBe(2);

    picker.hide();
  });

  test("handles label selection", () => {
    const field = {
      id: "labels",
      name: "Labels",
      type: "labels",
      options: [{ id: "1", name: "bug", color: "#d73a4a" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentLabels: any[] = [];
    const onUpdate = jest.fn();

    const picker = new LabelsPicker({
      anchorElement,
      field,
      item,
      currentLabels,
      onClose: jest.fn(),
      onUpdate,
      onError: jest.fn(),
    });

    picker.show();

    // Click on the first label item
    const labelItem = document.querySelector(".label-item") as HTMLElement;
    expect(labelItem).toBeTruthy();
    labelItem.click();

    // Click Apply button
    const applyButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Apply",
    );
    expect(applyButton).toBeTruthy();
    applyButton?.click();

    // Check that onUpdate was called with the selected label
    expect(onUpdate).toHaveBeenCalledWith(["1"]);
  });

  test("filters labels based on search input", () => {
    const field = {
      id: "labels",
      name: "Labels",
      type: "labels",
      options: [
        { id: "1", name: "bug", color: "#d73a4a" },
        { id: "2", name: "enhancement", color: "#a2eeef" },
        { id: "3", name: "documentation", color: "#0075ca" },
      ],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentLabels: any[] = [];

    const picker = new LabelsPicker({
      anchorElement,
      field,
      item,
      currentLabels,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    // Check initial count
    let labelItems = document.querySelectorAll(".label-item");
    expect(labelItems.length).toBe(3);

    // Enter search term
    const searchInput = document.querySelector("input") as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    searchInput.value = "bug";
    searchInput.dispatchEvent(new Event("input"));

    // Check filtered count
    labelItems = document.querySelectorAll(".label-item");
    expect(labelItems.length).toBe(1);

    picker.hide();
  });
});

describe("AssigneesPicker", () => {
  let anchorElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    anchorElement = document.createElement("div");
    document.body.appendChild(anchorElement);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("renders assignees picker with options", () => {
    const field = {
      id: "assignees",
      name: "Assignees",
      type: "assignees",
      options: [
        { login: "user1", name: "User One", avatarUrl: "" },
        { login: "user2", name: "User Two", avatarUrl: "" },
      ],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentAssignees: any[] = [];

    const picker = new AssigneesPicker({
      anchorElement,
      field,
      item,
      currentAssignees,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    // Check that picker is rendered
    const pickerEl = document.querySelector(".field-picker");
    expect(pickerEl).toBeTruthy();

    // Check that assignees are rendered
    const assigneeItems = document.querySelectorAll(".assignee-item");
    expect(assigneeItems.length).toBe(2);

    picker.hide();
  });

  test("handles assignee selection", () => {
    const field = {
      id: "assignees",
      name: "Assignees",
      type: "assignees",
      options: [{ login: "user1", name: "User One" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentAssignees: any[] = [];
    const onUpdate = jest.fn();

    const picker = new AssigneesPicker({
      anchorElement,
      field,
      item,
      currentAssignees,
      onClose: jest.fn(),
      onUpdate,
      onError: jest.fn(),
    });

    picker.show();

    // Click on the first assignee item
    const assigneeItem = document.querySelector(
      ".assignee-item",
    ) as HTMLElement;
    expect(assigneeItem).toBeTruthy();
    assigneeItem.click();

    // Click Apply button
    const applyButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Apply",
    );
    expect(applyButton).toBeTruthy();
    applyButton?.click();

    // Check that onUpdate was called with the selected assignee
    expect(onUpdate).toHaveBeenCalledWith(["user1"]);
  });

  test("includes current assignees even when not in field options", () => {
    const field = {
      id: "assignees",
      name: "Assignees",
      type: "assignees",
      options: [{ login: "user1", name: "User One" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentAssignees: any[] = [{ login: "user2", name: "User Two" }];

    const picker = new AssigneesPicker({
      anchorElement,
      field,
      item,
      currentAssignees,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    const assigneeItems = Array.from(
      document.querySelectorAll(".assignee-item"),
    ).map((el) => el.textContent || "");

    expect(assigneeItems.join(" ")).toContain("user1");
    expect(assigneeItems.join(" ")).toContain("user2");
  });

  test("assignee picker provides open-in-browser action", () => {
    const field = {
      id: "assignees",
      name: "Assignees",
      type: "assignees",
      options: [{ login: "user1", name: "User One" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentAssignees: any[] = [];

    const picker = new AssigneesPicker({
      anchorElement,
      field,
      item,
      currentAssignees,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    const openBtn = document.querySelector(
      ".assignee-open-button",
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();

    const messaging = (window as any).__APP_MESSAGING__;
    (messaging.postMessage as jest.Mock).mockClear();

    openBtn?.click();

    expect(messaging.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: "openUrl" }),
    );
  });
});

describe("MilestonePicker", () => {
  let anchorElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    anchorElement = document.createElement("div");
    document.body.appendChild(anchorElement);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("renders milestone picker with options", () => {
    const field = {
      id: "milestone",
      name: "Milestone",
      type: "milestone",
      options: [
        { id: "1", title: "v1.0", dueOn: "2024-12-31" },
        { id: "2", title: "v2.0", dueOn: "2025-06-30" },
      ],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentMilestone = null;

    const picker = new MilestonePicker({
      anchorElement,
      field,
      item,
      currentMilestone,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    // Check that picker is rendered
    const pickerEl = document.querySelector(".field-picker");
    expect(pickerEl).toBeTruthy();

    // Check that milestones are rendered (including "No milestone" option)
    const milestoneItems = document.querySelectorAll(".milestone-item");
    expect(milestoneItems.length).toBe(3); // 2 milestones + "No milestone"

    picker.hide();
  });

  test("handles milestone selection", () => {
    const field = {
      id: "milestone",
      name: "Milestone",
      type: "milestone",
      options: [{ id: "1", title: "v1.0" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentMilestone = null;
    const onUpdate = jest.fn();

    const picker = new MilestonePicker({
      anchorElement,
      field,
      item,
      currentMilestone,
      onClose: jest.fn(),
      onUpdate,
      onError: jest.fn(),
    });

    picker.show();

    // Get all milestone items (first is "No milestone")
    const milestoneItems = document.querySelectorAll(".milestone-item");
    expect(milestoneItems.length).toBe(2);

    // Click on the actual milestone (second item)
    const milestoneItem = milestoneItems[1] as HTMLElement;
    milestoneItem.click();

    // Check that onUpdate was called with the selected milestone
    // Milestone selection is immediate, so picker should close and onUpdate called
    expect(onUpdate).toHaveBeenCalledWith("1");
  });

  test('handles "No milestone" selection', () => {
    const field = {
      id: "milestone",
      name: "Milestone",
      type: "milestone",
      options: [{ id: "1", title: "v1.0" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentMilestone = { id: "1", title: "v1.0" };
    const onUpdate = jest.fn();

    const picker = new MilestonePicker({
      anchorElement,
      field,
      item,
      currentMilestone,
      onClose: jest.fn(),
      onUpdate,
      onError: jest.fn(),
    });

    picker.show();

    // Click on "No milestone" option (first item)
    const noMilestoneItem = document.querySelector(
      ".milestone-item",
    ) as HTMLElement;
    expect(noMilestoneItem).toBeTruthy();
    noMilestoneItem.click();

    // Check that onUpdate was called with null
    expect(onUpdate).toHaveBeenCalledWith(null);
  });
});

describe("ReviewersPicker", () => {
  let anchorElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    anchorElement = document.createElement("div");
    document.body.appendChild(anchorElement);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("includes current reviewers even when not in field options", () => {
    const field = {
      id: "reviewers",
      name: "Reviewers",
      type: "reviewers",
      options: [{ login: "rev1", name: "Reviewer One" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentReviewers: any[] = [{ login: "rev2", name: "Reviewer Two" }];

    const picker = new ReviewersPicker({
      anchorElement,
      field,
      item,
      currentReviewers,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    const reviewerItems = Array.from(
      document.querySelectorAll(".reviewer-item"),
    ).map((el) => el.textContent || "");

    expect(reviewerItems.join(" ")).toContain("rev1");
    expect(reviewerItems.join(" ")).toContain("rev2");
  });

  test("reviewer picker provides open-in-browser action", () => {
    const field = {
      id: "reviewers",
      name: "Reviewers",
      type: "reviewers",
      options: [{ login: "rev1", name: "Reviewer One" }],
    };

    const item = { id: "item1", fieldValues: [] };
    const currentReviewers: any[] = [];

    const picker = new ReviewersPicker({
      anchorElement,
      field,
      item,
      currentReviewers,
      onClose: jest.fn(),
      onUpdate: jest.fn(),
      onError: jest.fn(),
    });

    picker.show();

    const openBtn = document.querySelector(
      ".reviewer-open-button",
    ) as HTMLButtonElement | null;
    expect(openBtn).toBeTruthy();

    const messaging = (window as any).__APP_MESSAGING__;
    (messaging.postMessage as jest.Mock).mockClear();

    openBtn?.click();

    expect(messaging.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: "openUrl" }),
    );
  });
});
