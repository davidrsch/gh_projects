import * as vscode from "vscode";
import { ProjectEntry, ProjectView } from "../lib/types";
import { GitHubRepository } from "../services/GitHubRepository";
import logger from "../lib/logger";

export class ViewDataService {
  public static async fetchProjectViews(project: ProjectEntry): Promise<ProjectView[]> {
    let views: ProjectView[] = Array.isArray(project.views) ? project.views : [];
    if (!views.length && project.id) {
      try {
        views = await GitHubRepository.getInstance().fetchProjectViews(project.id);
        project.views = views;
        logger.debug(`[ghProjects] Assigned ${views.length} views to project ${project.id}`);
      } catch (e) {
        logger.warn("Failed to fetch project views for panelKey: " + String(e));
      }
    } else {
      logger.debug(`[ghProjects] Project ${project.id} already has ${views.length} views`);
    }
    return views;
  }

  public static async enrichViewDetails(
    context: vscode.ExtensionContext,
    project: ProjectEntry,
    views: ProjectView[]
  ) {
    if (project.id && Array.isArray(views) && views.length > 0) {
      try {
        for (let i = 0; i < views.length; i++) {
          const v = views[i];
          if (v && typeof v.number === "number") {
            try {
              const det = await GitHubRepository.getInstance().getProjectViewDetails(project.id, v.number as number);
              if (det) {
                (v as any).details = det;
                try {
                  const storageKey = `viewFilter:${project.id}:${v.number}`;
                  const saved = await context.workspaceState.get<string>(storageKey);
                  if (typeof saved === "string") {
                    (v as any).details.filter = saved;
                  }
                } catch (e) {
                  // ignore workspace storage errors
                }
              }
            } catch (err) {
              logger.debug(
                `fetchViewDetails failed for project ${project.id} view ${String(v.number)}: ${String((err as any)?.message || err || "")}`
              );
            }
          }
        }
      } catch (e) {
        logger.debug(
          "fetchViewDetails loop failed: " + String((e as any)?.message || e || "")
        );
      }
    }
  }
}
