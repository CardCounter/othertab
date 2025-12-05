import { defineConfig } from 'vite';
import { resolve, join, relative, dirname } from 'node:path';
import { readdirSync, statSync, cpSync, mkdirSync } from 'node:fs';
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

function collectDirectoriesByName(rootDir, directoryName) {
    const directories = [];
    for (const entry of readdirSync(rootDir)) {
        const fullPath = join(rootDir, entry);
        if (!statSync(fullPath).isDirectory()) {
            continue;
        }

        if (entry === directoryName) {
            directories.push(fullPath);
        }

        directories.push(...collectDirectoriesByName(fullPath, directoryName));
    }
    return directories;
}

const srcRoot = resolve(__dirname, 'src');
const htmlInputs = collectHtmlInputs(srcRoot);
const imageDirectories = collectDirectoriesByName(srcRoot, 'images');

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

const copyImageDirectoriesPlugin = {
    name: 'copy-image-directories',
    apply: 'build',
    closeBundle() {
        const buildOutDir = resolve(__dirname, 'build');
        for (const directory of imageDirectories) {
            const relativeDir = relative(srcRoot, directory);
            const targetDir = join(buildOutDir, relativeDir);
            mkdirSync(dirname(targetDir), { recursive: true });
            cpSync(directory, targetDir, { recursive: true });
        }
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
    plugins: [htmlMinifyPlugin, copyImageDirectoriesPlugin]
});
