/**
 * GraphQL query executor - responsible for executing queries against GitHub's GraphQL API.
 * Separates query execution from query building and response processing.
 */
import { graphql } from "@octokit/graphql";
import { AuthenticationManager } from "./AuthenticationManager";
import logger from "../lib/logger";

export interface GraphQLExecutor {
  execute<T>(query: string, variables?: Record<string, any>): Promise<T>;
}

/**
 * Default GraphQL executor implementation using @octokit/graphql and AuthenticationManager.
 */
export class GitHubGraphQLExecutor implements GraphQLExecutor {
  private authManager: AuthenticationManager;

  constructor(authManager?: AuthenticationManager) {
    this.authManager = authManager || AuthenticationManager.getInstance();
  }

  async execute<T>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    const token = await this.authManager.ensureAuthenticated();
    try {
      return await graphql<T>(query, {
        ...variables,
        headers: {
          authorization: `token ${token}`,
        },
      });
    } catch (error: any) {
      logger.error(`GraphQL query failed: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Get the default GraphQL executor instance.
 */
export function getGraphQLExecutor(): GraphQLExecutor {
  return new GitHubGraphQLExecutor();
}
