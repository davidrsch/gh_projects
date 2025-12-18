import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor, runTestStep } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runBoardViewTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);
    const context = { page, report, screenshots };

    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    // Find views that are NOT table (assuming they are board or roadmap)
    const boardViews = projectInfo.views.filter((v: any) => v.layout === 'board');

    if (boardViews.length > 0) {
        for (const view of boardViews) {
            try {
                await runTestStep(context, `Board View: ${view.name}`, 'Verify board view renders cards in columns.', async () => {
                    await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
                    await waitFor(async () => {
                        const info = await sendTestCommand(panel, 'test:getBoardInfo');
                        if (!info.hasContainer && info.itemCount === 0) {
                            console.log(`Board not rendered yet (itemCount: 0). Debug: ${JSON.stringify(info.debug)}`);
                            return false;
                        }
                        return info.hasContainer || info.itemCount > 0;
                    }, 20000);

                    const boardInfo = await sendTestCommand(panel, 'test:getBoardInfo');
                    assert(boardInfo.hasContainer || boardInfo.itemCount > 0, `Board container should be found for ${view.name}`);

                    if (boardInfo.hasContainer) {
                        assert(boardInfo.hasContainer, 'Board container is present');
                        assert(boardInfo.columnCount > 0, `Found ${boardInfo.columnCount} columns`);

                        if (boardInfo.itemCount > 0) {
                            report.addAssertion(`Board view has ${boardInfo.itemCount} items across ${boardInfo.columnCount} columns`);
                        } else {
                            report.addAssertion('Board view is empty (0 items)');
                        }

                        // Verify column titles
                        if (boardInfo.columns && boardInfo.columns.length > 0) {
                            const columnTitles = boardInfo.columns.map((c: any) => c.title).filter(Boolean);
                            report.addAssertion(`Column titles detected: ${columnTitles.join(', ')}`);
                        }
                    } else {
                        // Fallback check for legacy items if container is missing
                        assert(boardInfo.itemCount > 0, 'Found items in board view (fallback layout)');
                    }

                    return `Verified board view "${view.name}" with ${boardInfo.columnCount} columns and ${boardInfo.itemCount} items.`;
                });
                results.passed++;
            } catch (err: any) {
                await snap(page, screenshots, report, `board-${view.name}-FAIL`);
                results.failed++;
            }
        }
    } else {
        console.log('No board views found to test. Layouts found:', projectInfo.views.map((v: any) => v.layout));
    }

    return results;
}
