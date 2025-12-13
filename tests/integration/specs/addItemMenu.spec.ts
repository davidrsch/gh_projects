import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor, sendTestClickAddItemMenu } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

export async function runAddItemMenuTests(
  panel: vscode.WebviewPanel,
  page: Page,
  report: HTMLReportGenerator,
  screenshots: ScreenshotHelper,
): Promise<TestResult> {
  const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
  const assert = createAssert(report);

  report.startStep(
    'Add Item menu',
    'Verify clicking the + Add item row opens a menu with expected options.',
  );

  try {
    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    const tableViews = projectInfo.views.filter((v: any) => v.layout === 'table');

    if (!tableViews.length) {
      report.endStep('Add Item menu', 'skip', { reason: 'No table views available' });
      results.skipped++;
      return results;
    }

    const view = tableViews[0];
    await sendTestCommand(panel, 'test:clickTab', { tabIndex: view.index + 1 });
    await waitFor(async () => (await sendTestCommand(panel, 'test:getTableInfo')).hasTable, 10000);

    await snap(page, screenshots, report, 'add-item-row-before');

    const menuInfo = await sendTestClickAddItemMenu(panel);
    assert(menuInfo.success, menuInfo.error || 'Add item menu did not open');

    const items = (menuInfo.items || []) as string[];
    const joined = items.join(' ');
    assert(joined.includes('Create new issue'), 'Menu has "Create new issue"');
    assert(joined.includes('Add item from repository'), 'Menu has "Add item from repository"');

    await snap(page, screenshots, report, 'add-item-menu-open');

    report.endStep(
      'Add Item menu',
      'pass',
      { items },
      undefined,
      undefined,
      'Add item menu rendered with expected options.',
    );
    results.passed++;
  } catch (err: any) {
    await snap(page, screenshots, report, 'add-item-menu-FAIL');
    report.endStep('Add Item menu', 'fail', null, undefined, err.message);
    results.failed++;
  }

  return results;
}
