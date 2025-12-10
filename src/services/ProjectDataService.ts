import { GitHubRepository } from "./GitHubRepository";
import {
  ProjectSnapshot,
  ProjectEntry,
  ProjectView,
  NormalizedValue,
} from "../lib/types";
import logger from "../lib/logger";
import { ConfigReader, getConfigReader } from "../lib/config";

export class ProjectDataService {
  /**
   * Fetches and processes project data for a specific view.
   */
  public static async getProjectData(
    project: ProjectEntry,
    viewKey: string | undefined,
    forceRefresh: boolean = false,
    configReader?: ConfigReader,
  ): Promise<{
    snapshot: ProjectSnapshot;
    effectiveFilter?: string;
    itemsCount: number;
  }> {
    if (!project.id) {
      throw new Error("Project ID is missing");
    }

    const config = configReader || getConfigReader();

    // 1. Parse View Key
    let viewIdx = 0;
    let localKey = viewKey ? String(viewKey).split(":").pop() : undefined;
    if (localKey && localKey.startsWith("view-")) {
      const idx = Number(localKey.split("-")[1]);
      if (!isNaN(idx)) viewIdx = idx;
    }

    const viewsArr: ProjectView[] = Array.isArray(project.views)
      ? project.views
      : [];
    const view = viewsArr[viewIdx];

    // 2. Determine Filter
    const viewFilter =
      (view && (view as any).details && (view as any).details.filter) ||
      undefined;

    // 3. Fetch Snapshot
    const first = config.get("itemsFirst", 50);

    logger.debug(
      `[ProjectDataService] Fetching project fields for projectId=${project.id} viewIdx=${viewIdx} first=${first}`,
    );

    const snapshot: ProjectSnapshot =
      await GitHubRepository.getInstance().fetchProjectFields(project.id, {
        first,
        viewFilter,
      });

    // Preserve a copy of the full fields list so the webview/client can
    // determine which fields are hidden by the view definition (view.details.fields)
    const originalFields = Array.isArray(snapshot.fields)
      ? snapshot.fields.slice()
      : [];

    // 4. Process Fields (Filter & Reorder based on View)
    let effectiveSnapshot: any = snapshot;
    if (view && (view as any).details) {
      // Preserve snapshot immutably and attach view details.
      effectiveSnapshot = {
        ...effectiveSnapshot,
        details: (view as any).details,
      } as ProjectSnapshot;
    }
    // Always expose the original full fields list on the snapshot under `allFields` so
    // the client can see which fields were present in the project vs the view.
    effectiveSnapshot = { ...effectiveSnapshot, allFields: originalFields };

    if (
      view &&
      (view as any).details &&
      Array.isArray(effectiveSnapshot.fields)
    ) {
      try {
        const vd = (view as any).details;
        const nodeFields =
          vd && vd.fields && Array.isArray(vd.fields.nodes)
            ? vd.fields.nodes
            : undefined;

        if (nodeFields && nodeFields.length > 0) {
          const allowedIds = nodeFields.map((nf: any) => String(nf.id));
          // Preserve ordering from the view definition
          const ordered: any[] = [];
          for (const nf of nodeFields) {
            const fid = String(nf.id);
            const found = (effectiveSnapshot.fields as any[]).find(
              (f: any) =>
                String(f.id) === fid || String(f.name) === String(nf.name),
            );
            if (found) ordered.push(found);
          }

          // If matches were found, reorder fields and also reorder each item's fieldValues
          if (ordered.length > 0) {
            // When a view defines an explicit field ordering (and thus implicitly the
            // visible fields), expose that ordering as `fields` while preserving the
            // original `items` and their full `fieldValues`. This ensures the client
            // receives the complete project-level item data (including hidden fields)
            // and can decide which fields to render when the user shows/hides columns.
            effectiveSnapshot = {
              ...effectiveSnapshot,
              allFields: originalFields,
              fields: ordered,
              // keep original items intact so hidden fields remain available
              items: effectiveSnapshot.items,
              details: (view as any)?.details,
            } as ProjectSnapshot;
          }
        }
      } catch (e) {
        logger.error(`[ProjectDataService] Error processing fields: ${e}`);
        // Fallback to original snapshot
      }
    }

    const itemsCount =
      (effectiveSnapshot &&
        (effectiveSnapshot as any).items &&
        (effectiveSnapshot as any).items.length) ||
      0;

    return {
      snapshot: effectiveSnapshot,
      effectiveFilter: viewFilter,
      itemsCount,
    };
  }
}
