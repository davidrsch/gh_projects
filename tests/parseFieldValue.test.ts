import { parseFieldValue } from '../src/lib/parsers/valueParsers';
import { normalizeFieldConfig } from '../src/lib/parsers/fieldConfigParser';

test('parseFieldValue title handling', () => {
  const field = normalizeFieldConfig({ id: 'f-title', name: 'Title', dataType: 'TITLE' } as any);
  const node: any = { __typename: 'ProjectV2ItemFieldTextValue', field, text: 'Hello', itemContent: { id: 'C1' } };
  const parsed = parseFieldValue(node as any);
  expect(parsed).toBeTruthy();
});
