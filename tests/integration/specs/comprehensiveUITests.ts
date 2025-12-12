import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { TestResult } from '../utils/types';
import { snap } from '../utils/testHelpers';

// Import modular specs
import { runTabBarTests } from './tabBar.spec';
import { runTableStructureTests } from './tableStructure.spec';
import { runTableInteractionTests } from './tableInteractions.spec';
import { runColumnOperationsTests } from './columnOperations.spec';
import { runBoardViewTests } from './boardView.spec';
import { runRoadmapViewTests } from './roadmapView.spec';
import { runFieldUpdateTests } from './fieldUpdates.spec';

export async function runComprehensiveTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    console.log('\n=== Starting Comprehensive UI Tests (Modular) ===');
    const totalResults: TestResult = { passed: 0, failed: 0, skipped: 0 };

    // Function to aggregate results
    const addResults = (res: TestResult) => {
        totalResults.passed += res.passed;
        totalResults.failed += res.failed;
        totalResults.skipped += res.skipped;
    };

    // 1. Tab Bar Tests
    addResults(await runTabBarTests(panel, page, report, screenshots));

    // 2. Table Structure Tests
    addResults(await runTableStructureTests(panel, page, report, screenshots));

    // 3. Table Interactions (Sort, Group, Slice)
    addResults(await runTableInteractionTests(panel, page, report, screenshots));

    // 4. Column Operations
    addResults(await runColumnOperationsTests(panel, page, report, screenshots));

    // 5. Board View Tests
    addResults(await runBoardViewTests(panel, page, report, screenshots));

    // 6. Roadmap View Tests
    addResults(await runRoadmapViewTests(panel, page, report, screenshots));

    // 7. Field Update Tests
    addResults(await runFieldUpdateTests(panel, page, report, screenshots));

    // Final Summary
    console.log('\n=== Test Results ===');
    console.log(`Passed: ${totalResults.passed}`);
    console.log(`Failed: ${totalResults.failed}`);
    console.log(`Skipped: ${totalResults.skipped}`);
    console.log(`Total: ${totalResults.passed + totalResults.failed + totalResults.skipped}`);

    await snap(page, screenshots, report, 'final-state');

    return totalResults;
}
