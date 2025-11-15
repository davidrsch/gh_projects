import { aggregateMaps } from '../src/lib/aggregation';

test('aggregateMaps with empty items', () => {
  const res = aggregateMaps([] as any);
  expect(res).toBeTruthy();
  expect(Array.isArray(res.repoNames)).toBe(true);
});
