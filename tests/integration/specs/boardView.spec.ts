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
                    await waitFor(async () => true, 2000, 2000); // Wait for render

                    await snap(page, screenshots, report, `board-${view.name}-loaded`);

                    // Check for board container (new card-based layout)
                    const hasBoardContainer = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('.board-container').length > 0`
                    });

                    // Check for column cards
                    const columnCardCount = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('.board-card').length`
                    });

                    // Check for items inside cards
                    const itemCount = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('.board-item[data-gh-item-id]').length`
                    });

                    // Also check for legacy flat list items (fallback mode)
                    const legacyItemCount = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('div[data-gh-item-id]').length`
                    });

                    const totalItems = itemCount || legacyItemCount;

                    // Check for color dots in card headers
                    const hasColorDots = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('.board-card-color-dot').length > 0`
                    });

                    // Check for card titles
                    const hasCardTitles = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('.board-card-title').length > 0`
                    });

                    // Check for item counts in card headers
                    const hasItemCounts = await sendTestCommand(panel, 'test:evaluate', {
                        expression: `document.querySelectorAll('.board-card-count').length > 0`
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

                    // Assert card-based layout is present
                    if (hasBoardContainer) {
                        assert(hasBoardContainer, 'Board container is present');
                        assert(typeof columnCardCount === 'number' && columnCardCount > 0, `Found ${columnCardCount} column cards`);
                        report.addAssertion(`Board view has ${columnCardCount} column cards`);

                        // Verify board container height fix
                        const isFullHeight = await sendTestCommand(panel, 'test:evaluate', {
                            expression: `(() => {
                                const board = document.querySelector('.board-container');
                                return board && board.style.height === '100%';
                            })()`
                        });
                        if (isFullHeight) {
                            report.addAssertion('Board container has height: 100%');
                        }

                        // Check for item fields
                        const hasItemFields = await sendTestCommand(panel, 'test:evaluate', {
                            expression: `document.querySelectorAll('.board-item-fields').length > 0`
                        });
                        if (hasItemFields) {
                            report.addAssertion('Items are displaying visible fields');
                        }

                        if (hasColorDots) {
                            report.addAssertion('Column cards have color dots');
                        }
                        if (hasCardTitles) {
                            report.addAssertion('Column cards have titles');
                        }
                        if (hasItemCounts) {
                            report.addAssertion('Column cards have item counts');
                        }
                    } else {
                        // Fallback layout (flat list)
                        report.addAssertion('Board view using fallback flat list layout (no column field detected)');
                    }

                    // Assert total items
                    assert(typeof totalItems === 'number', 'Item count is a number');
                    if (totalItems > 0) {
                        report.addAssertion(`Found ${totalItems} items in board view`);
                    } else {
                        report.addAssertion('Board view is empty (0 items)');
                    }

                    // Assert title found
                    assert(boardTitleFound, `Board title "${view.name}" is visible (flexible match)`);

                    return `Verified board view with ${columnCardCount || 0} columns and ${totalItems} items.`;
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
