"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findGitRepos = findGitRepos;
exports.readGitRemotes = readGitRemotes;
exports.pickPreferred = pickPreferred;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const GIT_DIR = '.git';
// Recursively find git repos under a folder
function findGitRepos(root) {
    const results = [];
    function walk(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        if (entries.some(e => e.isDirectory() && e.name === GIT_DIR)) {
            results.push(dir);
            return; // do not recurse into subfolders of a git repo
        }
        for (const e of entries) {
            if (e.isDirectory())
                walk(path.join(dir, e.name));
        }
    }
    walk(root);
    return results.sort();
}
// Read remotes from .git/config
function readGitRemotes(repoPath) {
    const configPath = path.join(repoPath, GIT_DIR, 'config');
    if (!fs.existsSync(configPath))
        return [];
    const content = fs.readFileSync(configPath, 'utf8');
    const remotes = [];
    const regex = /\[remote "(.+?)"\]\s+url = (.+)/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
        remotes.push({ name: m[1], url: m[2] });
    }
    return remotes;
}
// Pick preferred remote (origin first, else first)
function pickPreferred(remotes) {
    if (!remotes.length)
        return undefined;
    const origin = remotes.find(r => r.name === 'origin');
    return origin ?? remotes[0];
}
//# sourceMappingURL=gitUtils.js.map