import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

/**
 * Conservative update-field roundtrip: send `test:updateField` and ensure the
 * extension acknowledges and returns a result. Does not assert UI refresh.
 */
export async function runUpdateFieldRoundtrip(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };

    report.startStep('Update Field Roundtrip', 'Send updateField and verify ack/result');
    try {
        const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
        if (!tableInfo || !Array.isArray(tableInfo.items) || tableInfo.items.length === 0) {
            report.endStep('Update Field Roundtrip', 'skip', null, undefined, 'No table items available');
            results.skipped++;
            return results;
        }

        const headers = tableInfo.headers || [];
        const editableHeader = headers.find((h: any) => ['TEXT', 'NUMBER', 'SINGLE_SELECT'].includes(h.dataType));
        if (!editableHeader) {
            report.endStep('Update Field Roundtrip', 'skip', null, undefined, 'No editable header found');
            results.skipped++;
            return results;
        }

        const firstItem = tableInfo.items[0];
        const testValue = editableHeader.dataType === 'NUMBER' ? 123 : 'roundtrip-test';

        const resp = await sendTestCommand(panel, 'test:updateField', {
            itemId: firstItem.id,
            fieldId: editableHeader.id,
            fieldType: (editableHeader.dataType || '').toLowerCase(),
            value: testValue,
        });

        // Resp should contain at least response/result or fields snapshot
        const ok = resp && (resp.response || resp.result || resp.fields);
        if (!ok) {
            await snap(page, screenshots, report, 'update-roundtrip-no-response');
            report.endStep('Update Field Roundtrip', 'fail', null, undefined, 'No ack/result from updateField');
            results.failed++;
            return results;
        }

        await snap(page, screenshots, report, 'update-roundtrip-success');
        report.endStep('Update Field Roundtrip', 'pass', { itemId: firstItem.id, fieldId: editableHeader.id });
        results.passed++;
    } catch (err: any) {
        await snap(page, screenshots, report, 'update-roundtrip-FAIL');
        report.endStep('Update Field Roundtrip', 'fail', null, undefined, err.message);
        results.failed++;
    }

    return results;
}
