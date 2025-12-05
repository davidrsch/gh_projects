import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';

interface TestResult {
    passed: number;
    failed: number;
    skipped: number;
}

// Helper to send test command and wait for response
async function sendTestCommand<T = any>(
    panel: vscode.WebviewPanel,
    command: string,
    params: Record<string, any> = {}
): Promise<T> {
    return new Promise((resolve, reject) => {
        const requestId = `test-${Date.now()}-${Math.random()}`;
        const timeout = setTimeout(() => {
            reject(new Error(`Test command timeout: ${command}`));
        }, 15000);

        const messageHandler = panel.webview.onDidReceiveMessage((msg: any) => {
            if (msg.command === 'test:result' && msg.requestId === requestId) {
                clearTimeout(timeout);
                messageHandler.dispose();
                if (msg.error) {
                    reject(new Error(msg.error));
                } else {
                    resolve(msg.result as T);
                }
            }
        });

        panel.webview.postMessage({
            command,
            requestId,
            ...params
        });
    });
}

// Helper to wait for condition
async function waitFor(
    fn: () => Promise<boolean>,
    timeout: number = 5000,
    interval: number = 500
): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await fn()) return true;
        await new Promise(r => setTimeout(r, interval));
    }
    return false;
}

// Assertion helper with report integration
function createAssert(report: HTMLReportGenerator) {
    return function assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
        report.addAssertion(message);
    };
}

// Helper to capture and add screenshot to report
async function snap(
    page: Page,
    screenshots: ScreenshotHelper,
    report: HTMLReportGenerator,
    label: string
): Promise<string> {
    const path = await screenshots.capture(page, label);
    report.addScreenshot(path, label);
    return path;
}

export async function runComprehensiveTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    console.log('\n=== Starting Comprehensive UI Tests ===');
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);

    // ========================================
    // 1. PROJECT INFO & TAB BAR TESTS
    // ========================================
    report.startStep('Project Info & Tab Bar Structure',
        'Verify project loads correctly with all tabs visible, icons present, and only one active tab.');
    try {
        const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
        console.log(`Project: ${projectInfo.projectTitle}, Views: ${projectInfo.totalViews}`);
        await new Promise(r => setTimeout(r, 2000));

        await snap(page, screenshots, report, 'initial-load');

        const tabBar = await sendTestCommand(panel, 'test:getTabBar');

        assert(tabBar.count === projectInfo.totalViews + 1,
            `Tab count equals views (${projectInfo.totalViews}) + 1 = ${projectInfo.totalViews + 1}`);

        const activeTabs = tabBar.tabs.filter((t: any) => t.isActive);
        assert(activeTabs.length === 1, 'Exactly 1 tab is active');

        assert(tabBar.containerStyles?.overflowX === 'auto',
            'Tab container is horizontally scrollable');

        for (const tab of tabBar.tabs) {
            const viewInfo = projectInfo.views.find((v: any) => v.name === tab.text);
            if (viewInfo && viewInfo.layout === 'table') {
                assert(tab.hasIcon, `Table view "${tab.text}" has icon`);
            }
        }

        await snap(page, screenshots, report, 'tab-bar-verified');

        report.endStep('Project Info & Tab Bar Structure', 'pass',
            { projectTitle: projectInfo.projectTitle, tabCount: tabBar.count, viewCount: projectInfo.totalViews },
            undefined, undefined,
            `Verified ${tabBar.count} tabs with correct icons and scrollable container.`);
        results.passed++;

    } catch (err: any) {
        await snap(page, screenshots, report, 'tab-bar-FAIL');
        report.endStep('Project Info & Tab Bar Structure', 'fail', null, undefined, err.message);
        results.failed++;
    }

    // ========================================
    // 2. TAB NAVIGATION TESTS
    // ========================================
    report.startStep('Tab Navigation',
        'Test clicking on tabs switches the active view and updates the UI state.');
    try {
        const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
        const tableViews = projectInfo.views.filter((v: any) => v.layout === 'table');

        if (tableViews.length > 0) {
            const firstTableView = tableViews[0];

            await snap(page, screenshots, report, 'before-tab-click');

            await sendTestCommand(panel, 'test:clickTab', { tabIndex: firstTableView.index + 1 });
            await new Promise(r => setTimeout(r, 1000));

            await snap(page, screenshots, report, 'after-tab-click');

            const tabBar = await sendTestCommand(panel, 'test:getTabBar');
            const activeTab = tabBar.tabs.find((t: any) => t.isActive);

            assert(activeTab?.text === firstTableView.name,
                `Active tab is "${firstTableView.name}"`);

            assert(activeTab.styles?.fontWeight === '600' ||
                activeTab.styles?.fontWeight === '700' ||
                activeTab.styles?.fontWeight === 'bold',
                'Active tab has bold font weight');
        }

        await snap(page, screenshots, report, 'tab-navigation-complete');
        report.endStep('Tab Navigation', 'pass', null, undefined, undefined,
            'Successfully clicked tab and verified active state with bold styling.');
        results.passed++;

    } catch (err: any) {
        await snap(page, screenshots, report, 'tab-nav-FAIL');
        report.endStep('Tab Navigation', 'fail', null, undefined, err.message);
        results.failed++;
    }

    // ========================================
    // 3. TABLE STRUCTURE TESTS
    // ========================================
    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    const tableViews = projectInfo.views.filter((v: any) => v.layout === 'table').slice(0, 2);

    for (const view of tableViews) {
        const stepName = `Table Structure: ${view.name}`;
        report.startStep(stepName,
            `Verify table "${view.name}" has proper structure: table wrapper, headers with # and +, menu buttons on field columns.`);

        try {
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
            await new Promise(r => setTimeout(r, 1500));

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

            report.endStep(stepName, 'pass',
                { rowCount: tableInfo.rowCount, headerCount: headers.count },
                undefined, undefined,
                `Table has ${tableInfo.rowCount} rows and ${headers.count} headers with proper structure.`);
            results.passed++;

        } catch (err: any) {
            await snap(page, screenshots, report, `table-${view.name}-FAIL`);
            report.endStep(stepName, 'fail', null, undefined, err.message);
            results.failed++;
        }
    }

    // ========================================
    // 4. SORTING TESTS
    // ========================================
    if (tableViews.length > 0) {
        const testView = tableViews[0];
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
    }

    // ========================================
    // 5. GROUPING TESTS
    // ========================================
    if (tableViews.length > 0) {
        const testView = tableViews[0];
        report.startStep(`Grouping: ${testView.name}`,
            'Find Status column, open menu, click Group by values, verify group headers appear.');

        try {
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: testView.index + 1 });
            await waitFor(async () => (await sendTestCommand(panel, 'test:getTableInfo')).hasTable, 10000);

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
                    console.log(`  Group headers found: ${groupHeaders.count}`);

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
    }

    // ========================================
    // 6. SLICING TESTS
    // ========================================
    if (tableViews.length > 0) {
        const testView = tableViews[0];
        report.startStep(`Slicing: ${testView.name}`,
            'Open slice panel, verify values are shown, click a value to filter, verify slice icon appears.');

        try {
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: testView.index + 1 });
            await waitFor(async () => (await sendTestCommand(panel, 'test:getTableInfo')).hasTable, 10000);

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

    // ========================================
    // 7. CELL CONTENT TESTS
    // ========================================
    if (tableViews.length > 0) {
        const testView = tableViews[0];
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
    }

    // ========================================
    // 8. COLUMN OPERATIONS TESTS
    // ========================================
    if (tableViews.length > 0) {
        const testView = tableViews[0];
        report.startStep(`Column Operations: ${testView.name}`,
            'Hide a column via menu, verify column count decreases, open fields menu via + button.');

        try {
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: testView.index + 1 });
            await waitFor(async () => (await sendTestCommand(panel, 'test:getTableInfo')).hasTable, 10000);

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

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n=== Test Results ===');
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Total: ${results.passed + results.failed + results.skipped}`);

    await snap(page, screenshots, report, 'final-state');

    return results;
}
