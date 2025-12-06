import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runTabBarTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);

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

    // Navigation Tests
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

    // Stress Test: Rapid Tab Switching
    report.startStep('Stress Test: Rapid Tab Switching', 'Click multiple tabs in quick succession to verify stability.');
    try {
        const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
        if (projectInfo.views.length >= 2) {
            // Click tab 0, then 1, then 0 quickly
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: 0 });
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: 1 });
            await sendTestCommand(panel, 'test:clickTab', { tabIndex: 0 });

            await new Promise(r => setTimeout(r, 1000));

            const tabBar = await sendTestCommand(panel, 'test:getTabBar');
            const activeTabs = tabBar.tabs.filter((t: any) => t.isActive);

            assert(activeTabs.length === 1, 'Only 1 tab active after rapid switching');
            assert(activeTabs[0].index === 0, 'Final state reflects last click (View 1)');

            report.endStep('Stress Test: Rapid Tab Switching', 'pass', null, undefined, undefined, 'Handled rapid clicks without error.');
            results.passed++;
        } else {
            report.endStep('Stress Test: Rapid Tab Switching', 'skip', { reason: 'Not enough views' });
            results.skipped++;
        }
    } catch (err: any) {
        report.endStep('Stress Test: Rapid Tab Switching', 'fail', null, undefined, err.message);
        results.failed++;
    }

    return results;
}
