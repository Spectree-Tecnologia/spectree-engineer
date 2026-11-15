#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadSkillConfig, resolveNamespace } from '../../utils/resolve-skill-config.mjs';
import { createSkillRunLogger } from '../../utils/skill-run-log.mjs';
import { createSkillRunOps } from '../../utils/skill-run-ops.mjs';

let activeRunLogger = null;
let activeRunOps = null;

const DEFAULT_PRETTIER_CONFIG = {
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  printWidth: 120,
  arrowParens: 'always',
  bracketSpacing: true,
};

function usage() {
  console.log(`Usage:
  node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs [--frontend-path apps/frontend] [--backend-path apps/backend] [--frontend-port 3000] [--backend-port 4000] [--scope @namespace] [--skip-global-nest]

Examples:
  node project-init.mjs
  node project-init.mjs --frontend-path apps/frontend --backend-path apps/api
  node project-init.mjs --frontend-path apps/frontend --backend-path services/backend
  node project-init.mjs --frontend-port 3100 --backend-port 4100
  node project-init.mjs --scope @namespace
  node project-init.mjs --skip-global-nest`);
}

function normalizeRelativeDir(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid value for --${fieldName}.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Missing value for --${fieldName}`);
  }

  if (path.isAbsolute(trimmed)) {
    throw new Error(`Invalid value for --${fieldName}: must be a relative path.`);
  }

  const normalized = path.normalize(trimmed).replace(/\\/g, '/');
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Invalid value for --${fieldName}: cannot point outside repository root.`);
  }

  return normalized;
}

function normalizePathLeaf(value, fieldName) {
  const leaf = path.basename(value);
  if (!/^[a-z][a-z0-9-]*$/.test(leaf)) {
    throw new Error(`Invalid value for --${fieldName}: last segment "${leaf}" must match /^[a-z][a-z0-9-]*$/.`);
  }
}

function normalizeProjectPath(value, fieldName) {
  const normalized = normalizeRelativeDir(value, fieldName);
  normalizePathLeaf(normalized, fieldName);
  return normalized;
}

function normalizePort(value, fieldName) {
  if (!value) throw new Error(`Missing value for --${fieldName}`);
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid value for --${fieldName}: "${value}" must be an integer between 1 and 65535.`);
  }

  return parsed;
}

function normalizeEnvVarName(value, fieldName) {
  if (!value) throw new Error(`Missing value for --${fieldName}`);
  const trimmed = value.trim();

  if (!/^[A-Z][A-Z0-9_]*$/.test(trimmed)) {
    throw new Error(`Invalid value for --${fieldName}: "${trimmed}" must match /^[A-Z][A-Z0-9_]*$/.`);
  }

  return trimmed;
}

function parseArgs(argv, defaults) {
  let frontendPath = defaults.frontendAppPath;
  let backendPath = defaults.backendAppPath;
  let frontendPort = defaults.frontendPort;
  let backendPort = defaults.backendPort;
  let frontendApiUrlEnvVar = defaults.frontendApiUrlEnvVar;
  let backendPortEnvVar = defaults.backendPortEnvVar;
  let scope = '';
  let skipGlobalNest = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }

    if (arg === '--skip-global-nest') {
      skipGlobalNest = true;
      continue;
    }

    if (arg === '--frontend-path') {
      frontendPath = normalizeProjectPath(argv[i + 1], 'frontend-path');
      i += 1;
      continue;
    }

    if (arg === '--backend-path') {
      backendPath = normalizeProjectPath(argv[i + 1], 'backend-path');
      i += 1;
      continue;
    }

    // Backward-compatible aliases.
    if (arg === '--apps-dir') {
      const appsDir = normalizeRelativeDir(argv[i + 1], 'apps-dir');
      frontendPath = path.join(appsDir, path.basename(frontendPath)).replace(/\\/g, '/');
      backendPath = path.join(appsDir, path.basename(backendPath)).replace(/\\/g, '/');
      i += 1;
      continue;
    }

    if (arg === '--next-name' || arg === '--frontend-name') {
      const value = argv[i + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      const name = value.trim();
      normalizePathLeaf(name, arg.slice(2));
      frontendPath = path.join(path.dirname(frontendPath), name).replace(/\\/g, '/');
      i += 1;
      continue;
    }

    if (arg === '--backend-name') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --backend-name');
      const name = value.trim();
      normalizePathLeaf(name, 'backend-name');
      backendPath = path.join(path.dirname(backendPath), name).replace(/\\/g, '/');
      i += 1;
      continue;
    }

    if (arg === '--frontend-port') {
      frontendPort = normalizePort(argv[i + 1], 'frontend-port');
      i += 1;
      continue;
    }

    if (arg === '--backend-port') {
      backendPort = normalizePort(argv[i + 1], 'backend-port');
      i += 1;
      continue;
    }

    if (arg === '--frontend-api-env-var') {
      frontendApiUrlEnvVar = normalizeEnvVarName(argv[i + 1], 'frontend-api-env-var');
      i += 1;
      continue;
    }

    if (arg === '--backend-port-env-var') {
      backendPortEnvVar = normalizeEnvVarName(argv[i + 1], 'backend-port-env-var');
      i += 1;
      continue;
    }

    if (arg === '--scope') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --scope');
      scope = value;
      i += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (frontendPath === backendPath) {
    throw new Error('Frontend and backend paths must be different.');
  }

  return {
    frontendPath,
    backendPath,
    frontendPort,
    backendPort,
    frontendApiUrlEnvVar,
    backendPortEnvVar,
    scope,
    skipGlobalNest,
  };
}

function runCommand(cmd, args, cwd) {
  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }

  return activeRunOps.runCommand(cmd, args, cwd);
}


function commandExists(cmd, args = ['--version']) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  if (!activeRunOps) {
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    return;
  }

  await activeRunOps.writeJsonFile(filePath, data, {
    note: path.basename(filePath),
    markRiskOnOverwrite: true,
  });
}

function ensureArrayValue(arr, value) {
  if (!Array.isArray(arr)) return [value];
  return arr.includes(value) ? arr : [...arr, value];
}

function ensureWorkspacePatterns(workspaces) {
  if (Array.isArray(workspaces)) {
    return ensureArrayValue(
      ensureArrayValue(ensureArrayValue(ensureArrayValue(workspaces, 'apps/*'), 'modules/*'), 'packages/*'),
      'packages/config/*',
    );
  }

  if (workspaces && typeof workspaces === 'object' && Array.isArray(workspaces.packages)) {
    return {
      ...workspaces,
      packages: ensureArrayValue(
        ensureArrayValue(ensureArrayValue(ensureArrayValue(workspaces.packages, 'apps/*'), 'modules/*'), 'packages/*'),
        'packages/config/*',
      ),
    };
  }

  return ['apps/*', 'modules/*', 'packages/*', 'packages/config/*'];
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function mergeTreeWithoutOverwrite(srcPath, destPath, relativePath = '') {
  const copied = [];
  const skipped = [];
  const sourceStat = await fs.stat(srcPath);
  const destinationExists = await pathExists(destPath);

  if (!destinationExists) {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.cp(srcPath, destPath, { recursive: sourceStat.isDirectory() });
    if (relativePath) copied.push(relativePath);
    return { copied, skipped };
  }

  const destinationStat = await fs.stat(destPath);
  if (sourceStat.isDirectory() && destinationStat.isDirectory()) {
    const entries = await fs.readdir(srcPath);
    for (const entry of entries) {
      if (entry === '.git') continue;
      const childRelativePath = relativePath ? path.join(relativePath, entry) : entry;
      const childResult = await mergeTreeWithoutOverwrite(
        path.join(srcPath, entry),
        path.join(destPath, entry),
        childRelativePath,
      );
      copied.push(...childResult.copied);
      skipped.push(...childResult.skipped);
    }
    return { copied, skipped };
  }

  if (relativePath) skipped.push(relativePath);
  return { copied, skipped };
}

async function scaffoldTurboStructureWithCreateTurbo(rootDir) {
  const hasRootGit = await pathExists(path.join(rootDir, '.git'));
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'config-project-'));
  const tempProjectName = 'turbo-template';
  const tempProjectDir = path.join(tempRoot, tempProjectName);
  const args = ['--yes', 'create-turbo@latest', tempProjectName, '--package-manager', 'npm', '--skip-install'];
  if (hasRootGit) {
    args.push('--no-git');
  }

  try {
    await runCommand('npx', args, tempRoot);

    const mergeResult = await mergeTreeWithoutOverwrite(tempProjectDir, rootDir);
    return {
      hasRootGit,
      copiedPaths: mergeResult.copied,
      skippedPaths: mergeResult.skipped,
    };
  } finally {
    if (activeRunOps) {
      await activeRunOps.removePath(tempRoot, {
        recursive: true,
        force: true,
        markRisk: false,
        note: 'cleanup temp scaffold',
      });
    } else {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }
}

async function ensureTurboRoot(rootDir, scope) {
  const packagePath = path.join(rootDir, 'package.json');
  const turboPath = path.join(rootDir, 'turbo.json');
  const repoName = `${scope || '@namespace'}/workspace`;
  const requiredTurboPaths = [
    '.gitignore',
    '.npmrc',
    'packages/eslint-config/package.json',
    'packages/typescript-config/package.json',
  ];
  const missingTurboPaths = [];
  for (const relativePath of requiredTurboPaths) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!(await pathExists(absolutePath))) {
      missingTurboPaths.push(relativePath);
    }
  }
  const turboPathExists = await pathExists(turboPath);
  const shouldScaffoldFromTurbo = !turboPathExists || missingTurboPaths.length > 0;
  let scaffoldResult = null;
  if (shouldScaffoldFromTurbo) {
    scaffoldResult = await scaffoldTurboStructureWithCreateTurbo(rootDir);
  }

  let rootPkg = {};
  let pkgExists = false;
  if (await pathExists(packagePath)) {
    rootPkg = await readJson(packagePath);
    pkgExists = true;
  }

  const nextPkg = {
    ...rootPkg,
    name: typeof rootPkg.name === 'string' && rootPkg.name.trim() ? rootPkg.name : repoName,
    private: true,
    scripts: {
      ...(rootPkg.scripts ?? {}),
    },
    workspaces: ensureWorkspacePatterns(rootPkg.workspaces),
  };
  nextPkg.scripts.dev = nextPkg.scripts.dev ?? 'turbo run dev';
  nextPkg.scripts.build = nextPkg.scripts.build ?? 'turbo run build';
  nextPkg.scripts.lint = nextPkg.scripts.lint ?? 'turbo run lint';
  nextPkg.scripts.test = 'turbo run test';
  // turbo rejects 'npm@latest' (invalid_package_manager_field); pin the installed version
  nextPkg.packageManager = nextPkg.packageManager ?? `npm@${execSync('npm --version').toString().trim()}`;

  const turboExists = await pathExists(turboPath);
  if (!turboExists) {
    await writeJson(turboPath, {
      $schema: 'https://turbo.build/schema.json',
      tasks: {
        build: {
          dependsOn: ['^build'],
          outputs: ['.next/**', '!.next/cache/**', 'dist/**'],
        },
        lint: {
          dependsOn: ['^lint'],
        },
        test: {
          dependsOn: ['^test'],
          cache: false,
        },
        dev: {
          cache: false,
          persistent: true,
        },
      },
    });
  }

  const pkgChanged = JSON.stringify(rootPkg) !== JSON.stringify(nextPkg);
  if (!pkgExists || pkgChanged) {
    await writeJson(packagePath, nextPkg);
  }

  return {
    createdTurbo: !turboExists,
    createdPackageJson: !pkgExists,
    scaffoldedWithCreateTurbo: shouldScaffoldFromTurbo,
    missingTurboPathsBefore: missingTurboPaths,
    copiedScaffoldPaths: scaffoldResult ? scaffoldResult.copiedPaths : [],
    skippedScaffoldPaths: scaffoldResult ? scaffoldResult.skippedPaths : [],
  };
}

function hasDependency(pkg, depName) {
  const groups = [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies, pkg.peerDependencies];

  return groups.some((group) => group && typeof group === 'object' && depName in group);
}

async function ensureDependency({ packageJsonPath, depName, installCommand, installArgs, cwd }) {
  if (!(await pathExists(packageJsonPath))) {
    throw new Error(`Missing package.json: ${packageJsonPath}`);
  }

  const pkg = await readJson(packageJsonPath);
  if (hasDependency(pkg, depName)) {
    return false;
  }

  console.log(`Installing dependency "${depName}" in ${cwd}...`);
  await runCommand(installCommand, installArgs, cwd);
  return true;
}

async function readPackageName(packageJsonPath) {
  if (!(await pathExists(packageJsonPath))) return '';
  const pkg = await readJson(packageJsonPath);
  return typeof pkg.name === 'string' ? pkg.name : '';
}

async function ensurePackageName(packageJsonPath, expectedName) {
  if (!(await pathExists(packageJsonPath))) {
    return false;
  }

  const pkg = await readJson(packageJsonPath);
  if (pkg.name === expectedName) {
    return false;
  }

  pkg.name = expectedName;
  await writeJson(packageJsonPath, pkg);
  return true;
}

function buildScopedPackageName(scope, packageName) {
  if (typeof packageName === 'string' && packageName.includes('/')) {
    const [, leaf = ''] = packageName.split('/');
    if (leaf) return `${scope}/${leaf}`;
  }
  return `${scope}/${packageName}`;
}

function rewriteMappedDependencyGroup(group, renameMap) {
  if (!group || typeof group !== 'object') return { changed: false, value: group };
  let changed = false;
  const next = {};

  for (const [depName, depVersion] of Object.entries(group)) {
    const mappedName = renameMap.get(depName) ?? depName;
    if (mappedName !== depName) changed = true;
    next[mappedName] = depVersion;
  }

  return { changed, value: next };
}

async function listWorkspacePackageJsonPaths(rootDir) {
  const roots = ['apps', 'modules', 'packages'];
  const results = [];

  for (const root of roots) {
    const rootPath = path.join(rootDir, root);
    if (!(await pathExists(rootPath))) continue;

    const topLevel = await fs.readdir(rootPath, { withFileTypes: true });
    for (const entry of topLevel) {
      if (!entry.isDirectory()) continue;
      const packageJsonPath = path.join(rootPath, entry.name, 'package.json');
      if (await pathExists(packageJsonPath)) {
        results.push(packageJsonPath);
      }
    }
  }

  return results;
}

async function applyNamespaceToWorkspacePackages({ rootDir, scope }) {
  const packageJsonPaths = await listWorkspacePackageJsonPaths(rootDir);
  const packageFiles = [];
  const renameMap = new Map();

  for (const packageJsonPath of packageJsonPaths) {
    const pkg = await readJson(packageJsonPath);
    const currentName =
      typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name : path.basename(path.dirname(packageJsonPath));
    const scopedName = buildScopedPackageName(scope, currentName);

    packageFiles.push({
      path: packageJsonPath,
      pkg,
      currentName,
      scopedName,
    });

    renameMap.set(currentName, scopedName);
  }

  const changedPackageNames = [];
  const changedPackageJsonPaths = [];

  for (const packageFile of packageFiles) {
    const { path: packageJsonPath, pkg, currentName, scopedName } = packageFile;
    let changed = false;

    if (pkg.name !== scopedName) {
      pkg.name = scopedName;
      changed = true;
      changedPackageNames.push(scopedName);
    }

    const groups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

    for (const groupName of groups) {
      const rewriteResult = rewriteMappedDependencyGroup(pkg[groupName], renameMap);
      if (rewriteResult.changed) {
        pkg[groupName] = rewriteResult.value;
        changed = true;
      }
    }

    if (changed) {
      await writeJson(packageJsonPath, pkg);
      changedPackageJsonPaths.push(packageJsonPath);
    }
  }

  return {
    changedPackageNames,
    changedPackageJsonPaths,
    packageCount: packageFiles.length,
  };
}

async function isNestAppDirectory(backendDir) {
  const packageJsonPath = path.join(backendDir, 'package.json');
  const mainPath = path.join(backendDir, 'src', 'main.ts');
  if (!(await pathExists(packageJsonPath))) return false;
  if (!(await pathExists(mainPath))) return false;

  const pkg = await readJson(packageJsonPath);
  return hasDependency(pkg, '@nestjs/core');
}

async function isNextAppDirectory(frontendDir) {
  const packageJsonPath = path.join(frontendDir, 'package.json');
  if (!(await pathExists(packageJsonPath))) return false;
  const pkg = await readJson(packageJsonPath);
  return hasDependency(pkg, 'next');
}

async function isDirectoryEmpty(targetPath) {
  if (!(await pathExists(targetPath))) return true;
  const entries = await fs.readdir(targetPath);
  return entries.length === 0;
}

function hasDependencySuffix(group, suffix) {
  if (!group || typeof group !== 'object') return false;
  return Object.keys(group).some((depName) => depName.endsWith(suffix));
}

function isLikelyTurboDefaultAppPackage(pkg, appLeaf) {
  if (!pkg || typeof pkg !== 'object') return false;
  if (!pkg.scripts || typeof pkg.scripts !== 'object') return false;
  if (!('check-types' in pkg.scripts)) return false;

  const hasUiDependency = hasDependencySuffix(pkg.dependencies, '/ui');
  const hasEslintConfig = hasDependencySuffix(pkg.devDependencies, '/eslint-config');
  const hasTsConfig = hasDependencySuffix(pkg.devDependencies, '/typescript-config');
  if (!hasUiDependency || !hasEslintConfig || !hasTsConfig) return false;

  const name = typeof pkg.name === 'string' ? pkg.name : '';
  return name.endsWith(`/${appLeaf}`) || appLeaf === 'docs' || appLeaf === 'web';
}

function isLikelyTurboDefaultUiPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return false;
  if (!pkg.scripts || typeof pkg.scripts !== 'object') return false;
  if (!pkg.devDependencies || typeof pkg.devDependencies !== 'object') return false;
  if (!pkg.dependencies || typeof pkg.dependencies !== 'object') return false;

  const name = typeof pkg.name === 'string' ? pkg.name : '';
  const hasUiName = name.endsWith('/ui');
  const hasCheckTypesScript = 'check-types' in pkg.scripts;
  const hasGenerateComponentScript =
    typeof pkg.scripts['generate:component'] === 'string' &&
    pkg.scripts['generate:component'].includes('turbo gen react-component');
  const hasReactDeps = 'react' in pkg.dependencies && 'react-dom' in pkg.dependencies;
  const hasEslintConfig = hasDependencySuffix(pkg.devDependencies, '/eslint-config');
  const hasTsConfig = hasDependencySuffix(pkg.devDependencies, '/typescript-config');

  return (
    hasUiName && hasCheckTypesScript && hasGenerateComponentScript && hasReactDeps && hasEslintConfig && hasTsConfig
  );
}

async function removeDefaultTurboApps({ rootDir, frontendPath, backendPath }) {
  const candidates = ['apps/docs', 'apps/web'];
  const removed = [];

  for (const candidate of candidates) {
    if (candidate === backendPath) continue;

    const candidateDir = path.join(rootDir, candidate);
    const packageJsonPath = path.join(candidateDir, 'package.json');
    if (!(await pathExists(packageJsonPath))) continue;

    const pkg = await readJson(packageJsonPath);
    const appLeaf = path.basename(candidate);
    const isDefaultTemplate = isLikelyTurboDefaultAppPackage(pkg, appLeaf);
    if (!isDefaultTemplate) continue;

    if (candidate === frontendPath) {
      console.log(`Removing Turbo default app at ${candidate} before creating configured frontend.`);
    } else {
      console.log(`Removing unused Turbo default app at ${candidate}.`);
    }

    if (!activeRunOps) {
      throw new Error('Run operations are not initialized.');
    }
    await activeRunOps.removePath(candidateDir, {
      recursive: true,
      force: true,
      markRisk: true,
      note: 'remove default turbo app',
    });
    removed.push(candidate);
  }

  return removed;
}

async function removeDefaultTurboPackages({ rootDir }) {
  const candidate = 'packages/ui';
  const candidateDir = path.join(rootDir, candidate);
  const packageJsonPath = path.join(candidateDir, 'package.json');
  if (!(await pathExists(packageJsonPath))) return [];

  const pkg = await readJson(packageJsonPath);
  if (!isLikelyTurboDefaultUiPackage(pkg)) return [];

  console.log(`Removing unused Turbo default package at ${candidate}.`);
  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.removePath(candidateDir, {
    recursive: true,
    force: true,
    markRisk: true,
    note: 'remove default turbo package',
  });
  return [candidate];
}

async function ensureFrontendApp({ rootDir, frontendPath, frontendName, frontendParentDir }) {
  const frontendDir = path.join(rootDir, frontendPath);
  const frontendExists = await pathExists(frontendDir);
  const isNextApp = frontendExists && (await isNextAppDirectory(frontendDir));

  if (isNextApp) {
    return false;
  }

  if (frontendExists && !(await isDirectoryEmpty(frontendDir))) {
    throw new Error(
      `Frontend directory already exists and is not a Next.js app: ${frontendPath}. Refusing to overwrite.`,
    );
  }

  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.ensureDir(frontendParentDir, {
    note: 'preparacao de diretorio frontend',
  });
  console.log(`Creating Next.js app: ${frontendName}`);
  await runCommand(
    'npx',
    // --disable-git: a nested apps/frontend/.git makes Next treat the app as workspace root
    // latest, never a pinned major: only the current major gets security patches (Next 15 went EOL on 2026-10-21)
    ['create-next-app@latest', frontendName, '--yes', '--use-npm', '--src-dir', '--disable-git'],
    frontendParentDir,
  );
  return true;
}

async function ensureBackendApp({ rootDir, backendPath, backendName, backendParentDir, skipGlobalNest }) {
  const backendDir = path.join(rootDir, backendPath);
  const backendExists = await pathExists(backendDir);
  const isNestApp = backendExists && (await isNestAppDirectory(backendDir));

  if (isNestApp) {
    return false;
  }

  if (backendExists && !(await isDirectoryEmpty(backendDir))) {
    throw new Error(`Backend directory already exists and is not a NestJS app: ${backendPath}. Refusing to overwrite.`);
  }

  if (!skipGlobalNest) {
    const hasNest = await commandExists('nest');
    if (!hasNest) {
      console.log('Installing @nestjs/cli globally...');
      await runCommand('npm', ['install', '-g', '@nestjs/cli'], rootDir);
    }
  }

  const nestCreateArgs = ['new', backendName, '--skip-git', '--package-manager', 'npm'];

  const hasNestCli = await commandExists('nest');
  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.ensureDir(backendParentDir, {
    note: 'preparacao de diretorio backend',
  });
  if (hasNestCli) {
    console.log(`Creating NestJS app with nest CLI: ${backendName}`);
    await runCommand('nest', nestCreateArgs, backendParentDir);
  } else {
    console.log(`Creating NestJS app with npx: ${backendName}`);
    // latest, never a pinned major: the scaffold is ESM + Vitest and every asset of these skills matches it
    await runCommand('npx', ['--yes', '@nestjs/cli@latest', ...nestCreateArgs], backendParentDir);
  }

  return true;
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertEnvContent(content, entries) {
  const lines = content.split(/\r?\n/);
  const outputLines = [...lines];

  for (const [key, value] of Object.entries(entries)) {
    const keyMatcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
    const existingIndex = outputLines.findIndex((line) => keyMatcher.test(line));
    const targetLine = `${key}=${value}`;

    if (existingIndex >= 0) {
      outputLines[existingIndex] = targetLine;
    } else {
      outputLines.push(targetLine);
    }
  }

  return `${outputLines.join('\n').replace(/\n+$/g, '')}\n`;
}

async function upsertEnvFile(filePath, entries) {
  const previous = (await pathExists(filePath)) ? await fs.readFile(filePath, 'utf8') : '';
  const next = upsertEnvContent(previous, entries);

  if (previous === next) {
    return false;
  }

  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.writeTextFile(filePath, next, {
    ensureNewline: false,
    markRiskOnOverwrite: true,
    note: path.basename(filePath),
  });
  return true;
}

async function writeEnvFiles({
  rootDir,
  frontendPath,
  backendPath,
  frontendPort,
  backendPort,
  frontendApiUrlEnvVar,
  backendPortEnvVar,
}) {
  const webDir = path.join(rootDir, frontendPath);
  const backendDir = path.join(rootDir, backendPath);
  const frontendEntries = {
    [frontendApiUrlEnvVar]: `http://localhost:${backendPort}`,
    PORT: String(frontendPort),
  };
  const backendEntries = {
    [backendPortEnvVar]: String(backendPort),
    FRONTEND_URL: `http://localhost:${frontendPort}`,
    DATABASE_URL: '"postgresql://docker:docker@localhost:5432/docker?schema=public"',
  };
  // the example documents the key; the real .env gets a secret of its own, generated once and never rewritten
  const backendEnvPath = path.join(backendDir, '.env');
  const backendEnv = (await pathExists(backendEnvPath)) ? await fs.readFile(backendEnvPath, 'utf8') : '';
  const backendExampleEntries = { ...backendEntries, JWT_SECRET: '"change-me-change-me-change-me-change-me"' };
  const backendEnvEntries = /^\s*JWT_SECRET\s*=/m.test(backendEnv)
    ? backendEntries
    : { ...backendEntries, JWT_SECRET: randomBytes(32).toString('hex') };

  const changedFiles = [];

  for (const dir of [webDir, backendDir]) {
    if (await keepEnvExampleTracked(dir)) changedFiles.push(path.relative(rootDir, path.join(dir, '.gitignore')));
  }
  if (await upsertEnvFile(path.join(webDir, '.env.example'), frontendEntries)) {
    changedFiles.push(path.join(frontendPath, '.env.example'));
  }
  if (await upsertEnvFile(path.join(webDir, '.env'), frontendEntries)) {
    changedFiles.push(path.join(frontendPath, '.env'));
  }
  if (await upsertEnvFile(path.join(backendDir, '.env.example'), backendExampleEntries)) {
    changedFiles.push(path.join(backendPath, '.env.example'));
  }
  if (await upsertEnvFile(backendEnvPath, backendEnvEntries)) {
    changedFiles.push(path.join(backendPath, '.env'));
  }

  return changedFiles;
}

// create-next-app's .gitignore has `.env*`, which also hides .env.example: the one env file that must be committed
async function keepEnvExampleTracked(dir) {
  const file = path.join(dir, '.gitignore');
  if (!(await pathExists(file))) return false;
  const content = await fs.readFile(file, 'utf8');
  if (!/^\.env\*?\s*$/m.test(content) || /^!\.env\.example\s*$/m.test(content)) return false;
  await fs.writeFile(file, `${content.replace(/\s*$/, '')}\n!.env.example\n`);
  return true;
}

// everything a release on one Docker host needs; created once, then the project owns them
async function writeReleaseFiles({
  rootDir,
  frontendPath,
  backendPath,
  frontendPackageName,
  backendPackageName,
  frontendPort,
  backendPort,
  frontendApiUrlEnvVar,
  backendPortEnvVar,
}) {
  const nodeMajor = (await fs.readFile(path.join(rootDir, '.nvmrc'), 'utf8')).trim();
  // compose project name = directory name, normalized the way compose does it
  const project = path.basename(rootDir).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const files = {
    [`${backendPath}/Dockerfile`]: `# syntax=docker/dockerfile:1
# Build context is the monorepo root: docker build -f ${backendPath}/Dockerfile .
FROM node:${nodeMajor}-alpine AS base
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1

# only the workspaces ${backendPackageName} depends on, with the lockfile pruned to them
FROM base AS pruner
RUN npm install -g turbo
COPY . .
RUN turbo prune ${backendPackageName} --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
# the backend's prebuild runs prisma generate; prisma.config.ts resolves DATABASE_URL at load and generate never connects, so any well-formed URL will do
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx turbo run build
# ponytail: devDependencies stay so \`prisma migrate deploy\` runs from this image (service migrate); split a migrate image when size matters

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app .
USER node
EXPOSE ${backendPort}
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \\
  CMD wget -qO- http://127.0.0.1:\${${backendPortEnvVar}:-${backendPort}}/health || exit 1
CMD ["node", "${backendPath}/dist/main.js"]
`,
    [`${frontendPath}/Dockerfile`]: `# syntax=docker/dockerfile:1
# Build context is the monorepo root: docker build -f ${frontendPath}/Dockerfile .
FROM node:${nodeMajor}-alpine AS base
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1

FROM base AS pruner
RUN npm install -g turbo
COPY . .
RUN turbo prune ${frontendPackageName} --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
# NEXT_PUBLIC_* is inlined at build time: this is the URL the browser calls
ARG ${frontendApiUrlEnvVar}
ENV ${frontendApiUrlEnvVar}=\$${frontendApiUrlEnvVar}
RUN npx turbo run build

# output: 'standalone' (next.config): the server and only the files it traced
FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=${frontendPort}
COPY --from=builder --chown=node:node /app/${frontendPath}/.next/standalone ./
COPY --from=builder --chown=node:node /app/${frontendPath}/.next/static ./${frontendPath}/.next/static
COPY --from=builder --chown=node:node /app/${frontendPath}/public ./${frontendPath}/public
USER node
EXPOSE ${frontendPort}
CMD ["node", "${frontendPath}/server.js"]
`,
    '.dockerignore': `node_modules
**/node_modules
**/dist
**/.next
**/.turbo
coverage
.git
**/.env*
.scratch
.log
backups
.claude
`,
    'docker-compose.prod.yml': `# One Docker host: Postgres, the backend (after \`prisma migrate deploy\`) and the frontend.
# Variables come from ./.env (copy .env.example). \`npm run release\` builds, migrates and starts.
services:
  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: \${POSTGRES_DB:-app}
    volumes:
      # postgres 18+ keeps its data one level up; the old /data path makes the image refuse to start
      - postgres_data:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $\${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5

  # one-shot, same image as the backend: applies pending migrations, then exits
  migrate:
    build: &backend-build
      context: .
      dockerfile: ${backendPath}/Dockerfile
    image: ${project}-backend
    working_dir: /app/${backendPath}
    command: ['npx', 'prisma', 'migrate', 'deploy']
    environment:
      MIGRATION_DATABASE_URL: &owner-url postgresql://\${POSTGRES_USER:-app}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB:-app}?schema=public
    depends_on:
      postgres:
        condition: service_healthy
    restart: 'no'

  # one-shot, after migrate: the runtime role (owns nothing) gets its grants on the new tables
  roles:
    build: *backend-build
    image: ${project}-backend
    working_dir: /app/${backendPath}
    command: ['node', 'db/roles.mjs']
    environment:
      MIGRATION_DATABASE_URL: *owner-url
      APP_DB_PASSWORD: \${APP_DB_PASSWORD:?set APP_DB_PASSWORD in .env}
    depends_on:
      migrate:
        condition: service_completed_successfully
    restart: 'no'

  backend:
    build: *backend-build
    image: ${project}-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      ${backendPortEnvVar}: ${backendPort}
      DATABASE_URL: postgresql://app_runtime:\${APP_DB_PASSWORD}@postgres:5432/\${POSTGRES_DB:-app}?schema=public
      JWT_SECRET: \${JWT_SECRET:?set JWT_SECRET in .env}
      FRONTEND_URL: \${FRONTEND_URL:-http://localhost:${frontendPort}}
      LOG_LEVEL: \${LOG_LEVEL:-info}
    ports:
      - '\${BACKEND_PORT:-${backendPort}}:${backendPort}'
    depends_on:
      roles:
        condition: service_completed_successfully

  frontend:
    build:
      context: .
      dockerfile: ${frontendPath}/Dockerfile
      args:
        ${frontendApiUrlEnvVar}: \${${frontendApiUrlEnvVar}:-http://localhost:${backendPort}}
    image: ${project}-frontend
    restart: unless-stopped
    ports:
      - '\${FRONTEND_PORT:-${frontendPort}}:${frontendPort}'
    depends_on:
      backend:
        condition: service_healthy

volumes:
  postgres_data:
`,
    '.env.example': `# Release variables for docker-compose.prod.yml (npm run release). Copy to .env on the host; never commit .env.
# Local development reads ${backendPath}/.env and ${frontendPath}/.env instead.
POSTGRES_USER=app
POSTGRES_PASSWORD=
POSTGRES_DB=app
# password of app_runtime, the role the app connects as (it owns nothing): openssl rand -hex 16
APP_DB_PASSWORD=
# at least 32 characters: openssl rand -hex 32
JWT_SECRET=
# the URLs the browser uses: the frontend (CORS origin for the backend) and the backend
FRONTEND_URL=http://localhost:${frontendPort}
${frontendApiUrlEnvVar}=http://localhost:${backendPort}
# host ports
BACKEND_PORT=${backendPort}
FRONTEND_PORT=${frontendPort}
LOG_LEVEL=info
`,
  };

  const created = [];
  for (const [relPath, content] of Object.entries(files)) {
    const filePath = path.join(rootDir, relPath);
    if (await pathExists(filePath)) continue;
    await activeRunOps.writeTextFile(filePath, content, { ensureNewline: false, note: 'release' });
    created.push(relPath);
  }
  return created;
}

async function patchRootPackageJson(rootDir, scope) {
  const packagePath = path.join(rootDir, 'package.json');
  const pkg = await readJson(packagePath);
  const repoName = `${scope || '@namespace'}/workspace`;

  if (!pkg.name || pkg.name === 'turbo-template') {
    pkg.name = repoName;
  }

  pkg.scripts = pkg.scripts ?? {};
  // boundaries first: a module that imports a framework fails before any suite runs
  pkg.scripts.test = 'node scripts/check-boundaries.mjs && turbo run test';
  // capacity is a test: p95 per route against perf.config.json, after npm test in CI (architecture rule 11)
  pkg.scripts.perf = 'node scripts/perf.mjs';
  // one worktree per ticket from one command: branch, env, ports, own database, install, generate, migrate, roles, seed, build
  pkg.scripts.worktree = 'node scripts/worktree.mjs';
  // mutation testing per module (StrykerJS, Apache 2.0): the quality-engineer runs it on the modules a diff touched
  pkg.scripts.mutation = 'node scripts/mutation.mjs';
  pkg.scripts['check:pr'] = pkg.scripts['check:pr'] ?? 'node scripts/check-pr.mjs';
  pkg.scripts['db:scratch'] = pkg.scripts['db:scratch'] ?? 'node scripts/db-scratch.mjs';
  pkg.scripts.goal = pkg.scripts.goal ?? 'node scripts/goal.mjs';
  // a turbo cache restore never deletes: an old .next would sit next to the restored build (#78)
  pkg.scripts.prebuild = pkg.scripts.prebuild ?? 'node scripts/clean-next.mjs';
  pkg.devDependencies = pkg.devDependencies ?? {};
  // "*": the lockfile pins what npm install resolved, Dependabot moves it; nothing is pinned by hand
  pkg.devDependencies['@stryker-mutator/core'] = pkg.devDependencies['@stryker-mutator/core'] ?? '*';
  pkg.devDependencies['@stryker-mutator/vitest-runner'] = pkg.devDependencies['@stryker-mutator/vitest-runner'] ?? '*';
  pkg.scripts.format = pkg.scripts.format ?? 'prettier --write "**/*.{ts,tsx,md}"';
  // the release: build both images, run `prisma migrate deploy` (service migrate), start, wait for healthy
  pkg.scripts.release = pkg.scripts.release ?? 'docker compose -f docker-compose.prod.yml up -d --build --wait';

  await writeJson(packagePath, pkg);

  // the architecture the script enforces, in the project where every agent reads it first
  const architectureDoc = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'ARCHITECTURE.md');
  await activeRunOps.writeTextFile(path.join(rootDir, 'docs', 'architecture.md'), await fs.readFile(architectureDoc, 'utf8'), {
    note: 'architecture rules',
    markRiskOnOverwrite: false,
  });
  const checkScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'check-boundaries.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'check-boundaries.mjs'), await fs.readFile(checkScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'modular monolith boundaries, run by npm test',
  });
  const perfScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'perf.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'perf.mjs'), await fs.readFile(perfScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'p95 budget per route, run by npm run perf',
  });
  const worktreeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'worktree.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'worktree.mjs'), await fs.readFile(worktreeScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'worktree per ticket, run by npm run worktree -- up|down',
  });
  const mutationScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'mutation.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'mutation.mjs'), await fs.readFile(mutationScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'mutation testing of one module, run by npm run mutation -- <module>',
  });
  const checkPrScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'check-pr.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'check-pr.mjs'), await fs.readFile(checkPrScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'the pull-request-only gates of ci.yml, run locally before the PR',
  });
  const dbScratchScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'db-scratch.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'db-scratch.mjs'), await fs.readFile(dbScratchScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'a throwaway database for one command: created, migrated, seeded, dropped',
  });
  const goalScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'goal.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'goal.mjs'), await fs.readFile(goalScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'the goal contract by script: check its shape, run its proofs, measure its size',
  });
  const cleanNextScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts', 'clean-next.mjs');
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', 'clean-next.mjs'), await fs.readFile(cleanNextScript, 'utf8'), {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'empties apps/*/.next before npm run build, so a turbo cache restore never mixes two builds',
  });
  // What the plugin installed, by hash: tooling-sync.mjs later replaces only the scripts the project never changed.
  const scriptAssets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'scripts');
  const installed = {};
  for (const name of (await fs.readdir(scriptAssets)).filter((one) => one.endsWith('.mjs')).sort()) {
    const text = (await fs.readFile(path.join(scriptAssets, name), 'utf8')).replace(/\r\n/g, '\n');
    installed[`scripts/${name}`] = createHash('sha256').update(text).digest('hex');
  }
  const pluginManifest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.claude-plugin', 'plugin.json');
  const pluginVersion = JSON.parse(await fs.readFile(pluginManifest, 'utf8')).version;
  await activeRunOps.writeTextFile(path.join(rootDir, 'scripts', '.squad-tooling.json'), `${JSON.stringify({ plugin: pluginVersion, installed, kept: {} }, null, 2)}\n`, {
    ensureNewline: false,
    markRiskOnOverwrite: false,
    note: 'which version of the squad scripts this project holds, read by tooling-sync.mjs',
  });
  // Stryker's scratch and incremental report stay out of git, and so does .engineer.local.json: the Engineer keeps each person's conversation language there
  const rootGitignore = path.join(rootDir, '.gitignore');
  if (await pathExists(rootGitignore)) {
    const ignored = await fs.readFile(rootGitignore, 'utf8');
    const missing = ['.stryker-tmp/', 'reports/stryker-incremental.json', '.engineer.local.json'].filter((line) => !ignored.split(/\r?\n/).includes(line));
    if (missing.length > 0) await fs.writeFile(rootGitignore, `${ignored.replace(/\s*$/, '')}\n${missing.join('\n')}\n`);
  }
  // the squad runs unattended after the interview: without this allowlist every npm/git/gh/docker call stops for a prompt.
  // Written once; the project widens or narrows it. Destructive git stays denied.
  const claudeSettingsPath = path.join(rootDir, '.claude', 'settings.json');
  if (!(await pathExists(claudeSettingsPath))) {
    await fs.mkdir(path.dirname(claudeSettingsPath), { recursive: true });
    await writeJson(claudeSettingsPath, {
      permissions: {
        allow: ['Bash(npm *)', 'Bash(npx *)', 'Bash(node *)', 'Bash(turbo *)', 'Bash(git *)', 'Bash(gh *)', 'Bash(docker *)', 'Bash(curl *)'],
        deny: ['Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git reset --hard*)', 'Bash(git clean*)', 'Bash(gh repo delete*)'],
      },
    });
  }
  // the budgets are the project's to tune, so they are written once; config-new-module adds each module's list route
  const perfConfigPath = path.join(rootDir, 'perf.config.json');
  if (!(await pathExists(perfConfigPath))) {
    await writeJson(perfConfigPath, {
      connections: 20,
      durationSeconds: 10,
      routes: [
        { path: '/health', p95Ms: 50 },
        { path: '/ready', p95Ms: 50 },
      ],
    });
  }
}

async function ensureRootPrettierConfig(rootDir) {
  const prettierConfigPath = path.join(rootDir, '.prettierrc');
  const expectedContent = `${JSON.stringify(DEFAULT_PRETTIER_CONFIG, null, 2)}\n`;
  const fileExists = await pathExists(prettierConfigPath);
  const previousContent = fileExists
    ? await fs.readFile(prettierConfigPath, 'utf8')
    : '';

  if (previousContent === expectedContent) {
    return { updated: false, created: false };
  }

  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.writeTextFile(prettierConfigPath, expectedContent, {
    ensureNewline: false,
    markRiskOnOverwrite: true,
    note: '.prettierrc',
  });
  return { updated: true, created: !fileExists };
}

async function patchBackendPackageJson({ rootDir, backendPath }) {
  const packagePath = path.join(rootDir, backendPath, 'package.json');
  if (!(await pathExists(packagePath))) {
    return { updated: false, skipped: true };
  }

  const pkg = await readJson(packagePath);
  const original = JSON.stringify(pkg);

  pkg.scripts = pkg.scripts ?? {};
  if (!pkg.scripts.dev) {
    pkg.scripts.dev = pkg.scripts['start:dev'] ?? 'nest start --watch';
  }

  const next = JSON.stringify(pkg);
  if (next === original) {
    return { updated: false, skipped: false };
  }

  await writeJson(packagePath, pkg);
  return { updated: true, skipped: false };
}

async function patchTurboJson(rootDir) {
  const turboPath = path.join(rootDir, 'turbo.json');
  const turbo = await readJson(turboPath);

  turbo.tasks = turbo.tasks ?? {};
  turbo.tasks.build = turbo.tasks.build ?? {};
  turbo.tasks.build.outputs = ensureArrayValue(turbo.tasks.build.outputs, 'dist/**');
  // Next's own cache is not the build: restored by turbo it mixed with the next build's (#78)
  if (turbo.tasks.build.outputs.includes('.next/**')) {
    turbo.tasks.build.outputs = ensureArrayValue(turbo.tasks.build.outputs, '!.next/cache/**');
  }
  // turbo's strict env hides these from the task, and the backend's prebuild (prisma generate) loads prisma.config.ts,
  // which resolves the URL at load. passThroughEnv: visible to the task, not part of the cache hash.
  turbo.tasks.build.passThroughEnv = ensureArrayValue(
    ensureArrayValue(turbo.tasks.build.passThroughEnv, 'DATABASE_URL'),
    'MIGRATION_DATABASE_URL',
  );

  turbo.tasks.test = {
    ...(turbo.tasks.test ?? {}),
    cache: false,
  };

  await writeJson(turboPath, turbo);
}

async function patchBackendMain({ rootDir, backendPath, backendPort, backendPortEnvVar }) {
  const mainPath = path.join(rootDir, backendPath, 'src', 'main.ts');
  if (!(await pathExists(mainPath))) {
    return { updated: false, skipped: true };
  }

  let content = await fs.readFile(mainPath, 'utf8');
  const original = content;

  if (content.includes('import "dotenv/config";')) {
    content = content.replace('import "dotenv/config";', "import 'dotenv/config';");
  }

  if (!content.includes("import 'dotenv/config';")) {
    content = `import 'dotenv/config';\n${content}`;
  }

  // CORS only for the frontend; without FRONTEND_URL the API answers no cross-origin request at all
  if (!content.includes('app.enableCors(')) {
    content = content.replace(
      /const app = await NestFactory\.create\(AppModule\);\s*/,
      "const app = await NestFactory.create(AppModule);\n  app.enableCors({ origin: process.env.FRONTEND_URL?.split(',') ?? false });\n",
    );
  }

  const portVariableName = `process.env.${backendPortEnvVar}`;
  const desiredPortLine = `const port = Number(${portVariableName} ?? ${backendPort});`;
  const portAssignmentRegex = /const\s+port\s*=\s*[^;]+;/;
  const listenCallRegex = /await app\.listen\(([^;]+)\);/;

  if (portAssignmentRegex.test(content)) {
    content = content.replace(portAssignmentRegex, desiredPortLine);
    content = content.replace(listenCallRegex, 'await app.listen(port);');
  } else if (listenCallRegex.test(content)) {
    content = content.replace(listenCallRegex, `${desiredPortLine}\n  await app.listen(port);`);
  }

  if (content === original) {
    return { updated: false, skipped: false };
  }

  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.writeTextFile(mainPath, content, {
    ensureNewline: false,
    markRiskOnOverwrite: true,
    note: 'backend main.ts',
  });
  return { updated: true, skipped: false };
}

function findMatchingToken(content, startIndex, openToken, closeToken) {
  let depth = 0;
  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];

    if (char === openToken) {
      depth += 1;
      continue;
    }

    if (char === closeToken) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function hasWildcardPatternForProtocol(patternContent, protocol) {
  const protocolMatcher = new RegExp(`protocol\\s*:\\s*["']${escapeRegExp(protocol)}["']`);
  const hostnameMatcher = /hostname\s*:\s*["']\*\*["']/;
  return protocolMatcher.test(patternContent) && hostnameMatcher.test(patternContent);
}

function buildRemotePatternItem(protocol, indent) {
  return [`${indent}{`, `${indent}  protocol: "${protocol}",`, `${indent}  hostname: "**",`, `${indent}}`].join('\n');
}

function ensureNextRemotePatterns(content) {
  const nextConfigDeclaration = /const\s+nextConfig(?:\s*:\s*NextConfig)?\s*=\s*\{/m;
  const declarationMatch = nextConfigDeclaration.exec(content);

  if (!declarationMatch || declarationMatch.index === undefined) {
    return { updated: false, nextContent: content, reason: 'unsupported-structure' };
  }

  const declarationStart = declarationMatch.index;
  const configObjectStart = declarationStart + declarationMatch[0].lastIndexOf('{');
  const configObjectEnd = findMatchingToken(content, configObjectStart, '{', '}');

  if (configObjectEnd < 0) {
    return { updated: false, nextContent: content, reason: 'unbalanced-config' };
  }

  const configBody = content.slice(configObjectStart + 1, configObjectEnd);
  const imagesBlockRegex = /\bimages\s*:\s*\{/m;
  const imagesMatch = imagesBlockRegex.exec(configBody);

  if (!imagesMatch) {
    const remotePatternsBlock = [
      '  images: {',
      '    remotePatterns: [',
      buildRemotePatternItem('https', '      ') + ',',
      buildRemotePatternItem('http', '      '),
      '    ],',
      '  },',
    ].join('\n');

    const injected = `${content.slice(
      0,
      configObjectStart + 1,
    )}\n${remotePatternsBlock}${content.slice(configObjectStart + 1)}`;
    return { updated: true, nextContent: injected, reason: 'inserted-images-block' };
  }

  const imagesAbsoluteStart = configObjectStart + 1 + imagesMatch.index + imagesMatch[0].lastIndexOf('{');
  const imagesAbsoluteEnd = findMatchingToken(content, imagesAbsoluteStart, '{', '}');

  if (imagesAbsoluteEnd < 0) {
    return { updated: false, nextContent: content, reason: 'unbalanced-images' };
  }

  const imagesBody = content.slice(imagesAbsoluteStart + 1, imagesAbsoluteEnd);
  const remotePatternsRegex = /\bremotePatterns\s*:\s*\[/m;
  const remotePatternsMatch = remotePatternsRegex.exec(imagesBody);

  if (!remotePatternsMatch) {
    const remotePatternsBlock = [
      '    remotePatterns: [',
      buildRemotePatternItem('https', '      ') + ',',
      buildRemotePatternItem('http', '      '),
      '    ],',
    ].join('\n');

    const injected = `${content.slice(
      0,
      imagesAbsoluteStart + 1,
    )}\n${remotePatternsBlock}${content.slice(imagesAbsoluteStart + 1)}`;
    return {
      updated: true,
      nextContent: injected,
      reason: 'inserted-remote-patterns',
    };
  }

  const remotePatternsAbsoluteStart =
    imagesAbsoluteStart + 1 + remotePatternsMatch.index + remotePatternsMatch[0].lastIndexOf('[');
  const remotePatternsAbsoluteEnd = findMatchingToken(content, remotePatternsAbsoluteStart, '[', ']');

  if (remotePatternsAbsoluteEnd < 0) {
    return {
      updated: false,
      nextContent: content,
      reason: 'unbalanced-remote-patterns',
    };
  }

  const remotePatternsBody = content.slice(remotePatternsAbsoluteStart + 1, remotePatternsAbsoluteEnd);
  const hasHttps = hasWildcardPatternForProtocol(remotePatternsBody, 'https');
  const hasHttp = hasWildcardPatternForProtocol(remotePatternsBody, 'http');

  if (hasHttps && hasHttp) {
    return { updated: false, nextContent: content, reason: 'already-configured' };
  }

  const missingItems = [];
  if (!hasHttps) {
    missingItems.push(buildRemotePatternItem('https', '      '));
  }
  if (!hasHttp) {
    missingItems.push(buildRemotePatternItem('http', '      '));
  }

  const trimmedPatternsBody = remotePatternsBody.trim();
  const prependComma = trimmedPatternsBody.length > 0 && !trimmedPatternsBody.endsWith(',');
  const addition = `${prependComma ? ',' : ''}\n${missingItems.join(',\n')}\n    `;

  const injected = `${content.slice(
    0,
    remotePatternsAbsoluteEnd,
  )}${addition}${content.slice(remotePatternsAbsoluteEnd)}`;
  return {
    updated: true,
    nextContent: injected,
    reason: 'appended-missing-patterns',
  };
}

// output: 'standalone' is what apps/frontend/Dockerfile copies: the server plus only the files it traced
function ensureNextStandaloneOutput(content) {
  if (/\boutput\s*:/.test(content)) return content;
  return content.replace(/(const\s+nextConfig(?:\s*:\s*NextConfig)?\s*=\s*\{)/m, "$1\n  output: 'standalone',");
}

async function patchFrontendNextConfig({ rootDir, frontendPath }) {
  const frontendDir = path.join(rootDir, frontendPath);
  const candidates = ['next.config.ts', 'next.config.mjs', 'next.config.js'];
  let configPath = '';

  for (const candidate of candidates) {
    const absolutePath = path.join(frontendDir, candidate);
    if (await pathExists(absolutePath)) {
      configPath = absolutePath;
      break;
    }
  }

  if (!configPath) {
    return { updated: false, skipped: true, reason: 'file-not-found', file: '' };
  }

  const content = await fs.readFile(configPath, 'utf8');
  const patchResult = ensureNextRemotePatterns(content);
  const nextContent = ensureNextStandaloneOutput(patchResult.nextContent);

  if (nextContent === content) {
    return {
      updated: false,
      skipped: false,
      reason: patchResult.reason,
      file: path.relative(rootDir, configPath).replace(/\\/g, '/'),
    };
  }

  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.writeTextFile(configPath, nextContent, {
    ensureNewline: false,
    markRiskOnOverwrite: true,
    note: path.basename(configPath),
  });
  return {
    updated: true,
    skipped: false,
    reason: patchResult.reason,
    file: path.relative(rootDir, configPath).replace(/\\/g, '/'),
  };
}

async function main() {
  // The release cooldown holds from the first install, not from the moment .npmrc is written further down:
  // create-turbo and the Nest CLI install before that file exists, and a version published hours earlier got into
  // the lockfile (2026-11-11: a native binary so new that Windows refused to load it). Every npm and npx this
  // script starts inherits it; a dist-tag newer than the window resolves to the newest version inside it.
  process.env.npm_config_min_release_age ??= '3';
  // Always apply bootstrap to the current working directory where the user invokes the skill.
  const rootDir = process.cwd();
  const logger = await createSkillRunLogger({
    rootDir,
    skillName: 'config-project',
    commandArgs: process.argv.slice(2),
    deferGitignoreEnsure: true,
    gitignoreCreateIfMissing: false,
  });

  try {
    activeRunLogger = logger;
    activeRunOps = createSkillRunOps({
      rootDir,
      logger,
      dryRun: false,
    });
    const skillConfig = await loadSkillConfig(rootDir);

    const {
      frontendPath,
      backendPath,
      frontendPort,
      backendPort,
      frontendApiUrlEnvVar,
      backendPortEnvVar,
      scope: scopeArg,
      skipGlobalNest,
    } = parseArgs(process.argv.slice(2), skillConfig.defaults);

    const { scope } = await resolveNamespace({
      rootDir,
      cliScope: scopeArg,
      fallbackScope: skillConfig.defaults.namespace,
    });

    const frontendDir = path.join(rootDir, frontendPath);
    const backendDir = path.join(rootDir, backendPath);
    const frontendParentDir = path.dirname(frontendDir);
    const backendParentDir = path.dirname(backendDir);
    const frontendName = path.basename(frontendPath);
    const backendName = path.basename(backendPath);
    const frontendPackageName = `${scope}/${frontendName}`;
    const backendPackageName = `${scope}/${backendName}`;

    console.log(
      `Bootstrap config: scope="${scope}", frontendPath="${frontendPath}:${frontendPort}", backendPath="${backendPath}:${backendPort}"`,
    );
    logger.step(
      `Resolved config: scope=${scope}, frontend=${frontendPath}:${frontendPort}, backend=${backendPath}:${backendPort}.`,
    );

    const turboResult = await ensureTurboRoot(rootDir, scope);
    if (turboResult.scaffoldedWithCreateTurbo) {
      const copiedCount = turboResult.copiedScaffoldPaths.length;
      console.log(`TurboRepo base reconciled using create-turbo (copied missing paths: ${copiedCount}).`);
      logger.step(`TurboRepo base reconciled with create-turbo (items copied: ${copiedCount}).`);
    } else if (turboResult.createdTurbo || turboResult.createdPackageJson) {
      const createdItems = [];
      if (turboResult.createdPackageJson) createdItems.push('package.json');
      if (turboResult.createdTurbo) createdItems.push('turbo.json');
      console.log(`TurboRepo base created/updated: ${createdItems.join(', ')}`);
      logger.step(`TurboRepo base created/updated: ${createdItems.join(', ')}.`);
    } else {
      console.log('TurboRepo already detected at current directory.');
      logger.step('TurboRepo structure already present in the current directory.');
    }

    const removedDefaultApps = await removeDefaultTurboApps({
      rootDir,
      frontendPath,
      backendPath,
    });
    const removedDefaultPackages = await removeDefaultTurboPackages({ rootDir });
    const removedDefaultProjects = [...removedDefaultApps, ...removedDefaultPackages];
    if (removedDefaultProjects.length > 0) {
      console.log(`Removed default Turbo template projects before app bootstrap: ${removedDefaultProjects.join(', ')}`);
      logger.step(`Default Turbo projects removed before the bootstrap: ${removedDefaultProjects.join(', ')}.`);
    } else {
      console.log('No default Turbo template projects needed removal.');
      logger.step('No default Turbo project needed removing.');
    }

    const frontendCreated = await ensureFrontendApp({
      rootDir,
      frontendPath,
      frontendName,
      frontendParentDir,
    });
    console.log(
      frontendCreated ? `Frontend app created at ${frontendPath}.` : `Frontend app already exists at ${frontendPath}.`,
    );
    logger.step(frontendCreated ? `Frontend created at ${frontendPath}.` : `Frontend already existed at ${frontendPath}.`);

    const backendCreated = await ensureBackendApp({
      rootDir,
      backendPath,
      backendName,
      backendParentDir,
      skipGlobalNest,
    });
    console.log(
      backendCreated ? `Backend app created at ${backendPath}.` : `Backend app already exists at ${backendPath}.`,
    );
    logger.step(backendCreated ? `Backend created at ${backendPath}.` : `Backend already existed at ${backendPath}.`);

    const frontendPackagePath = path.join(frontendDir, 'package.json');
    const backendPackagePath = path.join(backendDir, 'package.json');

    // the Nest CLI's README is its own project's (badges with a CircleCI token gitleaks flags); the backend's says what it is
    const backendReadme = path.join(backendDir, 'README.md');
    if ((await pathExists(backendReadme)) && (await fs.readFile(backendReadme, 'utf8')).includes('nestjs/nest')) {
      await activeRunOps.writeTextFile(
        backendReadme,
        `# ${scope} backend

NestJS API of the modular monolith: one Nest module per domain module under \`src/modules/\`, the shared layer under \`src/shared/\`, Prisma under \`prisma/\`. Rules in \`../../docs/architecture.md\`.
`,
        { note: 'the backend README, in place of the Nest CLI boilerplate' },
      );
    }

    // the contract every other skill and the Engineer read; nothing else creates these files
    await activeRunOps.writeJsonFile(
      path.join(rootDir, 'skills.config.json'),
      { namespace: scope, sharedModulePath: 'packages/shared', frontendAppPath: frontendPath, backendAppPath: backendPath, frontendPort, backendPort, frontendApiUrlEnvVar, backendPortEnvVar },
      { note: 'skills config', markRiskOnOverwrite: false },
    );
    if (!(await pathExists(path.join(rootDir, '.gitattributes')))) {
      await activeRunOps.writeTextFile(path.join(rootDir, '.gitattributes'), '* text=auto eol=lf\n', { note: 'LF everywhere, Windows included' });
    }
    // supply-chain floor: a 3-day cooldown on new releases (npm >= 11.10) outlives most npm worm waves;
    // a security patch the integration-engineer flagged installs with --min-release-age 0
    const npmrcPath = path.join(rootDir, '.npmrc');
    const npmrc = (await pathExists(npmrcPath)) ? await fs.readFile(npmrcPath, 'utf8') : '';
    if (!/^min-release-age=/m.test(npmrc)) {
      await activeRunOps.writeTextFile(npmrcPath, `${npmrc.trimEnd()}\nmin-release-age=3\n`.trimStart(), { note: 'release cooldown', markRiskOnOverwrite: false });
    }
    // the Node line the project runs on, for CI (setup-node node-version-file) and for humans
    if (!(await pathExists(path.join(rootDir, '.nvmrc')))) {
      await activeRunOps.writeTextFile(path.join(rootDir, '.nvmrc'), `${process.versions.node.split('.')[0]}\n`, { note: 'Node major' });
    }
    const releaseFiles = await writeReleaseFiles({
      rootDir,
      frontendPath,
      backendPath,
      frontendPackageName,
      backendPackageName,
      frontendPort,
      backendPort,
      frontendApiUrlEnvVar,
      backendPortEnvVar,
    });
    if (releaseFiles.length > 0) {
      console.log(`Created release files: ${releaseFiles.join(', ')}`);
      logger.step(`Release files created: ${releaseFiles.join(', ')}.`);
    }
    const dependabotPath = path.join(rootDir, '.github', 'dependabot.yml');
    if (!(await pathExists(dependabotPath))) {
      await activeRunOps.writeTextFile(
        dependabotPath,
        '# One grouped pull request a month per ecosystem: every PR is a CI run, and Actions minutes are a budget.\n# A security fix does not wait for the month: Dependabot security updates open it when the advisory lands.\nversion: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n    schedule:\n      interval: monthly\n    cooldown:\n      default-days: 3\n    commit-message:\n      prefix: "chore(deps)"\n    groups:\n      all:\n        patterns: ["*"]\n  - package-ecosystem: github-actions\n    directory: /\n    schedule:\n      interval: monthly\n    commit-message:\n      prefix: "chore(ci)"\n    groups:\n      all:\n        patterns: ["*"]\n',
        { note: 'one grouped dependency PR a month per ecosystem, with the same cooldown' },
      );
    }
    // The whole CI, written once: one workflow, one job, pull requests only (a private repository pays Actions by the
    // job-minute). The open-source scanners are steps of it: gitleaks (MIT) on the git history, osv-scanner (Apache 2.0)
    // and npm audit on the lockfile when it changed, squawk (GPL 3) on the migrations a PR adds.
    const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
    if (!(await pathExists(ciPath))) {
      const ciAsset = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'workflows', 'ci.yml');
      await activeRunOps.writeTextFile(ciPath, await fs.readFile(ciAsset, 'utf8'), {
        note: 'CI: one job on pull requests, scanners included, by moment: fast checks on every push, the merge gate on a ready PR, the full run nightly on main',
      });
    }
    // root typescript follows the backend scaffold: create-turbo's TS 7 breaks typescript-eslint in the frontend
    const rootPkgPath = path.join(rootDir, 'package.json');
    const rootPkg = await readJson(rootPkgPath);
    const backendTs = (await readJson(backendPackagePath)).devDependencies?.typescript;
    if (backendTs && rootPkg.devDependencies?.typescript && rootPkg.devDependencies.typescript !== backendTs) {
      rootPkg.devDependencies.typescript = backendTs;
      await activeRunOps.writeJsonFile(rootPkgPath, rootPkg, { note: `typescript ${backendTs} as in the backend`, markRiskOnOverwrite: false });
      await runCommand('npm', ['install', '--no-audit', '--no-fund'], rootDir);
    }

    const workspaceNamespaceResult = await applyNamespaceToWorkspacePackages({
      rootDir,
      scope,
    });
    const frontendNameChanged = await ensurePackageName(frontendPackagePath, frontendPackageName);
    const backendNameChanged = await ensurePackageName(backendPackagePath, backendPackageName);

    const namespaceChanged =
      workspaceNamespaceResult.changedPackageJsonPaths.length > 0 || frontendNameChanged || backendNameChanged;
    if (namespaceChanged) {
      const nextFrontendName = await readPackageName(frontendPackagePath);
      const nextBackendName = await readPackageName(backendPackagePath);
      console.log(
        `Namespace synchronized (${workspaceNamespaceResult.packageCount} workspace packages): frontend="${nextFrontendName}", backend="${nextBackendName}"`,
      );
      logger.step(`Namespace synchronized across ${workspaceNamespaceResult.packageCount} workspace packages.`);
    } else {
      console.log('Namespace already applied to workspace/front-end/back-end packages.');
      logger.step('Namespace was already applied to the workspace/frontend/backend.');
    }

    const turboInstalled = await ensureDependency({
      packageJsonPath: path.join(rootDir, 'package.json'),
      depName: 'turbo',
      installCommand: 'npm',
      installArgs: ['install', '-D', 'turbo'],
      cwd: rootDir,
    });
    if (!turboInstalled) {
      console.log('Dependency already present at root: turbo');
      logger.step('turbo dependency already present at the root.');
    } else {
      logger.step('turbo dependency installed at the root.');
    }

    const prettierInstalled = await ensureDependency({
      packageJsonPath: path.join(rootDir, 'package.json'),
      depName: 'prettier',
      installCommand: 'npm',
      installArgs: ['install', '-D', 'prettier@^3.7.4'],
      cwd: rootDir,
    });
    if (!prettierInstalled) {
      console.log('Dependency already present at root: prettier');
      logger.step('prettier dependency already present at the root.');
    } else {
      logger.step('prettier dependency installed at the root.');
    }

    const dotenvInstalled = await ensureDependency({
      packageJsonPath: backendPackagePath,
      depName: 'dotenv',
      installCommand: 'npm',
      installArgs: ['install', 'dotenv'],
      cwd: backendDir,
    });
    if (!dotenvInstalled) {
      console.log(`Dependency already present in ${backendPath}: dotenv`);
      logger.step(`dotenv dependency already present in ${backendPath}.`);
    } else {
      logger.step(`dotenv dependency installed in ${backendPath}.`);
    }

    await patchRootPackageJson(rootDir, scope);
    logger.step('Root package.json updated incrementally.');

    const prettierConfigResult = await ensureRootPrettierConfig(rootDir);
    if (prettierConfigResult.updated) {
      console.log(
        prettierConfigResult.created
          ? 'Created .prettierrc at repository root.'
          : 'Updated .prettierrc at repository root.',
      );
      logger.step(
        prettierConfigResult.created
          ? '.prettierrc created at the repository root.'
          : '.prettierrc updated at the repository root.',
      );
    } else {
      console.log('.prettierrc already configured at repository root.');
      logger.step('.prettierrc was already configured at the repository root.');
    }

    const backendPackagePatchResult = await patchBackendPackageJson({
      rootDir,
      backendPath,
    });
    if (backendPackagePatchResult.updated) {
      console.log(`Updated ${backendPath}/package.json`);
      logger.step(`${backendPath}/package.json updated.`);
    } else if (backendPackagePatchResult.skipped) {
      console.log(`Skipped ${backendPath}/package.json (file not found).`);
      logger.step(`${backendPath}/package.json skipped (file missing).`);
    } else {
      console.log(`${backendPath}/package.json already configured.`);
      logger.step(`${backendPath}/package.json was already configured.`);
    }

    await patchTurboJson(rootDir);
    logger.step('turbo.json updated incrementally.');

    const frontendConfigPatchResult = await patchFrontendNextConfig({
      rootDir,
      frontendPath,
    });
    if (frontendConfigPatchResult.updated) {
      console.log(`Updated ${frontendConfigPatchResult.file} (images.remotePatterns liberado para http/https).`);
      logger.step(`${frontendConfigPatchResult.file} updated with images.remotePatterns for http/https.`);
    } else if (frontendConfigPatchResult.skipped) {
      console.log(`Skipped Next config patch at ${frontendPath} (${frontendConfigPatchResult.reason}).`);
      logger.step(`Next image config skipped in ${frontendPath} (${frontendConfigPatchResult.reason}).`);
    } else {
      console.log(
        `${frontendConfigPatchResult.file} already configured for remote images (${frontendConfigPatchResult.reason}).`,
      );
      logger.step(`${frontendConfigPatchResult.file} was already configured for remote images.`);
    }

    const mainPatchResult = await patchBackendMain({
      rootDir,
      backendPath,
      backendPort,
      backendPortEnvVar,
    });
    if (mainPatchResult.updated) {
      console.log(`Updated ${backendPath}/src/main.ts`);
      logger.step(`${backendPath}/src/main.ts updated (dotenv/cors/port).`);
    } else if (mainPatchResult.skipped) {
      console.log(`Skipped ${backendPath}/src/main.ts (file not found).`);
      logger.step(`${backendPath}/src/main.ts skipped (file missing).`);
    } else {
      console.log(`${backendPath}/src/main.ts already configured.`);
      logger.step(`${backendPath}/src/main.ts was already configured.`);
    }

    const changedEnvFiles = await writeEnvFiles({
      rootDir,
      frontendPath,
      backendPath,
      frontendPort,
      backendPort,
      frontendApiUrlEnvVar,
      backendPortEnvVar,
    });
    if (changedEnvFiles.length > 0) {
      console.log(`Updated env files: ${changedEnvFiles.join(', ')}`);
      logger.step(`Environment files updated: ${changedEnvFiles.join(', ')}.`);
    } else {
      console.log('Env files already configured.');
      logger.step('Environment files were already configured.');
    }

    console.log('TurboRepo initialization completed (idempotent mode).');
    logger.step('TurboRepo initialization finished in idempotent mode.');

    // only what the bootstrap owns: docs/ belongs to the project (a re-run must not rewrite its markdown)
    console.log('Formatting generated files with Prettier...');
    await runCommand('npx', ['prettier', '--write', '--log-level', 'warn', '**/*.{ts,tsx,md}', '!docs/**'], rootDir);
    logger.step('Generated files formatted with Prettier (docs/ left out).');

    await logger.success();
  } catch (error) {
    await logger.failure(error);
    throw error;
  } finally {
    activeRunLogger = null;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
