
const mockVscode = {
    Uri: {
        joinPath: (uri: any, ...pathSegments: string[]) => ({
            fsPath: uri.fsPath + "/" + pathSegments.join("/"),
            toString: () => uri.toString() + "/" + pathSegments.join("/")
        }),
        file: (path: string) => ({ fsPath: path, toString: () => "file://" + path })
    },
    Webview: {}
};

jest.mock("vscode", () => mockVscode, { virtual: true });

import { buildHtml } from "../../src/webviews/htmlBuilder";
import * as vscode from "vscode";

describe("htmlBuilder", () => {
    const mockWebview = {
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: "vscode-webview-resource:"
    } as vscode.Webview;

    const mockExtensionUri = {
        fsPath: "/mock/extension",
        toString: () => "file:///mock/extension"
    } as vscode.Uri;

    test("should generate HTML with provided project data", () => {
        const project = {
            id: "p1",
            title: "Test Project",
            description: "A test project",
            repos: [],
            views: []
        };
        const scriptUri = "main.js";

        const html = buildHtml(mockWebview, project as any, scriptUri);

        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("Test Project");
        expect(html).toContain('src="main.js"');
        expect(html).toContain('nonce=');
    });

    test("should include default styles", () => {
        const project = { id: "p1", title: "Test" };
        const html = buildHtml(mockWebview, project as any, "main.js");
        expect(html).toContain("html, body {");
        expect(html).toContain("font-family: var(--vscode-font-family);");
    });
});
