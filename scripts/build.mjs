import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

const tailwindBin = path.resolve(rootDir, 'node_modules/.bin/tailwindcss');
const contentTwInput = path.resolve(rootDir, 'src/content/tailwind.css');
const contentTwOutput = path.resolve(rootDir, '.cache/content-tailwind.css');

const isWatch = process.argv.includes('--watch');

function buildContentTailwind() {
  fs.mkdirSync(path.dirname(contentTwOutput), { recursive: true });
  execFileSync(tailwindBin, ['-i', contentTwInput, '-o', contentTwOutput, '--minify'], {
    stdio: 'inherit',
  });
}

async function copyStaticAssets() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest.json
  const manifestPath = path.resolve(rootDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, path.resolve(distDir, 'manifest.json'));
  }

  // Copy icons
  const iconsSrc = path.resolve(rootDir, 'icons');
  const iconsDist = path.resolve(distDir, 'icons');
  if (fs.existsSync(iconsSrc)) {
    if (!fs.existsSync(iconsDist)) {
      fs.mkdirSync(iconsDist, { recursive: true });
    }
    for (const file of fs.readdirSync(iconsSrc)) {
      fs.copyFileSync(path.resolve(iconsSrc, file), path.resolve(iconsDist, file));
    }
  }
}

const scriptConfigs = [
  {
    entryPoints: [path.resolve(rootDir, 'src/background/index.ts')],
    outfile: path.resolve(distDir, 'background.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
  },
  {
    entryPoints: [path.resolve(rootDir, 'src/content/index.tsx')],
    outfile: path.resolve(distDir, 'content.js'),
    bundle: true,
    format: 'iife',
    target: 'es2022',
    loader: {
      '.css': 'text',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  {
    entryPoints: [path.resolve(rootDir, 'src/content/inject.ts')],
    outfile: path.resolve(distDir, 'inject.js'),
    bundle: true,
    format: 'iife',
    target: 'es2022',
  },
];

async function buildAll() {
  console.log('🚀 Building Repeet extension...');
  const start = Date.now();

  // 1. Build Vite frontend apps (dashboard & popup)
  console.log('📦 Bundling React applications (Dashboard & Popup)...');
  await viteBuild({
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: true,
    },
    configFile: path.resolve(rootDir, 'vite.config.ts'),
  });

  await copyStaticAssets();

  // 2. Build Extension scripts with esbuild
  console.log('⚡ Bundling Extension scripts (Background, Content, Inject)...');
  buildContentTailwind();
  for (const config of scriptConfigs) {
    await esbuild.build(config);
  }

  console.log(`✅ Build completed in ${Date.now() - start}ms -> output directory: dist/`);
}

async function watchAll() {
  console.log('👀 Starting watch mode for Repeet...');
  await copyStaticAssets();

  // Watch Vite
  const viteWatcher = await viteBuild({
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      watch: {},
    },
    configFile: path.resolve(rootDir, 'vite.config.ts'),
  });

  // Watch scripts
  buildContentTailwind();
  const tailwindWatcher = spawn(
    tailwindBin,
    ['-i', contentTwInput, '-o', contentTwOutput, '--watch'],
    { stdio: 'inherit' }
  );
  const shutdown = () => {
    tailwindWatcher.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const contexts = await Promise.all(
    scriptConfigs.map((cfg) => esbuild.context(cfg))
  );

  for (const ctx of contexts) {
    await ctx.watch();
  }

  console.log('✨ Watching for changes... Reload extension in chrome://extensions to test updates.');
}

if (isWatch) {
  watchAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  buildAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
