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

    default:
      // Fallback to string comparison
      result = String(aValue).localeCompare(String(bValue));
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
    case "text":
    case "title":
      return fieldValue.text || fieldValue.title || null;

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

    default:
      return fieldValue;
  }
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
