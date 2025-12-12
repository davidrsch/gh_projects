import { MessageHandler } from "../../src/webviews/MessageHandler";
import { GitHubRepository } from "../../src/services/GitHubRepository";
import { ProjectDataService } from "../../src/services/ProjectDataService";
import * as vscode from "vscode";

jest.mock("../../src/services/GitHubRepository");
jest.mock("../../src/services/ProjectDataService");
jest.mock(
    "vscode",
    () => ({
        window: {
            showErrorMessage: jest.fn(),
        },
        ExtensionContext: class {},
        WebviewPanel: class {},
        commands: {
            executeCommand: jest.fn(),
        },
        env: {
            openExternal: jest.fn(),
        },
        Uri: {
            parse: jest.fn((url) => ({ url })),
            file: jest.fn((path) => ({ path })),
        },
    }),
    { virtual: true },
);
jest.mock("../../src/lib/logger", () => ({
    __esModule: true,
    default: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe("MessageHandler", () => {
    let messageHandler: MessageHandler;
    let mockPanel: any;
    let mockProject: any;
    let mockContext: any;
    let mockResources: any;
    let gitHubRepoMock: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock panel with webview
        mockPanel = {
            webview: {
                postMessage: jest.fn(),
                onDidReceiveMessage: jest.fn(),
            },
        };

        // Mock project
        mockProject = {
            id: 'project-123',
            title: 'Test Project',
            views: [
                { id: 'view-1', name: 'View 1', number: 1, layout: 'table' }
            ],
        };

        // Mock context
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(),
                update: jest.fn(),
            },
        };

        // Mock resources
        mockResources = {
            fetcherUris: {
                overviewUri: 'overview.js',
                tableUri: 'table.js',
            },
        };

        // Mock GitHubRepository
        gitHubRepoMock = {
            updateFieldValue: jest.fn().mockResolvedValue({ success: true }),
        };
        (GitHubRepository.getInstance as jest.Mock).mockReturnValue(gitHubRepoMock);

        // Mock ProjectDataService
        (ProjectDataService.getProjectData as jest.Mock).mockResolvedValue({
            snapshot: {
                project: { id: 'project-123', title: 'Test Project' },
                fields: [],
                items: [],
            },
            effectiveFilter: undefined,
            itemsCount: 0,
        });

        messageHandler = new MessageHandler(
            mockPanel,
            mockProject,
            'panel-key-1',
            mockContext,
            mockResources
        );
    });

    describe("handleUpdateFieldValue", () => {
        test("successfully updates text field", async () => {
            const message = {
                command: 'updateFieldValue',
                id: 'msg-1',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'text',
                newValue: 'Updated text',
            };

            // Trigger the message handler manually since we can't easily simulate the event
            await (messageHandler as any).handleMessage(message);

            expect(gitHubRepoMock.updateFieldValue).toHaveBeenCalledWith(
                'project-123',
                'item-123',
                'field-123',
                'Updated text',
                'text'
            );

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'updateFieldValueResponse',
                    id: 'msg-1',
                    success: true,
                })
            );
        });

        test("successfully updates number field", async () => {
            const message = {
                command: 'updateFieldValue',
                id: 'msg-2',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'number',
                newValue: 42,
            };

            await (messageHandler as any).handleMessage(message);

            expect(gitHubRepoMock.updateFieldValue).toHaveBeenCalledWith(
                'project-123',
                'item-123',
                'field-123',
                42,
                'number'
            );
        });

        test("successfully updates single_select field", async () => {
            const message = {
                command: 'updateFieldValue',
                id: 'msg-3',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'single_select',
                newValue: 'option-id-456',
            };

            await (messageHandler as any).handleMessage(message);

            expect(gitHubRepoMock.updateFieldValue).toHaveBeenCalledWith(
                'project-123',
                'item-123',
                'field-123',
                'option-id-456',
                'single_select'
            );
        });

        test("successfully updates iteration field", async () => {
            const message = {
                command: 'updateFieldValue',
                id: 'msg-4',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'iteration',
                newValue: 'iteration-id-789',
            };

            await (messageHandler as any).handleMessage(message);

            expect(gitHubRepoMock.updateFieldValue).toHaveBeenCalledWith(
                'project-123',
                'item-123',
                'field-123',
                'iteration-id-789',
                'iteration'
            );
        });

        test("successfully updates labels field", async () => {
            const message = {
                command: 'updateFieldValue',
                id: 'msg-5',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'labels',
                newValue: { labelIds: ['label-1', 'label-2'] },
            };

            await (messageHandler as any).handleMessage(message);

            expect(gitHubRepoMock.updateFieldValue).toHaveBeenCalledWith(
                'project-123',
                'item-123',
                'field-123',
                { labelIds: ['label-1', 'label-2'] },
                'labels'
            );
        });

        test("handles missing required fields", async () => {
            const message = {
                command: 'updateFieldValue',
                id: 'msg-6',
                viewKey: 'project-123:view-0',
                // Missing itemId and fieldId
                projectId: 'project-123',
            };

            await (messageHandler as any).handleMessage(message);

            expect(gitHubRepoMock.updateFieldValue).not.toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'updateFieldValueResponse',
                    id: 'msg-6',
                    success: false,
                    error: expect.stringContaining('Missing required fields'),
                })
            );
        });

        test("handles update failure from GitHubRepository", async () => {
            gitHubRepoMock.updateFieldValue.mockResolvedValue({
                success: false,
                error: 'GraphQL error: Field not found',
            });

            const message = {
                command: 'updateFieldValue',
                id: 'msg-7',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'text',
                newValue: 'text',
            };

            await (messageHandler as any).handleMessage(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'updateFieldValueResponse',
                    id: 'msg-7',
                    success: false,
                    error: 'GraphQL error: Field not found',
                })
            );
        });

        test("handles exception during update", async () => {
            gitHubRepoMock.updateFieldValue.mockRejectedValue(new Error('Network error'));

            const message = {
                command: 'updateFieldValue',
                id: 'msg-8',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'text',
                newValue: 'text',
            };

            await (messageHandler as any).handleMessage(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'updateFieldValueResponse',
                    id: 'msg-8',
                    success: false,
                    error: expect.stringContaining('Network error'),
                })
            );
        });

        test("refreshes project data after successful update", async () => {
            const message = {
                command: 'updateFieldValue',
                id: 'msg-9',
                viewKey: 'project-123:view-0',
                projectId: 'project-123',
                itemId: 'item-123',
                fieldId: 'field-123',
                fieldType: 'text',
                newValue: 'Updated text',
            };

            await (messageHandler as any).handleMessage(message);

            expect(ProjectDataService.getProjectData).toHaveBeenCalledWith(
                mockProject,
                'project-123:view-0',
                true
            );

            // Check that fresh data is sent back
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'fields',
                    viewKey: 'project-123:view-0',
                })
            );
        });
    });

    describe("openUrl behavior", () => {
        test("handles openUrl without viewKey via vscode.open", async () => {
            const message = {
                command: "openUrl",
                url: "https://github.com/org/repo/issues/123",
            };

            await (messageHandler as any).handleMessage(message);

            expect((vscode.commands.executeCommand as jest.Mock)).toHaveBeenCalledWith(
                "vscode.open",
                { url: "https://github.com/org/repo/issues/123" },
            );
            // env.openExternal should not be needed in the happy path
            expect((vscode.env.openExternal as jest.Mock)).not.toHaveBeenCalled();
        });

        test("falls back to env.openExternal when vscode.open fails", async () => {
            (vscode.commands.executeCommand as jest.Mock).mockRejectedValueOnce(
                new Error("failed"),
            );

            const message = {
                command: "openUrl",
                url: "https://github.com/org/repo/pull/1",
            };

            await (messageHandler as any).handleMessage(message);

            expect((vscode.env.openExternal as jest.Mock)).toHaveBeenCalledWith({
                url: "https://github.com/org/repo/pull/1",
            });
        });
    });
});
