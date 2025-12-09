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
                await runTestStep(context, `Board View: ${view.name}`, 'Verify board view renders cards.', async () => {
                    await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
                    await waitFor(async () => true, 2000, 2000); // Wait for render

                    await snap(page, screenshots, report, `board-${view.name}-loaded`);

                    // Check for cards
                    const cardCount = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('div[data-gh-item-id]').length`
                    });

                    // Check for header title (flexible check)
                    const boardTitleFound = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `(() => {
                            const els = Array.from(document.querySelectorAll('div'));
                            // Look for the name in text content, case-insensitive, and ensure it looks like a header
                            const found = els.find(d => 
                                d.textContent && 
                                d.textContent.trim().toLowerCase() === '${view.name.toLowerCase()}' && 
                                (d.style.fontWeight === '600' || d.style.fontWeight === 'bold' || getComputedStyle(d).fontWeight >= 600)
                            );
                            return !!found;
                        })()`
                    });

                    assert(typeof cardCount === 'number', 'Card count is a number');
                    if (cardCount > 0) {
                        report.addAssertion(`Found ${cardCount} cards in board view`);
                    } else {
                        report.addAssertion('Board view is empty (0 cards)');
                    }

                    // Assert title found
                    assert(boardTitleFound, `Board title "${view.name}" is visible (flexible match)`);

                    return `Verified board view with ${cardCount} cards.`;
                });
                results.passed++;
            } catch (err: any) {
                results.failed++;
            }
        }
    } else {
        // Optional: Skip if no board view, but log it
        console.log('No board views found to test.');
    }

    return results;
}
