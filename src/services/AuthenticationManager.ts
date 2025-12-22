import * as vscode from "vscode";
import logger from "../lib/logger";

export class AuthenticationManager {
  private static instance: AuthenticationManager;
  private readonly scopes = ["repo", "read:org", "read:user", "read:project"];

  private constructor() {}

  public static getInstance(): AuthenticationManager {
    if (!AuthenticationManager.instance) {
      AuthenticationManager.instance = new AuthenticationManager();
    }
    return AuthenticationManager.instance;
  }

  /**
   * Retrieves a GitHub authentication session.
   * @param createIfNone If true, prompts the user to sign in if no session exists.
   * @returns The authentication session or undefined.
   */
  public async getSession(
    createIfNone: boolean = false,
  ): Promise<vscode.AuthenticationSession | undefined> {
    // Support for integration testing
    if (process.env.GH_PROJECTS_TOKEN_FOR_TESTING) {
      logger.debug("AuthenticationManager: Using test token from environment.");
      return {
        id: "test-session",
        accessToken: process.env.GH_PROJECTS_TOKEN_FOR_TESTING,
        account: { id: "test-user", label: "Test User" },
        scopes: this.scopes,
      };
    }

    try {
      const session = await vscode.authentication.getSession(
        "github",
        this.scopes,
        { createIfNone },
      );

      if (session) {
        logger.debug("AuthenticationManager: Session retrieved successfully.");
      } else {
        logger.debug("AuthenticationManager: No session found.");
      }

      return session;
    } catch (error) {
      logger.error(`AuthenticationManager: Failed to get session. ${error}`);
      if (createIfNone) {
        vscode.window.showErrorMessage(`Failed to sign in to GitHub: ${error}`);
      }
      return undefined;
    }
  }

  /**
   * Ensures the user is authenticated, prompting them if necessary.
   * Throws an error if authentication fails or is rejected.
   */
  public async ensureAuthenticated(): Promise<string> {
    const session = await this.getSession(true);
    if (!session) {
      throw new Error("User is not authenticated.");
    }
    return session.accessToken;
  }
}
