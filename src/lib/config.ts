/**
 * Centralized configuration handling for ghProjects extension.
 * Provides a thin abstraction over VS Code configuration API for better testability.
 */
import * as vscode from "vscode";

export interface GhProjectsConfig {
  maxDepth: number;
  itemsFirst: number;
  maxConcurrency: number;
  queryTimeoutMs: number;
  useHttpApi: boolean;
  useBundledWebviews: boolean;
  debug: boolean;
}

/**
 * Configuration reader interface for dependency injection.
 */
export interface ConfigReader {
  get<T>(key: keyof GhProjectsConfig, defaultValue: T): T;
  getAll(): Partial<GhProjectsConfig>;
}

/**
 * VS Code configuration reader implementation.
 */
export class VSCodeConfigReader implements ConfigReader {
  private readonly configSection = "ghProjects";

  get<T>(key: keyof GhProjectsConfig, defaultValue: T): T {
    return vscode.workspace
      .getConfiguration(this.configSection)
      .get<T>(key, defaultValue);
  }

  getAll(): Partial<GhProjectsConfig> {
    const config = vscode.workspace.getConfiguration(this.configSection);
    return {
      maxDepth: config.get<number>("maxDepth", 4),
      itemsFirst: config.get<number>("itemsFirst", 50),
      maxConcurrency: config.get<number>("maxConcurrency", 4),
      queryTimeoutMs: config.get<number>("queryTimeoutMs", 30000),
      useHttpApi: config.get<boolean>("useHttpApi", false),
      useBundledWebviews: config.get<boolean>("useBundledWebviews", false),
      debug: config.get<boolean>("debug", false),
    };
  }
}

/**
 * Get the default configuration reader.
 */
export function getConfigReader(): ConfigReader {
  return new VSCodeConfigReader();
}
