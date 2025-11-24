import * as vscode from 'vscode';
import { ProjectService } from '../services/projectService';

export class ProjectChatParticipant {
    private static readonly PARTICIPANT_ID = 'ghProjects.participant';

    constructor(private context: vscode.ExtensionContext, private projectService: ProjectService) {
        const participant = vscode.chat.createChatParticipant(ProjectChatParticipant.PARTICIPANT_ID, this.handler.bind(this));
        participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
        context.subscriptions.push(participant);
    }

    private async handler(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        const cmd = request.command;

        if (cmd === 'list') {
            await this.handleList(stream);
        } else if (cmd === 'search') {
            await this.handleSearch(request.prompt, stream);
        } else {
            stream.markdown('I can help you manage your GitHub Projects. Try `/list` or `/search <query>`.');
        }
    }

    private async handleList(stream: vscode.ChatResponseStream): Promise<void> {
        stream.progress('Fetching projects...');
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            stream.markdown('No workspace open.');
            return;
        }
        const root = folders[0].uri.fsPath; // Default to first folder
        try {
            const projects = await this.projectService.loadProjects(root);
            if (projects.length === 0) {
                stream.markdown('No projects found.');
                return;
            }
            stream.markdown(`Found ${projects.length} projects:\n`);
            for (const p of projects) {
                stream.markdown(`- [${p.title || p.id}](${p.url})\n`);
            }
        } catch (e) {
            stream.markdown(`Error fetching projects: ${e}`);
        }
    }

    private async handleSearch(query: string, stream: vscode.ChatResponseStream): Promise<void> {
        stream.markdown(`Searching for: ${query} (Not implemented)`);
    }
}
