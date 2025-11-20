import { defineConfig } from 'vite';
import { resolve, join } from 'node:path';
import { readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { minify } from 'html-minifier-terser';

function collectHtmlInputs(rootDir) {
    const entries = [];
    for (const entry of readdirSync(rootDir)) {
        const fullPath = join(rootDir, entry);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
            entries.push(...collectHtmlInputs(fullPath));
        } else if (stats.isFile() && entry.endsWith('.html')) {
            entries.push(fullPath);
        }
    }
    return entries;
}

const srcRoot = resolve(__dirname, 'src');
const buildOutDir = resolve(__dirname, 'build');
const htmlInputs = collectHtmlInputs(srcRoot);

const htmlMinifyPlugin = {
    name: 'html-minify-post',
    apply: 'build',
    enforce: 'post',
    async transformIndexHtml(html) {
        return minify(html, {
            collapseWhitespace: true,
            keepClosingSlash: true,
            minifyCSS: true,
            minifyJS: true,
            removeComments: true,
            removeRedundantAttributes: true,
            useShortDoctype: true
        });
    }
};

const copyNormalizeScriptPlugin = {
    name: 'copy-normalize-slashes',
    apply: 'build',
    closeBundle() {
        const source = join(srcRoot, 'scripts/normalize-slashes.js');
        const destinationDir = join(buildOutDir, 'scripts');
        mkdirSync(destinationDir, { recursive: true });
        copyFileSync(source, join(destinationDir, 'normalize-slashes.js'));
    }
};

export default defineConfig({
    root: 'src',
    build: {
        outDir: '../build',
        emptyOutDir: true,
        rollupOptions: {
            input: htmlInputs
        }
    },
    plugins: [htmlMinifyPlugin, copyNormalizeScriptPlugin]
});
