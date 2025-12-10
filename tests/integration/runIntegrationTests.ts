import * as path from 'path';
import * as dotenv from 'dotenv';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // 1. Load Environment Variables
        const envPath = path.resolve(__dirname, '../../../.env');
        const result = dotenv.config({ path: envPath });

        if (result.error) {
            console.warn(`Warning: .env file not found at ${envPath}. Ensure environment variables are set manually.`);
        } else {
            console.log(`Loaded environment variables from ${envPath}`);
        }

        // 2. Define Paths
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

        // The path to the test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './extensionUITest.setup.js');

        // 3. Launch Args
        const launchArgs = [
            '--disable-extensions', // Disable other extensions
            '--remote-debugging-port=9223', // Enable CDP for Playwright
            '--disable-features=IsolateOrigins,site-per-process', // Disable site isolation for frame access
            // Use a separate user data dir to avoid messing with the user's VS Code
            `--user-data-dir=${path.resolve(__dirname, '../../../.vscode-test/user-data-2')}`,
            `--extensions-dir=${path.resolve(__dirname, '../../../.vscode-test/extensions')}`,
            // Open the project root as the workspace
            path.resolve(__dirname, '../../../')
        ];

        // 4. Run Tests
        console.log('Running integration tests...');
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs,
            // Pass environment variables to the extension host process
            extensionTestsEnv: process.env as { [key: string]: string }
        });

    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
