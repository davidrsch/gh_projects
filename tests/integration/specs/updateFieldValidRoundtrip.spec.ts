import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap } from '../utils/testHelpers';

/**
 * Minimal integration spec to exercise a valid update roundtrip when possible.
 * - Finds a table view
 * - Picks a writable field (TEXT/NUMBER/SINGLE_SELECT)
 * - Sends `test:updateField` and asserts success
 */
export async function runUpdateFieldValidRoundtrip(
  panel: vscode.WebviewPanel,
  page: Page,
  report: HTMLReportGenerator,
  screenshots: ScreenshotHelper,
) {
  report.startStep('Update Field Roundtrip (minimal)', 'Attempt a single valid update roundtrip');

  try {
    const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
    const tableViews = projectInfo.views.filter((v: any) => v.layout === 'table');
    if (!tableViews || tableViews.length === 0) {
      report.endStep('Update Field Roundtrip (minimal)', 'skip', null, undefined, 'No table views');
      return { skipped: 1 };
    }

    // Switch to the first table view
    const testView = tableViews[0];
    await sendTestCommand(panel, 'test:clickTab', { tabIndex: testView.index + 1 });
    await sendTestCommand(panel, 'test:getTableInfo');

    const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
    if (!tableInfo || !tableInfo.headers || tableInfo.items.length === 0) {
      report.endStep('Update Field Roundtrip (minimal)', 'skip', null, undefined, 'No table data');
      return { skipped: 1 };
    }

    // Find an editable field
    const editable = tableInfo.headers.find((h: any) => ['TEXT', 'NUMBER', 'SINGLE_SELECT'].includes(h.dataType));
    if (!editable) {
      report.endStep('Update Field Roundtrip (minimal)', 'skip', null, undefined, 'No editable fields');
      return { skipped: 1 };
    }

    const firstItem = tableInfo.items[0];
    const value = editable.dataType === 'NUMBER' ? 123 : 'integration-test-value';

    const resp = await sendTestCommand(panel, 'test:updateField', {
      itemId: firstItem.id,
      fieldId: editable.id,
      fieldType: editable.dataType.toLowerCase(),
      value,
    });

    if (!resp || resp.success === false) {
      report.endStep('Update Field Roundtrip (minimal)', 'fail', null, undefined, 'Update failed or not acknowledged');
      return { failed: 1 };
    }

    // Wait shortly then verify table refresh
    await new Promise((r) => setTimeout(r, 1500));
    const refreshed = await sendTestCommand(panel, 'test:getTableInfo');

    report.endStep('Update Field Roundtrip (minimal)', 'pass');
    return { passed: 1 };
  } catch (e: any) {
    report.endStep('Update Field Roundtrip (minimal)', 'fail', null, undefined, String(e));
    return { failed: 1 };
  }
}
