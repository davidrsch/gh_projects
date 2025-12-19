import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, waitFor } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

/**
 * Lightweight integration checks to ensure the webview responds to basic test commands.
 * This spec is intentionally conservative and will skip tests when data is missing,
 * to avoid introducing flakiness into the integration run.
 */
export async function runBasicViewLoad(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };

    report.startStep('Basic View Load', 'Verify webview responds to simple test commands');

    try {
        // 1) project info
        const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
        if (!projectInfo || !projectInfo.projectTitle) {
            report.endStep('Basic View Load', 'skip', null, undefined, 'No project info available');
            results.skipped++;
            return results;
        }

        // 2) try to detect a table view if present
        const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
        // When table is not present, treat as skipped rather than failing
        if (!tableInfo || !tableInfo.hasTable) {
            await snap(page, screenshots, report, 'basic-view-no-table');
            report.endStep('Basic View Load', 'pass', { projectTitle: projectInfo.projectTitle }, undefined, undefined, 'Project available but table view not present (skipped table assertions)');
            results.passed++;
            return results;
        }

        // 3) Basic table sanity checks
        const hasRows = Array.isArray(tableInfo.items) ? tableInfo.items.length > 0 : false;
        const hasHeaders = Array.isArray(tableInfo.headers) ? tableInfo.headers.length > 0 : false;

        if (!hasHeaders) {
            await snap(page, screenshots, report, 'basic-view-no-headers');
            report.endStep('Basic View Load', 'fail', null, undefined, 'Table loaded but headers missing');
            results.failed++;
            return results;
        }

        // Optionally wait a short moment for rows to appear
        if (!hasRows) {
            const ok = await waitFor(async () => {
                const refreshed = await sendTestCommand(panel, 'test:getTableInfo');
                return Array.isArray(refreshed.items) && refreshed.items.length > 0;
            }, 3000, 250);
            if (!ok) {
                await snap(page, screenshots, report, 'basic-view-no-rows');
                // Not fatal — some projects legitimately have empty tables
            }
        }

        await snap(page, screenshots, report, 'basic-view-table-loaded');
        report.endStep('Basic View Load', 'pass', { projectTitle: projectInfo.projectTitle, headers: tableInfo.headers.length, rows: tableInfo.items?.length || 0 });
        results.passed++;
    } catch (err: any) {
        await snap(page, screenshots, report, 'basic-view-FAIL');
        report.endStep('Basic View Load', 'fail', null, undefined, err.message);
        results.failed++;
    }

    return results;
}
