import { normalizeFieldConfig } from '../src/lib/parsers/fieldConfigParser';

test('normalizeFieldConfig basic', () => {
  const node: any = {
    id: 'F1',
    name: 'Status',
    dataType: 'SINGLE_SELECT',
    options: [{ id: 'o1', name: 'Open', description: 'open', color: 'green' }],
  };
  const out = normalizeFieldConfig(node as any);
  expect(out.id).toBe('F1');
  expect(out.name).toBe('Status');
  expect(out.options && out.options.length).toBe(1);
});
