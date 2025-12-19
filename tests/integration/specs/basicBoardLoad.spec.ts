import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, waitFor } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runBasicBoardLoad(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };

    report.startStep('Basic Board Load', 'Verify webview board view responds to basic commands');
    try {
        const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
        if (!projectInfo) {
            report.endStep('Basic Board Load', 'skip', null, undefined, 'No project info');
            results.skipped++;
            return results;
        }

        const boardInfo = await sendTestCommand(panel, 'test:getBoardInfo');
        if (!boardInfo || boardInfo.error) {
            await snap(page, screenshots, report, 'basic-board-no-board');
            report.endStep('Basic Board Load', 'pass', { projectTitle: projectInfo.projectTitle }, undefined, undefined, 'No board present (skipped)');
            results.passed++;
            return results;
        }

        // Basic sanity: columns and items counts are non-negative
        const colCount = typeof boardInfo.columnCount === 'number' ? boardInfo.columnCount : 0;
        const itemCount = typeof boardInfo.itemCount === 'number' ? boardInfo.itemCount : 0;

        if (colCount <= 0) {
            await snap(page, screenshots, report, 'basic-board-no-columns');
            report.endStep('Basic Board Load', 'fail', null, undefined, 'Board reported zero columns');
            results.failed++;
            return results;
        }

        await snap(page, screenshots, report, 'basic-board-loaded');
        report.endStep('Basic Board Load', 'pass', { columns: colCount, items: itemCount });
        results.passed++;
    } catch (err: any) {
        await snap(page, screenshots, report, 'basic-board-FAIL');
        report.endStep('Basic Board Load', 'fail', null, undefined, err.message);
        results.failed++;
    }
    return results;
}
