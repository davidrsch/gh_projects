import * as playwright from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load .env if not already loaded (useful if running helpers in isolation or early)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export async function connectToCDP(port: number = 9222): Promise<playwright.Browser> {
    try {
        const browser = await playwright.chromium.connectOverCDP(`http://localhost:${port}`);
        return browser;
    } catch (error) {
        console.error(`Failed to connect to CDP on port ${port}:`, error);
        throw error;
    }
}

export async function findWebviewPage(browser: playwright.Browser): Promise<playwright.Page> {
    const context = browser.contexts()[0];
    // VS Code webviews are iframes within the workbench, not separate pages
    // Find the workbench page
    for (let i = 0; i < 60; i++) {
        const pages = context.pages();
        console.log(`[findWebviewPage] Attempt ${i + 1}/60. Found ${pages.length} pages`);

        for (const page of pages) {
            const url = page.url();
            // Look for the workbench page
            if (url.includes('workbench.html')) {
                console.log(`[findWebviewPage] Found workbench page, looking for webview iframe...`);
                // Wait for a webview iframe to be present
                try {
                    const iframe = await page.waitForSelector('iframe.webview.ready', { timeout: 2000 });
                    if (iframe) {
                        console.log(`[findWebviewPage] Found webview iframe!`);
                        return page;
                    }
                } catch (e) {
                    // Webview not ready yet, continue polling
                    console.log(`[findWebviewPage] Webview iframe not ready yet...`);
                }
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Could not find VS Code webview iframe in workbench');
}

export async function waitForWebviewContent(page: playwright.Page): Promise<playwright.Page> {
    console.log('[waitForWebviewContent] Looking for webview iframe...');

    // Wait for the webview iframe to be fully attached
    await page.waitForSelector('iframe.webview.ready', { state: 'attached', timeout: 30000 });
    console.log('[waitForWebviewContent] Webview iframe is attached');

    // Give the webview content time to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('[waitForWebviewContent] Webview content should be loaded');

    // Return the page - we'll use page.evaluate() to interact with webview content
    return page;
}

export async function captureArtifacts(page: playwright.Page, testName: string, outDir: string) {
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(outDir, `${testName}-${timestamp}.png`);
    const htmlPath = path.join(outDir, `${testName}-${timestamp}.html`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    const html = await page.content();
    fs.writeFileSync(htmlPath, html);

    console.log(`Artifacts captured: ${screenshotPath}, ${htmlPath}`);
}
