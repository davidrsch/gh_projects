import { FieldConfig, FieldNode, FieldOption } from "../types";

export function normalizeFieldConfig(node: FieldNode): FieldConfig {
  const base: FieldConfig = {
    id: node.id,
    name: node.name,
    // Use the dataType *directly* from the GraphQL response.
    // This is the "ground truth".
    dataType: node.dataType,
  };

  // collect options for single select
  if (node.options && Array.isArray(node.options)) {
    base.options = node.options.map((o: FieldOption) => ({
      id: o.id,
      name: o.name,
      description: o.description,
      color: o.color,
    }));
  }

  if (node.configuration) base.configuration = node.configuration;

  return base;
}
