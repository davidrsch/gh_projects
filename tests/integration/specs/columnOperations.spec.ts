import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runColumnOperationsTests(
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

        // --- CELL CONTENT ---
        report.startStep(`Cell Content: ${testView.name}`,
            'Verify Title cell contains link and SVG icon, index cell shows row number.');

        try {
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: testView.index + 1 });
            await waitFor(async () => (await sendTestCommand(panel, 'test:getTableInfo')).hasTable, 10000);

            const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');

            if (tableInfo.rowCount > 0) {
                await snap(page, screenshots, report, 'cell-content-view');

                const titleCell = await sendTestCommand(panel, 'test:getCellContent', {
                    rowIndex: 0, colIndex: 1
                });
                assert(titleCell.hasLink, 'Title cell contains a clickable link');
                assert(titleCell.hasSvg, 'Title cell has status indicator SVG');

                const indexCell = await sendTestCommand(panel, 'test:getCellContent', {
                    rowIndex: 0, colIndex: 0
                });
                assert(indexCell.text === '1', 'First row index shows "1"');

                await snap(page, screenshots, report, 'cell-content-verified');

                report.endStep(`Cell Content: ${testView.name}`, 'pass',
                    { titleHasLink: titleCell.hasLink, hasSvg: titleCell.hasSvg },
                    undefined, undefined,
                    'Title cell has link and SVG, index cell correctly shows row number.');
                results.passed++;
            } else {
                report.endStep(`Cell Content: ${testView.name}`, 'skip',
                    { reason: 'No rows in table' });
                results.skipped++;
            }

        } catch (err: any) {
            await snap(page, screenshots, report, 'cell-content-FAIL');
            report.endStep(`Cell Content: ${testView.name}`, 'fail', null, undefined, err.message);
            results.failed++;
        }

        // --- COLUMN HIDING ---
        report.startStep(`Column Operations: ${testView.name}`,
            'Hide a column via menu, verify column count decreases, open fields menu via + button.');

        try {
            await snap(page, screenshots, report, 'column-ops-before');

            const headersBefore = await sendTestCommand(panel, 'test:getHeaders');
            const initialCount = headersBefore.count;

            const hidableIndex = headersBefore.headers.findIndex(
                (h: any, i: number) => i > 1 && i < initialCount - 1 && !h.text?.includes('Title')
            );

            if (hidableIndex > 0) {
                const columnName = headersBefore.headers[hidableIndex].text;

                await sendTestCommand(panel, 'test:clickHeaderMenu', { headerIndex: hidableIndex });
                await new Promise(r => setTimeout(r, 500));

                await snap(page, screenshots, report, 'column-ops-menu');

                const menu = await sendTestCommand(panel, 'test:getMenu');
                const hideOption = menu.items.find((i: any) => i.text?.includes('Hide field'));

                if (hideOption) {
                    await sendTestCommand(panel, 'test:clickMenuItem', { text: 'Hide field' });
                    await new Promise(r => setTimeout(r, 1000));

                    await snap(page, screenshots, report, 'column-hidden');

                    const headersAfter = await sendTestCommand(panel, 'test:getHeaders');
                    assert(headersAfter.count === initialCount - 1,
                        `Column count decreased from ${initialCount} to ${initialCount - 1}`);

                    await sendTestCommand(panel, 'test:clickAddColumn');
                    await new Promise(r => setTimeout(r, 500));

                    await snap(page, screenshots, report, 'fields-menu-open');
                    await sendTestCommand(panel, 'test:closeMenu');

                    report.endStep(`Column Operations: ${testView.name}`, 'pass',
                        { hiddenColumn: columnName, beforeCount: initialCount, afterCount: headersAfter.count },
                        undefined, undefined,
                        `Hidden "${columnName}" column, opened fields menu.`);
                    results.passed++;
                } else {
                    await sendTestCommand(panel, 'test:closeMenu');
                    report.endStep(`Column Operations: ${testView.name}`, 'skip',
                        { reason: 'No hide option available' });
                    results.skipped++;
                }
            } else {
                report.endStep(`Column Operations: ${testView.name}`, 'skip',
                    { reason: 'No hidable column found' });
                results.skipped++;
            }

        } catch (err: any) {
            await snap(page, screenshots, report, 'column-ops-FAIL');
            await sendTestCommand(panel, 'test:closeMenu').catch(() => { });
            report.endStep(`Column Operations: ${testView.name}`, 'fail', null, undefined, err.message);
            results.failed++;
        }
    }

    return results;
}
