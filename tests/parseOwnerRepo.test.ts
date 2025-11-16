import { parseOwnerRepoFromUrl } from '../src/treeView/getProjects';

test('parseOwnerRepoFromUrl parses common forms', () => {
  expect(parseOwnerRepoFromUrl('git@github.com:owner/repo.git')).toEqual({ owner: 'owner', name: 'repo' });
  expect(parseOwnerRepoFromUrl('https://github.com/owner/repo')).toEqual({ owner: 'owner', name: 'repo' });
  expect(parseOwnerRepoFromUrl('git://github.com/owner/repo.git')).toEqual({ owner: 'owner', name: 'repo' });
  expect(parseOwnerRepoFromUrl('')).toBeNull();
});

test('parseOwnerRepoFromUrl edge cases', () => {
  // trailing slash
  expect(parseOwnerRepoFromUrl('https://github.com/owner/repo/')).toEqual({ owner: 'owner', name: 'repo' });
  // explicit .git over https
  expect(parseOwnerRepoFromUrl('https://github.com/owner/repo.git')).toEqual({ owner: 'owner', name: 'repo' });
  // scp-like without .git
  expect(parseOwnerRepoFromUrl('git@github.com:owner/repo')).toEqual({ owner: 'owner', name: 'repo' });
  // ssh:// form
  expect(parseOwnerRepoFromUrl('ssh://git@github.com/owner/repo.git')).toEqual({ owner: 'owner', name: 'repo' });
  // different host still matches owner/repo pattern
  expect(parseOwnerRepoFromUrl('https://gitlab.com/owner/repo.git')).toEqual({ owner: 'owner', name: 'repo' });
  // malformed inputs return null
  expect(parseOwnerRepoFromUrl('not a url')).toBeNull();
  expect(parseOwnerRepoFromUrl('github.com/')).toBeNull();
});
