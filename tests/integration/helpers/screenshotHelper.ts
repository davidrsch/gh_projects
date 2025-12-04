import * as playwright from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export class ScreenshotHelper {
    private outDir: string;
    private testName: string;
    private screenshotIndex: number = 0;

    constructor(outDir: string, testName: string) {
        this.outDir = outDir;
        this.testName = testName;

        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
    }

    async capture(page: playwright.Page, label: string) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${this.testName}-${String(this.screenshotIndex).padStart(3, '0')}-${label}-${timestamp}.png`;
        const screenshotPath = path.join(this.outDir, filename);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot captured: ${filename}`);

        this.screenshotIndex++;
        return screenshotPath;
    }

    async captureWebview(page: playwright.Page, label: string) {
        // Try to capture just the webview iframe area
        try {
            const webviewFrame = await page.waitForSelector('iframe.webview.ready', { timeout: 1000 });
            if (webviewFrame) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${this.testName}-${String(this.screenshotIndex).padStart(3, '0')}-webview-${label}-${timestamp}.png`;
                const screenshotPath = path.join(this.outDir, filename);

                await webviewFrame.screenshot({ path: screenshotPath });
                console.log(`📸 Webview screenshot captured: ${filename}`);

                this.screenshotIndex++;
                return screenshotPath;
            }
        } catch (e) {
            console.warn('Could not capture webview screenshot, falling back to full page');
            return this.capture(page, label);
        }
    }
}
