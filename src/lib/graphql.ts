import { ghQueryWithErrors } from "./ghApiHelper";

export async function ghGraphQL(
  query: string,
  variables?: Record<string, any>,
): Promise<any> {
  // Keep compatibility wrapper name but delegate to central helper
  return await ghQueryWithErrors(query, variables);
}
