import { buildCandidateFragments } from '../src/lib/helpers';

test('buildCandidateFragments returns array', () => {
  const fr = buildCandidateFragments({ first: 1 });
  expect(Array.isArray(fr)).toBe(true);
});
