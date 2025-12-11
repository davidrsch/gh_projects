import type { FieldConfig } from "../../../lib/types";

export interface SortConfig {
  fieldId: string;
  direction: "ASC" | "DESC";
  secondary?: {
    fieldId: string;
    direction: "ASC" | "DESC";
  };
}

/**
 * Parse sortByFields from GitHub GraphQL response into SortConfig
 */
export function parseSortByFields(sortByFields: any): SortConfig | null {
  if (!sortByFields || !sortByFields.nodes || sortByFields.nodes.length === 0) {
    return null;
  }

  const primary = sortByFields.nodes[0];
  if (!primary || !primary.field) {
    return null;
  }

  const config: SortConfig = {
    fieldId: primary.field.id || primary.field.name,
    direction: primary.direction || "ASC",
  };

  // Add secondary sort if available
  if (sortByFields.nodes.length > 1) {
    const secondary = sortByFields.nodes[1];
    if (secondary && secondary.field) {
      config.secondary = {
        fieldId: secondary.field.id || secondary.field.name,
        direction: secondary.direction || "ASC",
      };
    }
  }

  return config;
}

/**
 * Sort items array based on sort configuration
 */
export function sortItems(
  items: any[],
  fields: FieldConfig[],
  sortConfig: SortConfig,
): any[] {
  if (!sortConfig || items.length === 0) {
    return items;
  }

  const field = fields.find(
    (f) => f.id === sortConfig.fieldId || f.name === sortConfig.fieldId,
  );
  if (!field) {
    return items;
  }

  // Create a copy to avoid mutating original
  const sorted = [...items];

  sorted.sort((a, b) => {
    // Primary sort
    const primaryResult = compareFieldValues(a, b, field, sortConfig.direction);

    // If equal and secondary sort exists, use secondary
    if (primaryResult === 0 && sortConfig.secondary) {
      const secondaryField = fields.find(
        (f) =>
          f.id === sortConfig.secondary!.fieldId ||
          f.name === sortConfig.secondary!.fieldId,
      );
      if (secondaryField) {
        return compareFieldValues(
          a,
          b,
          secondaryField,
          sortConfig.secondary.direction,
        );
      }
    }

    return primaryResult;
  });

  return sorted;
}

/**
 * Compare two items by a specific field
 */
export function compareFieldValues(
  a: any,
  b: any,
  field: FieldConfig,
  direction: "ASC" | "DESC",
): number {
  // Find field values for both items
  const aValue = getFieldValue(a, field);
  const bValue = getFieldValue(b, field);

  // Handle null/undefined
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return direction === "ASC" ? 1 : -1;
  if (bValue === null) return direction === "ASC" ? -1 : 1;

  let result = 0;
  const dataType = (field.dataType || "").toLowerCase();

  switch (dataType) {
    case "text":
    case "title":
      result = compareText(aValue, bValue);
      break;

    case "number":
      result = compareNumber(aValue, bValue);
      break;

    case "date":
      result = compareDate(aValue, bValue);
      break;

    case "single_select":
      result = compareSingleSelect(aValue, bValue, field);
      break;

    case "iteration":
      result = compareIteration(aValue, bValue);
      break;

    case "labels":
      result = compareLabels(aValue, bValue);
      break;

    case "assignees":
    case "repository":
    case "milestone":
    case "issue_type":
    case "parent_issue":
    case "tracked_by":
    case "tracks":
    case "reviewers":
      result = compareText(aValue, bValue);
      break;

    case "linked_pull_requests":
    case "sub_issues_progress":
      result = compareNumber(aValue, bValue);
      break;

    default:
      // For unsupported data types, do not apply custom sorting
      // and treat items as equal so their relative order is preserved.
      result = 0;
  }

  return direction === "ASC" ? result : -result;
}

/**
 * Extract field value from item
 */
function getFieldValue(item: any, field: FieldConfig): any {
  const fieldValue = item.fieldValues?.find(
    (fv: any) => fv.fieldId === field.id || fv.fieldName === field.name,
  );

  if (!fieldValue) return null;

  const dataType = (field.dataType || "").toLowerCase();

  switch (dataType) {
    case "text": {
      // Normal text fields use .text, but some Title-like fields may be
      // mis-typed as TEXT while still carrying a structured title object.
      if (fieldValue.text != null) return fieldValue.text;
      return extractTitleLikeString(fieldValue, item);
    }

    case "title": {
      // Title fields store a structured object; prefer a human-friendly string
      return extractTitleLikeString(fieldValue, item);
    }

    case "number":
      return fieldValue.number !== undefined ? fieldValue.number : null;

    case "date":
      return (
        fieldValue.date || fieldValue.startDate || fieldValue.dueOn || null
      );

    case "single_select":
      return fieldValue.option || fieldValue;

    case "iteration":
      return fieldValue;

    case "labels":
      return fieldValue.labels || [];

    case "assignees": {
      const list = fieldValue.assignees;
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        return first.login || first.name || null;
      }
      return null;
    }

    case "repository": {
      const repo = fieldValue.repository;
      if (!repo) return null;
      return (
        repo.nameWithOwner ||
        repo.name ||
        repo.full_name ||
        repo.id ||
        null
      );
    }

    case "milestone": {
      const m = fieldValue.milestone;
      if (!m) return null;
      // Prefer due date when present (ISO date strings sort lexicographically),
      // otherwise fall back to title/name.
      return m.dueOn || m.title || m.name || null;
    }

    case "issue_type": {
      if (fieldValue.text) return fieldValue.text;
      if (fieldValue.option) {
        return fieldValue.option.name || fieldValue.option.title || null;
      }
      return null;
    }

    case "parent_issue": {
      const parent = fieldValue.parent;
      if (!parent) return null;
      if (parent.title) return parent.title;
      if (typeof parent.number === "number") return String(parent.number);
      return parent.id || null;
    }

    case "linked_pull_requests": {
      const prs = fieldValue.pullRequests;
      if (Array.isArray(prs) && prs.length > 0) {
        const first = prs[0];
        if (typeof first.number === "number") return first.number;
        return first.title || null;
      }
      return null;
    }

    case "reviewers": {
      const list = fieldValue.reviewers;
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        return first.login || first.name || first.id || null;
      }
      return null;
    }

    case "sub_issues_progress": {
      if (typeof fieldValue.percent === "number") return fieldValue.percent;
      if (
        typeof fieldValue.done === "number" &&
        typeof fieldValue.total === "number" &&
        fieldValue.total > 0
      ) {
        return (fieldValue.done / fieldValue.total) * 100;
      }
      return null;
    }

    case "tracked_by":
    case "tracks": {
      const issues = fieldValue.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0];
        if (first.title) return first.title;
        if (typeof first.number === "number") return String(first.number);
        return first.id || null;
      }
      return null;
    }

    default:
      return fieldValue;
  }
}

function extractTitleLikeString(fieldValue: any, item: any): string | null {
  if (!fieldValue) return null;

  // Prefer the underlying raw node's text when present
  const rawNode =
    (fieldValue.title && fieldValue.title.raw) || fieldValue.raw || null;
  if (rawNode && typeof rawNode.text === "string" && rawNode.text.trim()) {
    return rawNode.text;
  }

  // Then look at the content object which often carries title/name
  const content =
    (fieldValue.title && fieldValue.title.content) ||
    fieldValue.content ||
    (rawNode && rawNode.itemContent) ||
    (item && item.content) ||
    null;

  if (content) {
    if (typeof content === "string" && content.trim()) {
      return content;
    }
    if (typeof content.title === "string" && content.title.trim()) {
      return content.title;
    }
    if (typeof content.name === "string" && content.name.trim()) {
      return content.name;
    }
  }

  // Fallbacks: occasionally a plain text field is reused
  if (typeof fieldValue.text === "string" && fieldValue.text.trim()) {
    return fieldValue.text;
  }
  if (rawNode && typeof rawNode.title === "string" && rawNode.title.trim()) {
    return rawNode.title;
  }

  return null;
}

/**
 * Compare text values
 */
function compareText(a: any, b: any): number {
  const aStr = String(a || "").toLowerCase();
  const bStr = String(b || "").toLowerCase();
  return aStr.localeCompare(bStr);
}

/**
 * Compare number values
 */
function compareNumber(a: any, b: any): number {
  const aNum = typeof a === "number" ? a : parseFloat(a);
  const bNum = typeof b === "number" ? b : parseFloat(b);

  if (isNaN(aNum) && isNaN(bNum)) return 0;
  if (isNaN(aNum)) return 1;
  if (isNaN(bNum)) return -1;

  return aNum - bNum;
}

/**
 * Compare date values
 */
function compareDate(a: any, b: any): number {
  const aDate = new Date(a);
  const bDate = new Date(b);

  if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0;
  if (isNaN(aDate.getTime())) return 1;
  if (isNaN(bDate.getTime())) return -1;

  return aDate.getTime() - bDate.getTime();
}

/**
 * Compare single select values by option order
 */
function compareSingleSelect(a: any, b: any, field: FieldConfig): number {
  const aOption = a.option || a;
  const bOption = b.option || b;

  if (!aOption || !bOption) {
    return compareText(aOption?.name || "", bOption?.name || "");
  }

  // If field has options array, sort by position in array
  if (field.options && Array.isArray(field.options)) {
    const aIndex = field.options.findIndex(
      (opt: any) => opt.id === aOption.id || opt.name === aOption.name,
    );
    const bIndex = field.options.findIndex(
      (opt: any) => opt.id === bOption.id || opt.name === bOption.name,
    );

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
  }

  // Fallback to name comparison
  return compareText(aOption.name, bOption.name);
}

/**
 * Compare iteration values by start date
 */
function compareIteration(a: any, b: any): number {
  const aDate = a.startDate || a.iteration?.startDate;
  const bDate = b.startDate || b.iteration?.startDate;

  if (!aDate && !bDate) {
    // Sort by title if no dates
    return compareText(
      a.title || a.iteration?.title,
      b.title || b.iteration?.title,
    );
  }

  return compareDate(aDate, bDate);
}

/**
 * Compare labels by first label name
 */
function compareLabels(a: any, b: any): number {
  const aLabels = Array.isArray(a) ? a : [];
  const bLabels = Array.isArray(b) ? b : [];

  if (aLabels.length === 0 && bLabels.length === 0) return 0;
  if (aLabels.length === 0) return 1;
  if (bLabels.length === 0) return -1;

  return compareText(aLabels[0].name, bLabels[0].name);
}
