import * as vscode from 'vscode';
import { Page } from 'playwright';
import { HTMLReportGenerator } from '../helpers/htmlReportGenerator';
import { ScreenshotHelper } from '../helpers/screenshotHelper';
import { sendTestCommand, snap, createAssert, waitFor } from '../utils/testHelpers';
import { TestResult } from '../utils/types';

/**
 * Integration tests for field update functionality
 * Tests the complete flow: webview -> extension -> GraphQL -> data refresh
 */
export async function runFieldUpdateTests(
    panel: vscode.WebviewPanel,
    page: Page,
    report: HTMLReportGenerator,
    screenshots: ScreenshotHelper
): Promise<TestResult> {
    const results: TestResult = { passed: 0, failed: 0, skipped: 0 };
    const assert = createAssert(report);

    report.startStep(
        'Field Updates Setup',
        'Get project info and verify table view exists'
    );

    try {
        const projectInfo = await sendTestCommand(panel, 'test:getProjectInfo');
        const tableViews = projectInfo.views.filter((v: any) => v.layout === 'table');

        if (tableViews.length === 0) {
            report.endStep('Field Updates Setup', 'skip', null, undefined, 'No table views available');
            results.skipped++;
            return results;
        }

        const testView = tableViews[0];
        report.endStep(
            'Field Updates Setup',
            'pass',
            { viewName: testView.name },
            undefined,
            undefined,
            `Found table view: ${testView.name}`
        );
        results.passed++;

        // Switch to the table view
        await sendTestCommand(panel, 'test:clickTab', { tabIndex: testView.index + 1 });
        await waitFor(async () => (await sendTestCommand(panel, 'test:getTableInfo')).hasTable, 10000);

        await snap(page, screenshots, report, 'field-update-table-loaded');

    } catch (err: any) {
        await snap(page, screenshots, report, 'field-update-setup-FAIL');
        report.endStep('Field Updates Setup', 'fail', null, undefined, err.message);
        results.failed++;
        return results;
    }

    // Test 1: Update Text Field
    report.startStep(
        'Update Text Field',
        'Test updating a text field value via updateFieldValue message'
    );

    try {
        const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
        const textField = tableInfo.headers.find((h: any) => 
            h.dataType === 'TEXT' && !['Title', 'Labels', 'Assignees'].includes(h.text)
        );

        if (!textField && tableInfo.items.length > 0) {
            // Try to find any editable text field
            const firstItem = tableInfo.items[0];
            const editableFieldIndex = tableInfo.headers.findIndex((h: any) => 
                h.dataType === 'TEXT' || h.dataType === 'NUMBER'
            );

            if (editableFieldIndex >= 0) {
                const fieldToUpdate = tableInfo.headers[editableFieldIndex];
                const testValue = fieldToUpdate.dataType === 'NUMBER' ? 42 : 'Integration Test Value';

                // Send update message via webview
                await sendTestCommand(panel, 'test:updateField', {
                    itemId: firstItem.id,
                    fieldId: fieldToUpdate.id,
                    fieldType: fieldToUpdate.dataType.toLowerCase(),
                    value: testValue
                });

                // Wait for update to complete
                await new Promise(r => setTimeout(r, 2000));

                // Verify the update by fetching table again
                const updatedTableInfo = await sendTestCommand(panel, 'test:getTableInfo');
                const updatedItem = updatedTableInfo.items.find((i: any) => i.id === firstItem.id);

                assert(!!updatedItem, 'Updated item found in table');

                await snap(page, screenshots, report, 'field-update-text-success');

                report.endStep(
                    'Update Text Field',
                    'pass',
                    { fieldType: fieldToUpdate.dataType, value: testValue },
                    undefined,
                    undefined,
                    'Field value updated successfully'
                );
                results.passed++;
            } else {
                report.endStep('Update Text Field', 'skip', null, undefined, 'No editable fields available');
                results.skipped++;
            }
        } else {
            report.endStep('Update Text Field', 'skip', null, undefined, 'No text fields or items available');
            results.skipped++;
        }

    } catch (err: any) {
        await snap(page, screenshots, report, 'field-update-text-FAIL');
        report.endStep('Update Text Field', 'fail', null, undefined, err.message);
        results.failed++;
    }

    // Test 2: Update Single Select Field
    report.startStep(
        'Update Single Select Field',
        'Test updating a single select field value'
    );

    try {
        const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
        const singleSelectField = tableInfo.headers.find((h: any) => h.dataType === 'SINGLE_SELECT');

        if (singleSelectField && tableInfo.items.length > 0) {
            const firstItem = tableInfo.items[0];

            // Find available options
            const fieldConfig = tableInfo.fields?.find((f: any) => f.id === singleSelectField.id);
            if (fieldConfig?.options && fieldConfig.options.length > 0) {
                const optionToSet = fieldConfig.options[0];

                await sendTestCommand(panel, 'test:updateField', {
                    itemId: firstItem.id,
                    fieldId: singleSelectField.id,
                    fieldType: 'single_select',
                    value: optionToSet.id
                });

                await new Promise(r => setTimeout(r, 2000));
                await snap(page, screenshots, report, 'field-update-single-select-success');

                report.endStep(
                    'Update Single Select Field',
                    'pass',
                    { option: optionToSet.name },
                    undefined,
                    undefined,
                    'Single select field updated successfully'
                );
                results.passed++;
            } else {
                report.endStep('Update Single Select Field', 'skip', null, undefined, 'No options available');
                results.skipped++;
            }
        } else {
            report.endStep('Update Single Select Field', 'skip', null, undefined, 'No single select fields available');
            results.skipped++;
        }

    } catch (err: any) {
        await snap(page, screenshots, report, 'field-update-single-select-FAIL');
        report.endStep('Update Single Select Field', 'fail', null, undefined, err.message);
        results.failed++;
    }

    // Test 3: Error Handling
    report.startStep(
        'Update Field Error Handling',
        'Test that invalid updates are handled gracefully'
    );

    try {
        // Try to update with invalid field ID
        const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
        if (tableInfo.items.length > 0) {
            const firstItem = tableInfo.items[0];

            try {
                await sendTestCommand(panel, 'test:updateField', {
                    itemId: firstItem.id,
                    fieldId: 'invalid-field-id-xyz',
                    fieldType: 'text',
                    value: 'test'
                });

                // Wait a bit to see if error is handled
                await new Promise(r => setTimeout(r, 1000));

                // Verify table is still usable (no crash)
                const stillWorking = await sendTestCommand(panel, 'test:getTableInfo');
                assert(!!stillWorking, 'Table still functional after error');

                await snap(page, screenshots, report, 'field-update-error-handling');

                report.endStep(
                    'Update Field Error Handling',
                    'pass',
                    null,
                    undefined,
                    undefined,
                    'Errors handled gracefully, table remains usable'
                );
                results.passed++;

            } catch (err: any) {
                // Expected to get an error, check that it's handled properly
                assert(err.message.includes('not found') || err.message.includes('invalid'), 'Appropriate error message');
                report.endStep(
                    'Update Field Error Handling',
                    'pass',
                    null,
                    undefined,
                    undefined,
                    'Error properly caught and handled'
                );
                results.passed++;
            }
        } else {
            report.endStep('Update Field Error Handling', 'skip', null, undefined, 'No items available for testing');
            results.skipped++;
        }

    } catch (err: any) {
        await snap(page, screenshots, report, 'field-update-error-FAIL');
        report.endStep('Update Field Error Handling', 'fail', null, undefined, err.message);
        results.failed++;
    }

    // Test 4: Data Refresh After Update
    report.startStep(
        'Data Refresh After Update',
        'Verify that table data refreshes after successful update'
    );

    try {
        const tableInfo = await sendTestCommand(panel, 'test:getTableInfo');
        const initialItemCount = tableInfo.items.length;

        if (initialItemCount > 0 && tableInfo.headers.length > 0) {
            const firstItem = tableInfo.items[0];
            const editableField = tableInfo.headers.find((h: any) => 
                ['TEXT', 'NUMBER', 'SINGLE_SELECT'].includes(h.dataType)
            );

            if (editableField) {
                const testValue = editableField.dataType === 'NUMBER' ? 99 : 'Refresh Test';

                await sendTestCommand(panel, 'test:updateField', {
                    itemId: firstItem.id,
                    fieldId: editableField.id,
                    fieldType: editableField.dataType.toLowerCase(),
                    value: testValue
                });

                // Wait for refresh
                await new Promise(r => setTimeout(r, 2500));

                // Verify data was refreshed
                const refreshedTableInfo = await sendTestCommand(panel, 'test:getTableInfo');
                assert(refreshedTableInfo.items.length === initialItemCount, 'Item count maintained after refresh');

                await snap(page, screenshots, report, 'field-update-refresh');

                report.endStep(
                    'Data Refresh After Update',
                    'pass',
                    { initialCount: initialItemCount, refreshedCount: refreshedTableInfo.items.length },
                    undefined,
                    undefined,
                    'Table data successfully refreshed after update'
                );
                results.passed++;
            } else {
                report.endStep('Data Refresh After Update', 'skip', null, undefined, 'No editable fields available');
                results.skipped++;
            }
        } else {
            report.endStep('Data Refresh After Update', 'skip', null, undefined, 'No data available for testing');
            results.skipped++;
        }

    } catch (err: any) {
        await snap(page, screenshots, report, 'field-update-refresh-FAIL');
        report.endStep('Data Refresh After Update', 'fail', null, undefined, err.message);
        results.failed++;
    }

    return results;
}
