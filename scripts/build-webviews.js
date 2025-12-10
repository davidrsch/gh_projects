const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const srcDir = path.join(__dirname, "../src/webviews/client");
const outDir = path.join(__dirname, "../media/dist");

// Ensure outDir exists
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const entryPoints = [
    "tableViewFetcher.ts",
    "boardViewFetcher.ts",
    "overviewFetcher.ts",
    "roadmapViewFetcher.ts",
    "contentFetcher.ts",
    "filterBarHelper.ts",
    "iconHelper.ts",
].map((f) => path.join(srcDir, f));

async function build() {
    try {
        await esbuild.build({
            entryPoints,
            outdir: outDir,
            bundle: true,
            minify: true,
            sourcemap: true,
            platform: "browser",
            target: "es2020",
            format: "iife",
        });
        console.log("Webviews built successfully.");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

build();
