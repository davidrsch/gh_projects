import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';

// Helper to send test command and wait for response
export async function sendTestCommand<T = any>(
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
export async function waitFor(
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
export function createAssert(report: HTMLReportGenerator) {
    return function assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
        report.addAssertion(message);
    };
}

// Helper to capture and add screenshot to report
export async function snap(
    page: Page,
    screenshots: ScreenshotHelper,
    report: HTMLReportGenerator,
    label: string
): Promise<string> {
    const path = await screenshots.capture(page, label);
    report.addScreenshot(path, label);
    return path;
}

export async function runTestStep(
    context: {
        page: Page;
        report: HTMLReportGenerator;
        screenshots: ScreenshotHelper;
    },
    stepName: string,
    description: string,
    action: () => Promise<any>
): Promise<boolean> {
    context.report.startStep(stepName, description);
    try {
        const result = await action();
        context.report.endStep(stepName, 'pass', result, undefined, undefined, typeof result === 'string' ? result : undefined);
        return true;
    } catch (err: any) {
        await snap(context.page, context.screenshots, context.report, `${stepName}-FAIL`);
        context.report.endStep(stepName, 'fail', null, undefined, err.message);
        throw err; // Re-throw to let caller handle failure count
    }
}

export async function sendTestClickAddItemMenu(
    panel: vscode.WebviewPanel,
): Promise<any> {
    return sendTestCommand(panel, "test:evaluate", {
        expression: `(() => {
            const row = document.querySelector('tr.add-item-row td[data-add-item-row="true"]');
            if (!row) return { success: false, error: 'Add item row not found' };
            row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            const menu = document.querySelector('.add-item-menu');
            if (!menu) return { success: false, error: 'Add item menu not shown' };
            const items = Array.from(menu.querySelectorAll('.add-item-menu-item')).map(el => el.textContent?.trim());
            return { success: true, items };
        })()`,
    });
}
