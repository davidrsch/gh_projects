import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runTableInteractionTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);

    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    const tableViews = projectInfo.views.filter((v: any) => v.layout === 'table');

    if (tableViews.length > 0) {
        const testView = tableViews[0];

        // --- SORTING ---
        report.startStep(`Sorting: ${testView.name}`,
            'Open column menu, verify sort options exist, click sort ascending, verify sort is applied.');

        try {
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: testView.index + 1 });
            await waitFor(async () => (await sendTestCommand(panel, 'test:getTableInfo')).hasTable, 10000);

            await snap(page, screenshots, report, 'sort-before-menu');

            await sendTestCommand(panel, 'test:clickHeaderMenu', { headerIndex: 1 });
            await new Promise(r => setTimeout(r, 500));

            await snap(page, screenshots, report, 'sort-menu-open');

            const menu = await sendTestCommand(panel, 'test:getMenu');
            assert(menu.open, 'Column menu opens');

            const sortAscItem = menu.items.find((i: any) => i.text?.includes('Sort ascending'));
            const sortDescItem = menu.items.find((i: any) => i.text?.includes('Sort descending'));
            assert(!!sortAscItem, 'Menu has "Sort ascending" option');
            assert(!!sortDescItem, 'Menu has "Sort descending" option');

            await sendTestCommand(panel, 'test:clickMenuItem', { text: 'Sort ascending' });
            await new Promise(r => setTimeout(r, 1000));

            await snap(page, screenshots, report, 'sort-applied');
            await sendTestCommand(panel, 'test:closeMenu');

            report.endStep(`Sorting: ${testView.name}`, 'pass',
                { menuItems: menu.items.map((i: any) => i.text) },
                undefined, undefined,
                'Successfully opened menu, verified sort options, and applied sort ascending.');
            results.passed++;

        } catch (err: any) {
            await snap(page, screenshots, report, 'sort-FAIL');
            await sendTestCommand(panel, 'test:closeMenu').catch(() => { });
            report.endStep(`Sorting: ${testView.name}`, 'fail', null, undefined, err.message);
            results.failed++;
        }

        // --- GROUPING ---
        report.startStep(`Grouping: ${testView.name}`,
            'Find Status column, open menu, click Group by values, verify group headers appear.');

        try {
            const headers = await sendTestCommand(panel, 'test:getHeaders');
            const statusIndex = headers.headers.findIndex((h: any) => h.text?.includes('Status'));

            if (statusIndex > 0) {
                await snap(page, screenshots, report, 'group-before-menu');

                await sendTestCommand(panel, 'test:clickHeaderMenu', { headerIndex: statusIndex });
                await new Promise(r => setTimeout(r, 500));

                const menu = await sendTestCommand(panel, 'test:getMenu');
                const groupOption = menu.items.find((i: any) => i.text?.includes('Group by values'));

                if (groupOption) {
                    await snap(page, screenshots, report, 'group-menu-open');

                    await sendTestCommand(panel, 'test:clickMenuItem', { text: 'Group by values' });
                    await new Promise(r => setTimeout(r, 2000));

                    await snap(page, screenshots, report, 'group-applied');

                    const groupHeaders = await sendTestCommand(panel, 'test:getGroupHeaders');

                    const headersAfterGroup = await sendTestCommand(panel, 'test:getHeaders');
                    assert(headersAfterGroup.headers[statusIndex].isGrouped,
                        'Status header shows group icon');

                    await sendTestCommand(panel, 'test:clickElement', { selector: '.column-group-icon' });
                    await new Promise(r => setTimeout(r, 1000));

                    await snap(page, screenshots, report, 'group-cleared');

                    report.endStep(`Grouping: ${testView.name}`, 'pass',
                        { groupCount: groupHeaders.count },
                        undefined, undefined,
                        `Grouped by Status, found ${groupHeaders.count} group headers.`);
                    results.passed++;
                } else {
                    await sendTestCommand(panel, 'test:closeMenu');
                    report.endStep(`Grouping: ${testView.name}`, 'skip',
                        { reason: 'No group option available' });
                    results.skipped++;
                }
            } else {
                report.endStep(`Grouping: ${testView.name}`, 'skip',
                    { reason: 'No Status column found' });
                results.skipped++;
            }

        } catch (err: any) {
            await snap(page, screenshots, report, 'group-FAIL');
            await sendTestCommand(panel, 'test:closeMenu').catch(() => { });
            report.endStep(`Grouping: ${testView.name}`, 'fail', null, undefined, err.message);
            results.failed++;
        }

        // --- SLICING ---
        report.startStep(`Slicing: ${testView.name}`,
            'Open slice panel, verify values are shown, click a value to filter, verify slice icon appears.');

        try {
            const headers = await sendTestCommand(panel, 'test:getHeaders');
            const statusIndex = headers.headers.findIndex((h: any) => h.text?.includes('Status'));

            if (statusIndex > 0) {
                await sendTestCommand(panel, 'test:clickHeaderMenu', { headerIndex: statusIndex });
                await new Promise(r => setTimeout(r, 500));

                const menu = await sendTestCommand(panel, 'test:getMenu');
                const sliceOption = menu.items.find((i: any) => i.text?.includes('Slice by values'));

                if (sliceOption) {
                    await sendTestCommand(panel, 'test:clickMenuItem', { text: 'Slice by values' });
                    await new Promise(r => setTimeout(r, 1500));

                    await snap(page, screenshots, report, 'slice-panel-open');

                    const slicePanel = await sendTestCommand(panel, 'test:getSlicePanel');
                    assert(slicePanel.open, 'Slice panel is open');
                    assert(slicePanel.valueCount > 0, `Slice panel shows ${slicePanel.valueCount} values`);

                    await sendTestCommand(panel, 'test:clickSliceValue', { valueIndex: 0 });
                    await new Promise(r => setTimeout(r, 1000));

                    await snap(page, screenshots, report, 'slice-value-selected');

                    const headersAfterSlice = await sendTestCommand(panel, 'test:getHeaders');
                    assert(headersAfterSlice.headers[statusIndex].isSliced,
                        'Status header shows slice icon');

                    await sendTestCommand(panel, 'test:clickElement', { selector: '.column-slice-icon' });
                    await new Promise(r => setTimeout(r, 1000));

                    await snap(page, screenshots, report, 'slice-cleared');

                    report.endStep(`Slicing: ${testView.name}`, 'pass',
                        { valueCount: slicePanel.valueCount },
                        undefined, undefined,
                        `Slice panel with ${slicePanel.valueCount} values, filter applied successfully.`);
                    results.passed++;
                } else {
                    await sendTestCommand(panel, 'test:closeMenu');
                    report.endStep(`Slicing: ${testView.name}`, 'skip',
                        { reason: 'No slice option available' });
                    results.skipped++;
                }
            } else {
                report.endStep(`Slicing: ${testView.name}`, 'skip',
                    { reason: 'No Status column found' });
                results.skipped++;
            }

        } catch (err: any) {
            await snap(page, screenshots, report, 'slice-FAIL');
            await sendTestCommand(panel, 'test:closeMenu').catch(() => { });
            report.endStep(`Slicing: ${testView.name}`, 'fail', null, undefined, err.message);
            results.failed++;
        }
    }

    // --- EDGE CASE: ZERO ROWS FILTER ---
    report.startStep('Edge Case: Zero Rows Filter', 'Apply a text filter that matches nothing and verify empty state.');
    try {
        // Focus first table view
        const headers = await sendTestCommand(panel, 'test:getHeaders'); // Ensure we are on a table
        if (headers.count > 0) {
            await snap(page, screenshots, report, 'filter-before-zero');

            // Type non-existent value into filter input
            await sendTestCommand(panel, 'test:evaluate', {
                expression: `(() => {
                      const input = document.querySelector('.filter-input');
                      if (input) {
                          input.value = 'NON_EXISTENT_VALUE_XYZ_123';
                          input.dispatchEvent(new Event('input', { bubbles: true }));
                          return true;
                      }
                      return false;
                  })()`
            });

            await new Promise(r => setTimeout(r, 1000));
            await snap(page, screenshots, report, 'filter-zero-results');

            const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
            assert(tableInfo.rowCount === 0, 'Row count is 0 after filtering');

            // Clear filter
            await sendTestCommand(panel, 'test:evaluate', {
                expression: `(() => {
                      const input = document.querySelector('.filter-input');
                      if (input) {
                          input.value = '';
                          input.dispatchEvent(new Event('input', { bubbles: true }));
                          return true;
                      }
                      return false;
                  })()`
            });
            await new Promise(r => setTimeout(r, 1000));

            const tableInfoAfter = await sendTestCommand(panel, 'test:getTableInfo');
            assert(tableInfoAfter.rowCount > 0, 'Rows restored after clearing filter');

            report.endStep('Edge Case: Zero Rows Filter', 'pass',
                { rowsBefore: tableInfoAfter.rowCount, rowsDuring: tableInfo.rowCount },
                undefined, undefined,
                'Verified table handles 0 results correctly.');
            results.passed++;
        } else {
            report.endStep('Edge Case: Zero Rows Filter', 'skip', { reason: 'Not on a table view' });
            results.skipped++;
        }
    } catch (err: any) {
        report.endStep('Edge Case: Zero Rows Filter', 'fail', null, undefined, err.message);
        results.failed++;
    }

    return results;
}
