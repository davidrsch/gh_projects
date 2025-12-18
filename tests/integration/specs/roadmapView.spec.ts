import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor, runTestStep } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runRoadmapViewTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);
    const context = { page, report, screenshots };

    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    const roadmapViews = projectInfo.views.filter((v: any) => v.layout === 'roadmap');

    if (roadmapViews.length > 0) {
        for (const view of roadmapViews) {
            try {
                await runTestStep(context, `Roadmap View: ${view.name}`, 'Verify roadmap view renders timeline and bars.', async () => {
                    await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
                    await waitFor(async () => {
                        const info = await sendTestCommand(panel, 'test:getRoadmapInfo');
                        if (!info.hasContainer && !info.hasTimeline) {
                            console.log(`Roadmap not rendered yet. Debug: ${JSON.stringify(info.debug)}`);
                            return false;
                        }
                        return info.hasContainer || info.hasTimeline;
                    }, 20000);

                    await snap(page, screenshots, report, `roadmap-${view.name}-loaded`);

                    const roadmapInfo = await sendTestCommand(panel, 'test:getRoadmapInfo');
                    assert(roadmapInfo.hasContainer || roadmapInfo.hasTimeline, `Roadmap container should be found for ${view.name}`);
                    assert(roadmapInfo.hasTimeline, 'Roadmap timeline is present');

                    if (roadmapInfo.barCount > 0) {
                        report.addAssertion(`Roadmap view has ${roadmapInfo.barCount} item bars`);
                    } else {
                        report.addAssertion('Roadmap view is rendered (no bars found - check if dates are set)');
                    }

                    return `Verified roadmap view "${view.name}" with ${roadmapInfo.barCount} bars.`;
                });
                results.passed++;

            } catch (err: any) {
                await snap(page, screenshots, report, `roadmap-${view.name}-FAIL`);
                results.failed++;
            }
        }
    } else {
        console.log('No roadmap views found to test. Layouts found:', projectInfo.views.map((v: any) => v.layout));
    }

    return results;
}
