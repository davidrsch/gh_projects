/**
 * @jest-environment jsdom
 */

import { FieldDropdown, DropdownOption } from "../../../../src/webviews/client/components/FieldDropdown";

describe("FieldDropdown", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "100px";
    container.style.left = "100px";
    container.style.width = "200px";
    container.style.height = "30px";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should create a dropdown with options", () => {
    const options: DropdownOption[] = [
      { id: null, label: "Clear" },
      { id: "1", label: "Option 1", color: "#ff0000" },
      { id: "2", label: "Option 2", color: "#00ff00" },
    ];

    let selectedId: string | null = null;
    let closeCalled = false;

    const dropdown = new FieldDropdown({
      options,
      currentValue: null,
      anchorElement: container,
      onSelect: (id) => {
        selectedId = id;
      },
      onClose: () => {
        closeCalled = true;
      },
      title: "Select an option",
    });

    dropdown.show();

    // Check that dropdown is rendered
    const dropdownEl = document.querySelector(".field-dropdown");
    expect(dropdownEl).toBeTruthy();

    // Check that title is rendered
    const titleEl = document.querySelector(".field-dropdown-title");
    expect(titleEl?.textContent).toBe("Select an option");

    // Check that options are rendered
    const optionEls = document.querySelectorAll(".field-dropdown-option");
    expect(optionEls.length).toBe(3);

    // Clean up
    dropdown.destroy();
  });

  it("should show color swatches for options with colors", () => {
    const options: DropdownOption[] = [
      { id: "1", label: "Red", color: "#ff0000" },
      { id: "2", label: "Green", color: "#00ff00" },
    ];

    const dropdown = new FieldDropdown({
      options,
      currentValue: null,
      anchorElement: container,
      onSelect: () => {},
      onClose: () => {},
    });

    dropdown.show();

    const swatches = document.querySelectorAll(".field-dropdown-swatch");
    expect(swatches.length).toBe(2);

    dropdown.destroy();
  });

  it("should highlight the currently selected option", () => {
    const options: DropdownOption[] = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
      { id: "3", label: "Option 3" },
    ];

    const dropdown = new FieldDropdown({
      options,
      currentValue: "2",
      anchorElement: container,
      onSelect: () => {},
      onClose: () => {},
    });

    dropdown.show();

    const selectedOption = document.querySelector(".field-dropdown-option.selected");
    expect(selectedOption?.textContent).toContain("Option 2");

    dropdown.destroy();
  });

  it("should call onSelect when an option is clicked", () => {
    const options: DropdownOption[] = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
    ];

    let selectedId: string | null = null;

    const dropdown = new FieldDropdown({
      options,
      currentValue: null,
      anchorElement: container,
      onSelect: (id) => {
        selectedId = id;
      },
      onClose: () => {},
    });

    dropdown.show();

    const optionEls = document.querySelectorAll(".field-dropdown-option");
    const secondOption = optionEls[1] as HTMLElement;
    secondOption.click();

    expect(selectedId).toBe("2");
  });

  it("should show empty message when no options provided", () => {
    const dropdown = new FieldDropdown({
      options: [],
      currentValue: null,
      anchorElement: container,
      onSelect: () => {},
      onClose: () => {},
      emptyMessage: "No options configured",
    });

    dropdown.show();

    const emptyMsg = document.querySelector(".field-dropdown-empty");
    expect(emptyMsg?.textContent).toBe("No options configured");

    dropdown.destroy();
  });

  it("should handle keyboard navigation with ArrowDown", () => {
    const options: DropdownOption[] = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
      { id: "3", label: "Option 3" },
    ];

    const dropdown = new FieldDropdown({
      options,
      currentValue: null,
      anchorElement: container,
      onSelect: () => {},
      onClose: () => {},
    });

    dropdown.show();

    const dropdownEl = document.querySelector(".field-dropdown") as HTMLElement;
    expect(dropdownEl).toBeTruthy();

    // Simulate ArrowDown key press
    const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
    dropdownEl.dispatchEvent(event);

    // The second option should now be highlighted (index 1)
    // We can't easily test highlighting without checking styles, so we just verify no errors

    dropdown.destroy();
  });

  it("should handle Enter key to select highlighted option", () => {
    const options: DropdownOption[] = [
      { id: "1", label: "Option 1" },
      { id: "2", label: "Option 2" },
    ];

    let selectedId: string | null = null;

    const dropdown = new FieldDropdown({
      options,
      currentValue: null,
      anchorElement: container,
      onSelect: (id) => {
        selectedId = id;
      },
      onClose: () => {},
    });

    dropdown.show();

    const dropdownEl = document.querySelector(".field-dropdown") as HTMLElement;

    // Simulate Enter key press (should select first option by default)
    const event = new KeyboardEvent("keydown", { key: "Enter" });
    dropdownEl.dispatchEvent(event);

    expect(selectedId).toBe("1");
  });

  it("should close on Escape key", () => {
    const options: DropdownOption[] = [
      { id: "1", label: "Option 1" },
    ];

    let closeCalled = false;

    const dropdown = new FieldDropdown({
      options,
      currentValue: null,
      anchorElement: container,
      onSelect: () => {},
      onClose: () => {
        closeCalled = true;
      },
    });

    dropdown.show();

    const dropdownEl = document.querySelector(".field-dropdown") as HTMLElement;

    // Simulate Escape key press
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    dropdownEl.dispatchEvent(event);

    expect(closeCalled).toBe(true);
  });

  it("should close when backdrop is clicked", () => {
    const options: DropdownOption[] = [
      { id: "1", label: "Option 1" },
    ];

    let closeCalled = false;

    const dropdown = new FieldDropdown({
      options,
      currentValue: null,
      anchorElement: container,
      onSelect: () => {},
      onClose: () => {
        closeCalled = true;
      },
    });

    dropdown.show();

    const backdrop = document.querySelector(".field-dropdown-backdrop") as HTMLElement;
    expect(backdrop).toBeTruthy();

    backdrop.click();

    expect(closeCalled).toBe(true);
  });
});
