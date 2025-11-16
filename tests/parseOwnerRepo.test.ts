import { parseOwnerRepoFromUrl } from '../src/treeView/getProjects';

test('parseOwnerRepoFromUrl parses common forms', () => {
  expect(parseOwnerRepoFromUrl('git@github.com:owner/repo.git')).toEqual({ owner: 'owner', name: 'repo' });
  expect(parseOwnerRepoFromUrl('https://github.com/owner/repo')).toEqual({ owner: 'owner', name: 'repo' });
  expect(parseOwnerRepoFromUrl('git://github.com/owner/repo.git')).toEqual({ owner: 'owner', name: 'repo' });
  expect(parseOwnerRepoFromUrl('')).toBeNull();
});
