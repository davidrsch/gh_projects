import * as vscode from 'vscode';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { connectToCDP, findWebviewPage, captureArtifacts } from './playwrightHelpers';
import { ScreenshotHelper } from './helpers/screenshotHelper';
import { HTMLReportGenerator } from './helpers/htmlReportGenerator';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

interface TestCommandResponse {
    success?: boolean;
    error?: string;
    [key: string]: any;
}

// Helper to send test command and wait for response
async function sendTestCommand<T = TestCommandResponse>(
    panel: vscode.WebviewPanel,
    command: string,
    params: Record<string, any> = {}
): Promise<T> {
    return new Promise((resolve, reject) => {
        const requestId = `test-${Date.now()}-${Math.random()}`;
        const timeout = setTimeout(() => {
            reject(new Error(`Test command timeout: ${command}`));
        }, 10000);

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

export async function run() {
    const outDir = path.resolve(__dirname, '../../../out/test-artifacts');
    const reportPath = path.join(outDir, 'test-report.html');

    const screenshots = new ScreenshotHelper(outDir, 'extension-ui-test');
    const report = new HTMLReportGenerator('GitHub Projects Extension UI Tests');

    console.log('Starting Extension UI Tests...');

    // 1. Validate Environment Variables
    const token = process.env.GH_PROJECTS_TOKEN_FOR_TESTING;
    const projectId = process.env.GH_PROJECTS_TEST_PROJECT_ID;

    console.log('Env Vars Check:', {
        hasToken: !!token,
        projectId: projectId,
        cwd: process.cwd()
    });

    if (!token || !projectId) {
        throw new Error('Missing required environment variables');
    }

    console.log('Authentication handled via GH_PROJECTS_TOKEN_FOR_TESTING in AuthenticationManager.');

    // 2. Activate Extension
    report.startStep('Activate Extension');
    const extensionId = 'your-publisher.github-projects';
    console.log(`Activating extension: ${extensionId}`);
    const extension = vscode.extensions.getExtension(extensionId);
    if (!extension) {
        const allExts = vscode.extensions.all.map(e => e.id).join(', ');
        console.error(`Available extensions: ${allExts}`);
        report.endStep('Activate Extension', 'fail', null, undefined, `Extension ${extensionId} not found`);
        await report.generate(reportPath);
        throw new Error(`Extension ${extensionId} not found`);
    }
    await extension.activate();
    console.log('Extension activated.');
    report.endStep('Activate Extension', 'pass');

    // 3. Open Project
    report.startStep('Open Project');
    console.log(`Executing openProject with ID: ${projectId}`);
    await vscode.commands.executeCommand('ghProjects.openProject', { id: projectId, title: 'Test Project' });
    console.log('Open Project command executed.');
    report.endStep('Open Project', 'pass');

    // Wait for panel to be created
    await new Promise(resolve => setTimeout(resolve, 2000));

    const browser = await connectToCDP(9223);
    console.log('Connected to CDP.');

    try {
        const page = await findWebviewPage(browser);
        console.log('Webview page found via CDP.');

        // 📸 Screenshot: Initial state
        report.startStep('Capture Initial State');
        const initialScreenshot = await screenshots.capture(page, 'initial-state');
        report.endStep('Capture Initial State', 'pass', null, initialScreenshot);

        await new Promise(resolve => setTimeout(resolve, 3000));

        // 4. Get webview panel reference
        const { getFirstPanelForTesting } = await import('../../src/webviews/projectDetails');
        const panel = getFirstPanelForTesting();

        if (!panel) {
            console.error('❌ Could not get webview panel reference');
            throw new Error('Webview panel not found');
        }

        console.log('✓ Got webview panel reference');

        // 5. Run UI tests
        report.startStep('Get Project Info');
        console.log('\n--- Getting Project Info ---');
        const projectInfo: any = await sendTestCommand(panel, 'test:getProjectInfo');
        console.log(`✓ Project: ${projectInfo.projectTitle}`);
        console.log(`✓ Total views: ${projectInfo.totalViews}`);
        console.log(`✓ Views found: ${projectInfo.views.length}`);
        report.endStep('Get Project Info', 'pass', projectInfo);

        if (projectInfo.views.length === 0) {
            console.warn('⚠ No views found in project');
            console.log('✅ Test completed (no views to test)');
            await report.generate(reportPath);
            return;
        }

        // Test each view
        for (const view of projectInfo.views) {
            const viewStepName = `Test View: ${view.name} (${view.layout})`;
            report.startStep(viewStepName);
            console.log(`\n--- Testing view: "${view.name}" (index ${view.index}, layout: ${view.layout}) ---`);

            // Click the tab (index + 1 because overview is tab 0)
            const tabResult: any = await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
            if (tabResult.success) {
                console.log(`✓ Clicked tab ${tabResult.tabIndex}`);
            } else {
                console.error(`❌ Failed to click tab: ${tabResult.error}`);
                report.endStep(viewStepName, 'fail', null, undefined, tabResult.error);
                continue;
            }

            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 📸 Screenshot: After tab click
            const tabScreenshot = await screenshots.capture(page, `view-${view.index}-${view.name.replace(/\s+/g, '-')}`);

            // Get table info
            const tableInfo: any = await sendTestCommand(panel, 'test:getTableInfo');

            if (!tableInfo.hasContainer) {
                console.log(`  ℹ No table container found (likely not a table view)`);
                report.endStep(viewStepName, 'skip', { reason: 'Not a table view' }, tabScreenshot);
                continue;
            }

            console.log(`  ✓ Table container found`);
            console.log(`  ✓ Row count: ${tableInfo.rowCount}`);
            console.log(`  ✓ Slice items: ${tableInfo.sliceItemCount}`);

            if (tableInfo.rowCount > 0) {
                console.log(`  ✓ First row ID: ${tableInfo.firstRowId}`);

                // Test row click
                const clickResult: any = await sendTestCommand(panel, 'test:clickRow', { rowIndex: 0 });
                if (clickResult.success) {
                    console.log(`  ✓ Clicked row 0 (item: ${clickResult.itemId})`);
                } else {
                    console.warn(`  ⚠ Failed to click row: ${clickResult.error}`);
                }

                // Check styles of first row
                const styleResult: any = await sendTestCommand(panel, 'test:getStyles', { selector: `[data-gh-item-id="${tableInfo.firstRowId}"]` });
                if (styleResult.success) {
                    console.log(`  ✓ Row style - Display: ${styleResult.display}`);
                }

                report.endStep(viewStepName, 'pass', {
                    rowCount: tableInfo.rowCount,
                    sliceItems: tableInfo.sliceItemCount,
                    firstRowId: tableInfo.firstRowId
                }, tabScreenshot);
            } else {
                console.warn('  ⚠ No rows found in table');
                report.endStep(viewStepName, 'pass', { rowCount: 0 }, tabScreenshot);
            }
        }

        // 📸 Final screenshot
        report.startStep('Capture Final State');
        const finalScreenshot = await screenshots.capture(page, 'final-state');
        report.endStep('Capture Final State', 'pass', null, finalScreenshot);

        console.log('\n✅ All table view UI tests completed!');

        // Generate HTML report
        await report.generate(reportPath);

    } catch (error: any) {
        console.error('Test Failed:', error);
        try {
            const page = await findWebviewPage(browser);
            const errorScreenshot = await screenshots.capture(page, 'error-state');
            await captureArtifacts(page, 'failure', path.resolve(__dirname, '../../../../out/test-artifacts'));

            // Still generate report even on failure
            report.endStep('Test Execution', 'fail', null, errorScreenshot, error.message);
            await report.generate(reportPath);
        } catch (e) {
            console.error('Failed to capture error artifacts:', e);
        }
        throw error;
    } finally {
        await browser.close();
    }
}
