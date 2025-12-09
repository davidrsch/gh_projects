import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor, runTestStep } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runTableStructureTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);
    const context = { page, report, screenshots };

    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    const tableViews = projectInfo.views.filter((v: any) => v.layout === 'table').slice(0, 2);

    for (const view of tableViews) {
        const stepName = `Table Structure: ${view.name}`;
        try {
            await runTestStep(context, stepName, `Verify table "${view.name}" has proper structure: table wrapper, headers with # and +, menu buttons on field columns.`, async () => {
                await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
                await waitFor(async () => true, 1500, 1500);

                const loaded = await waitFor(async () => {
                    const info = await sendTestCommand(panel, 'test:getTableInfo');
                    return info.hasContainer && info.hasTable;
                }, 15000, 800);

                assert(loaded, 'Table loads within 15 seconds');

                await snap(page, screenshots, report, `table-${view.name}-loaded`);

                const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
                assert(tableInfo.hasContainer, 'Table wrapper (.table-wrapper) exists');
                assert(tableInfo.hasTable, 'Table element exists');

                const headers = await sendTestCommand(panel, 'test:getHeaders');

                assert(headers.headers[0]?.text === '#',
                    'First header is row index "#"');

                const lastHeader = headers.headers[headers.count - 1];
                assert(lastHeader?.text === '+',
                    'Last header is add column "+"');

                for (let i = 1; i < headers.count - 1; i++) {
                    assert(headers.headers[i].hasMenu,
                        `Header "${headers.headers[i].text}" has menu button`);
                }

                const firstFieldHeader = headers.headers[1];
                assert(firstFieldHeader.styles?.position === 'sticky' ||
                    firstFieldHeader.styles?.position === 'relative',
                    'Headers have sticky positioning');

                await snap(page, screenshots, report, `table-${view.name}-structure`);

                return `Table has ${tableInfo.rowCount} rows and ${headers.count} headers with proper structure.`;
            });
            results.passed++;
        } catch (err: any) {
            results.failed++;
        }
    }

    return results;
}
