import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runRoadmapViewTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);

    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    const roadmapViews = projectInfo.views.filter((v: any) => v.layout === 'roadmap');

    if (roadmapViews.length > 0) {
        for (const view of roadmapViews) {
            report.startStep(`Roadmap View: ${view.name}`, 'Verify roadmap view placeholder verifies.');
            try {
                await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
                await new Promise(r => setTimeout(r, 2000));

                await snap(page, screenshots, report, `roadmap-${view.name}-loaded`);

                // Check for placeholder
                const hasPlaceholder = await sendTestCommand(panel, 'test:evaluate', {
                    expression: `document.body.innerText.includes('Roadmap content not implemented yet')`
                });

                assert(hasPlaceholder, 'Placeholder text found');

                report.endStep(`Roadmap View: ${view.name}`, 'pass', null, undefined, undefined,
                    `Verified roadmap view placeholder.`);
                results.passed++;

            } catch (err: any) {
                await snap(page, screenshots, report, `roadmap-${view.name}-FAIL`);
                report.endStep(`Roadmap View: ${view.name}`, 'fail', null, undefined, err.message);
                results.failed++;
            }
        }
    } else {
        console.log('No roadmap views found to test.');
    }

    return results;
}
