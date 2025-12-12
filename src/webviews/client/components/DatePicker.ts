/**
 * Date Picker Component
 * Provides a VS Code themed calendar popup for selecting dates.
 *
 * This component is used by DateCellEditor to replace the native
 * browser date picker so the calendar fully follows the VS Code theme.
 */

export interface DatePickerOptions {
  anchorElement: HTMLElement;
  /** Initial date value as YYYY-MM-DD or ISO string */
  initialDate?: string | null;
  /** Callback when a date is selected. Value is YYYY-MM-DD or null. */
  onSelect: (value: string | null) => void;
  /** Callback when the picker is closed (by selection, escape, or click outside). */
  onClose: () => void;
}

export class DatePicker {
  private anchorElement: HTMLElement;
  private initialDate: string | null;
  private onSelect: (value: string | null) => void;
  private onClose: () => void;

  private container: HTMLDivElement | null = null;
  private backdrop: HTMLDivElement | null = null;
  private mounted = false;

  private currentYear: number;
  private currentMonth: number; // 0-11
  private selectedDate: Date | null = null;
  private dayButtons: { date: Date; element: HTMLButtonElement }[] = [];
  private focusedIndex: number = -1;

  constructor(options: DatePickerOptions) {
    this.anchorElement = options.anchorElement;
    this.initialDate = options.initialDate || null;
    this.onSelect = options.onSelect;
    this.onClose = options.onClose;

    const baseDate = this.parseDate(this.initialDate) || new Date();
    this.currentYear = baseDate.getFullYear();
    this.currentMonth = baseDate.getMonth();
    this.selectedDate = this.parseDate(this.initialDate);
  }

  public show(): void {
    if (this.mounted) return;
    this.mounted = true;

    this.backdrop = this.createBackdrop();
    this.container = this.createContainer();

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.container);

    this.positionContainer();

    // Focus first appropriate day after initial render
    this.focusInitialDay();

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("scroll", this.handleScroll, true);
  }

  public hide(): void {
    if (!this.mounted) return;
    this.mounted = false;

    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("scroll", this.handleScroll, true);

    if (this.container && this.container.parentElement) {
      this.container.remove();
    }
    if (this.backdrop && this.backdrop.parentElement) {
      this.backdrop.remove();
    }

    this.container = null;
    this.backdrop = null;
    this.dayButtons = [];
    this.focusedIndex = -1;

    this.onClose();
  }

  private createBackdrop(): HTMLDivElement {
    const backdrop = document.createElement("div");
    backdrop.style.position = "fixed";
    backdrop.style.top = "0";
    backdrop.style.left = "0";
    backdrop.style.right = "0";
    backdrop.style.bottom = "0";
    backdrop.style.zIndex = "999";
    backdrop.style.background = "transparent";

    backdrop.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
    });

    backdrop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    });

    return backdrop;
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.background = "var(--vscode-menu-background)";
    container.style.border = "1px solid var(--vscode-menu-border)";
    container.style.borderRadius = "4px";
    container.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
    container.style.padding = "8px";
    container.style.minWidth = "220px";
    container.style.maxWidth = "260px";
    container.style.zIndex = "1000";
    container.style.fontSize = "13px";
    container.style.color = "var(--vscode-foreground)";

    container.setAttribute("role", "dialog");
    container.setAttribute("aria-label", "Select date");

    // Keyboard navigation for the calendar
    container.addEventListener("keydown", (e) => this.handleKeyDown(e));

    // Build calendar structure
    this.buildCalendar(container);

    return container;
  }

  private buildCalendar(container: HTMLDivElement): void {
    container.innerHTML = "";
    this.dayButtons = [];
    this.focusedIndex = -1;

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "4px";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.textContent = "<";
    prevBtn.title = "Previous month";
    prevBtn.style.border = "1px solid var(--vscode-button-border)";
    prevBtn.style.background = "var(--vscode-button-secondaryBackground)";
    prevBtn.style.color = "var(--vscode-button-secondaryForeground)";
    prevBtn.style.borderRadius = "2px";
    prevBtn.style.cursor = "pointer";
    prevBtn.style.width = "24px";
    prevBtn.style.height = "24px";
    prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.changeMonth(-1);
    });

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.textContent = ">";
    nextBtn.title = "Next month";
    nextBtn.style.border = "1px solid var(--vscode-button-border)";
    nextBtn.style.background = "var(--vscode-button-secondaryBackground)";
    nextBtn.style.color = "var(--vscode-button-secondaryForeground)";
    nextBtn.style.borderRadius = "2px";
    nextBtn.style.cursor = "pointer";
    nextBtn.style.width = "24px";
    nextBtn.style.height = "24px";
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.changeMonth(1);
    });

    const controls = document.createElement("div");
    controls.style.flex = "1";
    controls.style.display = "flex";
    controls.style.justifyContent = "center";
    controls.style.gap = "4px";

    const monthSelect = document.createElement("select");
    monthSelect.style.border = "1px solid var(--vscode-input-border)";
    monthSelect.style.background = "var(--vscode-input-background)";
    monthSelect.style.color = "var(--vscode-input-foreground)";
    monthSelect.style.borderRadius = "2px";
    monthSelect.style.fontSize = "12px";
    monthSelect.style.padding = "2px 4px";

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    monthNames.forEach((name, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = name;
      if (index === this.currentMonth) {
        opt.selected = true;
      }
      monthSelect.appendChild(opt);
    });

    monthSelect.addEventListener("change", () => {
      const value = parseInt(monthSelect.value, 10);
      if (!isNaN(value)) {
        this.currentMonth = value;
        if (this.container) {
          this.buildCalendar(this.container);
          this.focusInitialDay();
        }
      }
    });

    const yearInput = document.createElement("input");
    yearInput.type = "number";
    yearInput.value = String(this.currentYear);
    yearInput.min = "1970";
    yearInput.max = "2100";
    yearInput.style.width = "64px";
    yearInput.style.border = "1px solid var(--vscode-input-border)";
    yearInput.style.background = "var(--vscode-input-background)";
    yearInput.style.color = "var(--vscode-input-foreground)";
    yearInput.style.borderRadius = "2px";
    yearInput.style.fontSize = "12px";
    yearInput.style.padding = "2px 4px";
    yearInput.style.boxSizing = "border-box";

    const commitYearChange = () => {
      const value = parseInt(yearInput.value, 10);
      if (!isNaN(value)) {
        this.currentYear = value;
        if (this.container) {
          this.buildCalendar(this.container);
          this.focusInitialDay();
        }
      }
    };

    yearInput.addEventListener("change", () => {
      commitYearChange();
    });

    yearInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitYearChange();
      }
    });

    controls.appendChild(monthSelect);
    controls.appendChild(yearInput);

    header.appendChild(prevBtn);
    header.appendChild(controls);
    header.appendChild(nextBtn);
    container.appendChild(header);

    // Weekday row
    const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const weekdayRow = document.createElement("div");
    weekdayRow.style.display = "grid";
    weekdayRow.style.gridTemplateColumns = "repeat(7, 1fr)";
    weekdayRow.style.marginTop = "4px";
    weekdayRow.style.marginBottom = "2px";

    weekdays.forEach((day) => {
      const cell = document.createElement("div");
      cell.textContent = day;
      cell.style.textAlign = "center";
      cell.style.fontSize = "11px";
      cell.style.color = "var(--vscode-descriptionForeground)";
      weekdayRow.appendChild(cell);
    });

    container.appendChild(weekdayRow);

    // Days grid
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(7, 1fr)";
    grid.style.gap = "2px";

    const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const firstDay = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    // Leading blanks
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement("div");
      grid.appendChild(emptyCell);
    }

    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(this.currentYear, this.currentMonth, day);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(day);
      button.style.width = "100%";
      button.style.height = "24px";
      button.style.border = "1px solid transparent";
      button.style.borderRadius = "2px";
      button.style.background = "transparent";
      button.style.color = "var(--vscode-foreground)";
      button.style.cursor = "pointer";
      button.style.fontSize = "12px";

      button.setAttribute("aria-label", date.toDateString());

      // Highlight today
      if (this.isSameDate(date, today)) {
        button.style.borderColor = "var(--vscode-focusBorder)";
      }

      // Highlight selected date
      if (this.selectedDate && this.isSameDate(date, this.selectedDate)) {
        button.style.background = "var(--vscode-list-activeSelectionBackground)";
        button.style.color = "var(--vscode-list-activeSelectionForeground)";
      }

      button.addEventListener("mouseenter", () => {
        button.style.background = "var(--vscode-list-hoverBackground)";
      });

      button.addEventListener("mouseleave", () => {
        if (this.selectedDate && this.isSameDate(date, this.selectedDate)) {
          button.style.background = "var(--vscode-list-activeSelectionBackground)";
          button.style.color = "var(--vscode-list-activeSelectionForeground)";
        } else {
          button.style.background = "transparent";
          button.style.color = "var(--vscode-foreground)";
        }
      });

      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const iso = this.toIsoString(date);
        this.onSelect(iso ? iso.split("T")[0] : null);
        this.hide();
      });

      grid.appendChild(button);
      this.dayButtons.push({ date, element: button });
    }

    container.appendChild(grid);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.dayButtons.length === 0) return;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        this.moveFocusBy(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.moveFocusBy(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        this.moveFocusBy(7);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveFocusBy(-7);
        break;
      case "Home":
        e.preventDefault();
        this.focusIndex(0);
        break;
      case "End":
        e.preventDefault();
        this.focusIndex(this.dayButtons.length - 1);
        break;
      case "PageUp":
        e.preventDefault();
        this.changeMonth(-1, true);
        break;
      case "PageDown":
        e.preventDefault();
        this.changeMonth(1, true);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (this.focusedIndex >= 0 && this.focusedIndex < this.dayButtons.length) {
          const { element } = this.dayButtons[this.focusedIndex];
          element.click();
        }
        break;
      case "Escape":
        e.preventDefault();
        this.hide();
        break;
    }
  }

  private moveFocusBy(delta: number): void {
    if (this.dayButtons.length === 0) return;

    const nextIndex = this.focusedIndex < 0 ? 0 : this.focusedIndex + delta;
    if (nextIndex < 0 || nextIndex >= this.dayButtons.length) return;
    this.focusIndex(nextIndex);
  }

  private focusIndex(index: number): void {
    if (index < 0 || index >= this.dayButtons.length) return;
    this.focusedIndex = index;
    const { element } = this.dayButtons[index];
    element.focus();
  }

  private focusInitialDay(): void {
    if (this.dayButtons.length === 0) return;

    // Prefer selected date, then today's date, else first day
    let targetIndex = -1;

    if (this.selectedDate) {
      targetIndex = this.dayButtons.findIndex(({ date }) =>
        this.isSameDate(date, this.selectedDate as Date),
      );
    }

    if (targetIndex === -1) {
      const today = new Date();
      targetIndex = this.dayButtons.findIndex(({ date }) =>
        this.isSameDate(date, today),
      );
    }

    if (targetIndex === -1) {
      targetIndex = 0;
    }

    this.focusIndex(targetIndex);
  }

  private changeMonth(offset: number, preserveFocus: boolean = false): void {
    this.currentMonth += offset;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear -= 1;
    } else if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear += 1;
    }

    if (this.container) {
      this.buildCalendar(this.container);
      if (preserveFocus) {
        this.focusInitialDay();
      }
    }
  }

  private positionContainer(): void {
    if (!this.container) return;

    const anchorRect = this.anchorElement.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = anchorRect.bottom + 4;
    let left = anchorRect.left;

    // Flip above if not enough space below
    if (top + containerRect.height > viewportHeight && anchorRect.top > containerRect.height) {
      top = anchorRect.top - containerRect.height - 4;
    }

    // Adjust horizontal position if overflowing
    if (left + containerRect.width > viewportWidth) {
      left = Math.max(4, viewportWidth - containerRect.width - 4);
    }

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
  }

  private handleResize = () => {
    this.positionContainer();
  };

  private handleScroll = () => {
    this.positionContainer();
  };

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    try {
      // Accept YYYY-MM-DD or any ISO-like string
      const date = new Date(value);
      if (isNaN(date.getTime())) return null;
      return date;
    } catch {
      return null;
    }
  }

  private toIsoString(date: Date): string | null {
    try {
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  }

  private isSameDate(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
