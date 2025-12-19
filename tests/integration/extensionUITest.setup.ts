import * as vscode from 'vscode';
import * as path from 'path';
import { connectToCDP, findWebviewPage, captureArtifacts } from './playwrightHelpers';
import { ScreenshotHelper } from './helpers/screenshotHelper';
import { HTMLReportGenerator } from './helpers/htmlReportGenerator';
import * as dotenv from 'dotenv';
import { runComprehensiveTests } from './specs/comprehensiveUITests';
import { sendTestCommand } from './utils/testHelpers';

// Load .env for local development only.
// In CI, we rely on GitHub environment variables instead.
if (!process.env.CI) {
    dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
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

        // 5. Quick guard: detect GitHub API rate limit in webview debug output and abort early (skip run)
        try {
            const checks = [
                { cmd: 'test:getTableInfo', timeout: 8000 },
                { cmd: 'test:getProjectInfo', timeout: 5000 },
                { cmd: 'test:getRoadmapInfo', timeout: 5000 }
            ];

            for (const c of checks) {
                try {
                    const res = await sendTestCommand(panel, c.cmd, { timeout: c.timeout });
                    const debugHtml = res && res.debug && res.debug.innerHTML ? String(res.debug.innerHTML) : '';
                    const low = debugHtml.toLowerCase();
                    if (low.includes('rate limit') || low.includes('api rate limit') || low.includes('rate-limited') || low.includes('rate_limit')) {
                        report.endStep('Activate Extension', 'skip', null, undefined, 'Detected GitHub API rate limit in webview; skipping integration run');
                        await report.generate(reportPath);
                        console.warn('Skipping integration tests: GitHub API rate limit detected in webview debug output.');
                        return;
                    }
                } catch (innerErr) {
                    // Ignore single-check failures — continue to next; we don't want to be noisy here
                    console.warn(`Rate-limit guard check for ${c.cmd} failed (continuing):`, String(innerErr));
                }
            }
        } catch (e) {
            console.warn('Rate-limit guard overall check failed (continuing):', String(e));
        }

        // 6. Run Comprehensive UI Tests
        await runComprehensiveTests(panel, page, report, screenshots);

        console.log('\n✅ All UI tests completed!');

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
