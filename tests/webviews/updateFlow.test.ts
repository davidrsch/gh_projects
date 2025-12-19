import { MessageHandler } from '../../src/webviews/MessageHandler';
import { ProjectEntry } from '../../src/lib/types';

jest.mock('../../src/services/GitHubRepository');
jest.mock('../../src/services/ProjectDataService');
jest.mock('vscode', () => ({
  window: { showErrorMessage: jest.fn(), showInformationMessage: jest.fn() },
  Disposable: class { dispose() {} }
}), { virtual: true });

import { GitHubRepository } from '../../src/services/GitHubRepository';
import { ProjectDataService } from '../../src/services/ProjectDataService';

describe('MessageHandler update flow', () => {
  let panel: any;
  let handler: any;
  let repoMock: any;
  let project: ProjectEntry;

  beforeEach(() => {
    jest.resetAllMocks();
    panel = {
      webview: {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn()
      },
      title: 'Test Panel'
    };

    project = { id: 'p1', title: 'P' } as any;

    repoMock = {
      updateFieldValue: jest.fn()
    };
    (GitHubRepository.getInstance as jest.Mock).mockReturnValue(repoMock);

    (ProjectDataService.getProjectData as jest.Mock).mockResolvedValue({ snapshot: { project: { id: 'p1' }, fields: [], items: [] }, effectiveFilter: null, itemsCount: 0 });

    handler = new (MessageHandler as any)(panel, project, 'panel-1', {} as any, {});
  });

  test('successful update posts response, fields and result', async () => {
    repoMock.updateFieldValue.mockResolvedValue({ success: true });

    const msg = {
      command: 'updateFieldValue',
      id: 'req-1',
      projectId: 'p1',
      itemId: 'i1',
      fieldId: 'f1',
      newValue: 'hello',
      fieldType: 'text',
      viewKey: 'view-1'
    };

    // invoke private handler
    await (handler as any).handleUpdateFieldValue(msg);

    // Expect ack posted
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'updateFieldValueResponse', id: 'req-1' }));

    // Expect fields snapshot posted
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'fields' }));

    // Expect final result posted (shape may vary: either top-level success or payload.success)
    const calls = (panel.webview.postMessage as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    const resultCall = calls.find((c: any) => c && c.command === 'updateFieldValueResult');
    expect(resultCall).toBeDefined();
    expect(resultCall.id === 'req-1' || resultCall.viewKey === 'view-1').toBeTruthy();
    expect(resultCall.success === true || (resultCall.payload && resultCall.payload.success === true)).toBeTruthy();
  });

  test('failed update posts response and error result', async () => {
    repoMock.updateFieldValue.mockResolvedValue({ success: false, error: 'Bad' });

    const msg = {
      command: 'updateFieldValue',
      id: 'req-2',
      projectId: 'p1',
      itemId: 'i2',
      fieldId: 'f2',
      newValue: 'x',
      fieldType: 'text',
      viewKey: 'view-1'
    };

    await (handler as any).handleUpdateFieldValue(msg);

    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'updateFieldValueResponse', id: 'req-2' }));
    const calls2 = (panel.webview.postMessage as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    const res2 = calls2.find((c: any) => c && c.command === 'updateFieldValueResult');
    expect(res2).toBeDefined();
    expect(res2.id === 'req-2' || res2.viewKey === 'view-1').toBeTruthy();
    expect(res2.success === false || (res2.payload && res2.payload.success === false)).toBeTruthy();
  });
});
