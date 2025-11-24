import * as vscode from "vscode";
import { GitHubRepository } from "./GitHubRepository";
import { ProjectSnapshot, ProjectEntry, ProjectView, NormalizedValue } from "../lib/types";
import logger from "../lib/logger";

export class ProjectDataService {
    /**
     * Fetches and processes project data for a specific view.
     */
    public static async getProjectData(
        project: ProjectEntry,
        viewKey: string | undefined,
        forceRefresh: boolean = false
    ): Promise<{ snapshot: ProjectSnapshot; effectiveFilter?: string; itemsCount: number }> {
        if (!project.id) {
            throw new Error("Project ID is missing");
        }

        // 1. Parse View Key
        let viewIdx = 0;
        let localKey = viewKey ? String(viewKey).split(":").pop() : undefined;
        if (localKey && localKey.startsWith("view-")) {
            const idx = Number(localKey.split("-")[1]);
            if (!isNaN(idx)) viewIdx = idx;
        }

        const viewsArr: ProjectView[] = Array.isArray(project.views) ? project.views : [];
        const view = viewsArr[viewIdx];

        // 2. Determine Filter
        const viewFilter =
            (view && (view as any).details && (view as any).details.filter) ||
            undefined;

        // 3. Fetch Snapshot
        const first = vscode.workspace
            .getConfiguration("ghProjects")
            .get<number>("itemsFirst", 50);

        logger.debug(
            `[ProjectDataService] Fetching project fields for projectId=${project.id} viewIdx=${viewIdx} first=${first}`
        );

        const snapshot: ProjectSnapshot = await GitHubRepository.getInstance().fetchProjectFields(
            project.id,
            { first, viewFilter }
        );

        // 4. Process Fields (Filter & Reorder based on View)
        let effectiveSnapshot = snapshot;
        if (view && (view as any).details) {
            effectiveSnapshot.details = (view as any).details;
        }
        if (view && (view as any).details && Array.isArray(effectiveSnapshot.fields)) {
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
                                String(f.id) === fid || String(f.name) === String(nf.name)
                        );
                        if (found) ordered.push(found);
                    }

                    // If matches were found, reorder fields and also reorder each item's fieldValues
                    if (ordered.length > 0) {
                        const orderedFieldIds = ordered.map((f: any) =>
                            String(f.id ?? f.name ?? "")
                        );

                        // Rebuild items' fieldValues to match orderedFieldIds
                        const newItems = (effectiveSnapshot.items || []).map(
                            (it: any) => {
                                const fv = Array.isArray(it.fieldValues)
                                    ? it.fieldValues
                                    : [];
                                const mapped = orderedFieldIds.map((fid: string) => {
                                    // Prefer match by fieldId
                                    const found = fv.find(
                                        (v: any) =>
                                            v &&
                                            (String(v.fieldId) === fid ||
                                                String(v.fieldName || "") === fid)
                                    );
                                    if (found) return found;
                                    // Fallback: attempt to match using raw metadata
                                    const foundAlt = fv.find((v: any) => {
                                        try {
                                            return (
                                                (v &&
                                                    v.raw &&
                                                    v.raw.field &&
                                                    String(v.raw.field.id) === fid) ||
                                                (v &&
                                                    v.raw &&
                                                    v.raw.field &&
                                                    String(v.raw.field.name) === fid)
                                            );
                                        } catch {
                                            return false;
                                        }
                                    });
                                    // If still not found, return a missing placeholder for that field
                                    return (
                                        foundAlt || {
                                            type: "missing",
                                            fieldId: fid,
                                            raw: null,
                                        }
                                    );
                                });
                                return { ...it, fieldValues: mapped };
                            }
                        );

                        effectiveSnapshot = {
                            ...effectiveSnapshot,
                            fields: ordered,
                            items: newItems,
                            details: (view as any)?.details
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
            itemsCount
        };
    }
}
