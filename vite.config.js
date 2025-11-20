import { defineConfig } from 'vite';
import { resolve, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
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

export default defineConfig({
    root: 'src',
    build: {
        outDir: '../build',
        emptyOutDir: true,
        rollupOptions: {
            input: htmlInputs
        }
    },
    plugins: [htmlMinifyPlugin]
});
