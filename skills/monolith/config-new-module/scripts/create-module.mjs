#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveNamespace, resolveSkillPaths } from '../../utils/resolve-skill-config.mjs';
import { createSkillRunLogger } from '../../utils/skill-run-log.mjs';
import { createSkillRunOps } from '../../utils/skill-run-ops.mjs';

let activeRunOps = null;

function usage() {
  console.log(`Usage:
  node create-module.mjs <module-name> [--scope @namespace] [--force] [--backend-only]

Examples:
  node create-module.mjs billing
  node create-module.mjs classification --scope @namespace
  node create-module.mjs payments --force`);
}

function parseArgs(argv) {
  let moduleName = '';
  let scope = '';
  let force = false;
  let backendOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }

    if (arg === '--force') {
      force = true;
      continue;
    }

    // a module without screens: no frontend module, no route, no nav entry, no example controller/e2e
    if (arg === '--backend-only') {
      backendOnly = true;
      continue;
    }

    if (arg === '--scope') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --scope');
      }
      scope = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (moduleName) {
      throw new Error('Only one module name is allowed.');
    }
    moduleName = arg;
  }

  return { moduleName, scope, force, backendOnly };
}

function validateModuleName(name) {
  return /^[a-z][a-z0-9-]*$/.test(name);
}

function toPascalCase(name) {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toImportPath(fromDir, toFilePath) {
  const withoutExtension = toPosixPath(path.relative(fromDir, toFilePath).replace(/\.(tsx?|jsx?)$/, ''));
  return withoutExtension.startsWith('.') ? withoutExtension : `./${withoutExtension}`;
}

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

const MODULE_MAIN_MENU_LABELS = {
  accounts: 'Contas',
  auth: 'Autenticação',
  autenticacao: 'Autenticação',
  categories: 'Categorias',
  'credit-cards': 'Cartões',
  cartoes: 'Cartões',
  example: 'Exemplos',
  examples: 'Exemplos',
  'finance-hub': 'Hub Financeiro',
  recurring: 'Recorrentes',
  statements: 'Extratos',
  transactions: 'Transações',
  transacoes: 'Transações',
};

const MODULE_MENU_WORD_ACCENT_OVERRIDES = {
  aplicacao: 'Aplicação',
  autenticacao: 'Autenticação',
  cartoes: 'Cartões',
  categorias: 'Categorias',
  configuracoes: 'Configurações',
  conexoes: 'Conexões',
  consolidacao: 'Consolidação',
  conciliacao: 'Conciliação',
  creditos: 'Créditos',
  diagnostico: 'Diagnóstico',
  estagio: 'Estágio',
  extratos: 'Extratos',
  historico: 'Histórico',
  informacoes: 'Informações',
  integracoes: 'Integrações',
  modulo: 'Módulo',
  notificacoes: 'Notificações',
  parametros: 'Parâmetros',
  permissoes: 'Permissões',
  relatorios: 'Relatórios',
  revisao: 'Revisão',
  transacoes: 'Transações',
  usuarios: 'Usuários',
  validacao: 'Validação',
  variacoes: 'Variações',
  visao: 'Visão',
};

const MODULE_MAIN_MENU_ICONS = {
  accounts: 'wallet',
  auth: 'shield-check',
  categories: 'tags',
  'credit-cards': 'credit-card',
  example: 'flask-conical',
  examples: 'flask-conical',
  'finance-hub': 'wallet',
  recurring: 'repeat',
  statements: 'file-text',
  transactions: 'arrow-right-left',
};

const MODULE_MAIN_MENU_ICON_RULES = [
  { icon: 'wallet', keywords: ['account', 'wallet', 'bank', 'balance'] },
  { icon: 'tags', keywords: ['categor', 'tag', 'classif'] },
  { icon: 'credit-card', keywords: ['card', 'credit'] },
  { icon: 'repeat', keywords: ['recurr', 'repeat', 'subscription'] },
  { icon: 'file-text', keywords: ['statement', 'invoice', 'report', 'document'] },
  { icon: 'arrow-right-left', keywords: ['transaction', 'transfer', 'movement', 'payment'] },
  { icon: 'shield-check', keywords: ['auth', 'permission', 'access', 'role', 'security'] },
  { icon: 'flask-conical', keywords: ['example', 'demo', 'sample'] },
];

const LUCIDE_ICON_COMPONENT_BY_MAIN_MENU_ICON = {
  'arrow-right-left': 'ArrowRightLeft',
  boxes: 'Boxes',
  'credit-card': 'CreditCard',
  'file-text': 'FileText',
  'flask-conical': 'FlaskConical',
  repeat: 'Repeat',
  'shield-check': 'Fingerprint',
  tags: 'Tags',
  wallet: 'Wallet',
};

function toTitleCaseFromKebab(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => {
      const normalizedPart = part.toLowerCase();
      if (MODULE_MENU_WORD_ACCENT_OVERRIDES[normalizedPart]) {
        return MODULE_MENU_WORD_ACCENT_OVERRIDES[normalizedPart];
      }
      return normalizedPart.charAt(0).toUpperCase() + normalizedPart.slice(1);
    })
    .join(' ');
}

function resolveMainMenuLabel(moduleName) {
  return MODULE_MAIN_MENU_LABELS[moduleName] || toTitleCaseFromKebab(moduleName);
}

function resolveMainMenuIcon(moduleName) {
  if (MODULE_MAIN_MENU_ICONS[moduleName]) {
    return MODULE_MAIN_MENU_ICONS[moduleName];
  }

  const normalizedName = moduleName.toLowerCase();
  for (const rule of MODULE_MAIN_MENU_ICON_RULES) {
    if (rule.keywords.some((keyword) => normalizedName.includes(keyword))) {
      return rule.icon;
    }
  }

  return 'boxes';
}

function resolveMainMenuLucideIcon(moduleName) {
  const menuIcon = resolveMainMenuIcon(moduleName);
  return LUCIDE_ICON_COMPONENT_BY_MAIN_MENU_ICON[menuIcon] || 'Boxes';
}

function parseLucideImportSpecifiers(importSpecifiersRaw) {
  return importSpecifiersRaw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

// Finds the index of the `]` that closes the array opened at `openIndex` (the
// position of the `[`), honouring single/double/template quoted strings so that
// brackets inside values are not counted. Returns -1 when there is no match.
function findMatchingBracket(source, openIndex) {
  if (source[openIndex] !== '[') return -1;
  let depth = 0;
  let quote = '';
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Makes sure `iconComponent` is in the 'lucide-react' import, keeping the
// specifiers sorted. Returns the source, updated when needed.
function ensureLucideIconImport(source, iconComponent) {
  // `[^{}]*` keeps the match from crossing other imports (an import's specifier
  // list holds no braces), so it takes exactly the 'lucide-react' import and not
  // an earlier one by backtracking.
  const lucideImportRegex = /import\s*\{([^{}]*)\}\s*from\s*['"]lucide-react['"];/m;
  const lucideImportMatch = source.match(lucideImportRegex);
  if (!lucideImportMatch) {
    // No import yet: add one right after the first import line.
    const importLine = `import { ${iconComponent} } from 'lucide-react';`;
    const firstImportMatch = source.match(/^import .*$/m);
    if (!firstImportMatch) {
      return `${importLine}\n${source}`;
    }
    const insertAt = firstImportMatch.index + firstImportMatch[0].length;
    return `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
  }

  const specifiers = new Set(parseLucideImportSpecifiers(lucideImportMatch[1]));
  if (specifiers.has(iconComponent)) {
    return source;
  }
  specifiers.add(iconComponent);
  const nextImportLine = `import { ${Array.from(specifiers)
    .sort((a, b) => a.localeCompare(b))
    .join(', ')} } from 'lucide-react';`;
  return source.replace(lucideImportRegex, nextImportLine);
}

// Registers the module in the project's navigation menu. The menu is the
// `NAVIGATION_SECTIONS` constant (type `SidebarMenuSection[]`) declared in the
// (private) group layout. The entry is appended (non-destructively) to the end of
// the first section's `items` array, keeping the items already curated. Structural
// problems are not fatal (only logged), so the module creation is not aborted.
async function ensureFrontendNavigationMenuEntry({ navigationLayoutPath, moduleName, logger }) {
  if (!(await pathExists(navigationLayoutPath))) {
    logger.risk(`Navigation layout not found; menu registration skipped: ${navigationLayoutPath}`);
    return;
  }

  const source = await fs.readFile(navigationLayoutPath, 'utf8');

  const navRegex = /const\s+NAVIGATION_SECTIONS\s*(?::[^=]*)?=\s*\[/m;
  const navMatch = source.match(navRegex);
  if (!navMatch) {
    logger.risk(`NAVIGATION_SECTIONS not found in ${navigationLayoutPath}; menu registration skipped.`);
    return;
  }

  const expectedHref = `/${moduleName}`;
  // The regex ends exactly at the `[` that opens the array (the `[` of the
  // `SidebarMenuSection[]` type sits before the `=`, so indexOf cannot find it).
  // The end of the match points at the right bracket.
  const navOpenBracketIndex = navMatch.index + navMatch[0].length - 1;
  const navCloseBracketIndex = findMatchingBracket(source, navOpenBracketIndex);
  if (navCloseBracketIndex === -1) {
    logger.risk(`NAVIGATION_SECTIONS malformed in ${navigationLayoutPath}; menu registration skipped.`);
    return;
  }

  const navBlock = source.slice(navOpenBracketIndex, navCloseBracketIndex + 1);
  // Idempotent: no duplicate when the module's route is already in the menu.
  if (new RegExp(`href:\\s*['"]${expectedHref.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]`).test(navBlock)) {
    logger.step(`Navigation menu already had the ${moduleName} module in ${navigationLayoutPath}.`);
    return;
  }

  // Finds the first section's `items` array inside the navigation block.
  const itemsKeyIndex = source.indexOf('items', navOpenBracketIndex);
  if (itemsKeyIndex === -1 || itemsKeyIndex > navCloseBracketIndex) {
    logger.risk(`No section with 'items' in NAVIGATION_SECTIONS (${navigationLayoutPath}); menu registration skipped.`);
    return;
  }
  const itemsOpenBracketIndex = source.indexOf('[', itemsKeyIndex);
  const itemsCloseBracketIndex = findMatchingBracket(source, itemsOpenBracketIndex);
  if (itemsOpenBracketIndex === -1 || itemsCloseBracketIndex === -1 || itemsCloseBracketIndex > navCloseBracketIndex) {
    logger.risk(`Malformed 'items' array in NAVIGATION_SECTIONS (${navigationLayoutPath}); menu registration skipped.`);
    return;
  }

  const iconComponent = resolveMainMenuLucideIcon(moduleName);
  const label = resolveMainMenuLabel(moduleName);
  logger.ai(`icon and PT-BR label resolved deterministically for the ${moduleName} module: ${label} (${iconComponent}).`);

  const newItem = `{ id: '${moduleName}', label: '${label}', href: '${expectedHref}', icon: ${iconComponent}, match: 'prefix' }`;
  const inner = source.slice(itemsOpenBracketIndex + 1, itemsCloseBracketIndex);
  const innerTrimmedRight = inner.replace(/\s+$/, '');
  const hasExistingItem = innerTrimmedRight.trim().length > 0;
  const needsComma = hasExistingItem && !innerTrimmedRight.trim().endsWith(',');
  const rebuiltInner = `${innerTrimmedRight}${needsComma ? ',' : ''}\n      ${newItem},\n    `;

  let updated = source.slice(0, itemsOpenBracketIndex + 1) + rebuiltInner + source.slice(itemsCloseBracketIndex);
  updated = ensureLucideIconImport(updated, iconComponent);

  if (updated === source) {
    logger.step(`Navigation menu was already up to date in ${navigationLayoutPath}.`);
    return;
  }

  await writeFile(navigationLayoutPath, updated);
  logger.step(`Navigation menu updated with the ${moduleName} module: ${navigationLayoutPath}`);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureTargetPathAvailability({ targetPath, force, logger, label }) {
  if (!(await pathExists(targetPath))) return;
  if (!force) {
    throw new Error(`Directory already exists: ${targetPath}. Use --force to overwrite.`);
  }
  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.removePath(targetPath, { recursive: true, force: true, markRisk: true });
  logger.step(`Existing ${label} removed with --force: ${targetPath}.`);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeFile(filePath, content) {
  if (!activeRunOps) {
    throw new Error('Run operations are not initialized.');
  }
  await activeRunOps.writeTextFile(filePath, content, {
    ensureNewline: false,
    markRiskOnOverwrite: true,
  });
}

function stringifyJson(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

async function ensurePackageDependency({ packageJsonPath, dependencyName, dependencyVersion, logger, label }) {
  if (!(await pathExists(packageJsonPath))) {
    throw new Error(`Missing package.json file: ${packageJsonPath}`);
  }

  const packageJson = await readJson(packageJsonPath);
  const dependencies =
    packageJson.dependencies && typeof packageJson.dependencies === 'object' ? packageJson.dependencies : {};
  const currentVersion = dependencies[dependencyName];
  if (currentVersion === dependencyVersion) {
    return false;
  }

  dependencies[dependencyName] = dependencyVersion;
  packageJson.dependencies = dependencies;
  await writeFile(packageJsonPath, stringifyJson(packageJson));
  logger.step(`${label} updated with dependency ${dependencyName}@${dependencyVersion}: ${packageJsonPath}`);
  return true;
}

async function ensureBackendModuleImportedInAppModule({ appModulePath, moduleName, moduleClassName, logger }) {
  if (!(await pathExists(appModulePath))) {
    throw new Error(`Missing backend app module file: ${appModulePath}`);
  }

  const importPath = `./modules/${moduleName}/${moduleName}.module.js`;
  const importLine = `import { ${moduleClassName}Module } from '${importPath}';`;
  let content = await fs.readFile(appModulePath, 'utf8');
  let updated = content;

  const hasImport = updated.includes(`from '${importPath}'`) || updated.includes(`from "${importPath}"`);
  if (!hasImport) {
    const importBlockMatch = updated.match(/^(import[^\n]*\n)+/m);
    if (importBlockMatch) {
      updated = `${importBlockMatch[0]}${importLine}\n${updated.slice(importBlockMatch[0].length)}`;
    } else {
      updated = `${importLine}\n${updated}`;
    }
  }

  const importsArrayRegex = /imports:\s*\[([\s\S]*?)\],/m;
  const importsArrayMatch = updated.match(importsArrayRegex);
  if (importsArrayMatch && !new RegExp(`\\b${moduleClassName}Module\\b`).test(importsArrayMatch[1])) {
    const inner = importsArrayMatch[1];
    const replacement = inner.trim().length === 0 ? `${moduleClassName}Module` : `${moduleClassName}Module, ${inner.trim()}`;
    updated = updated.replace(importsArrayRegex, `imports: [${replacement}],`);
  }

  if (updated !== content) {
    if (!activeRunOps) {
      throw new Error('Run operations are not initialized.');
    }
    await activeRunOps.writeTextFile(appModulePath, updated, {
      ensureNewline: false,
      note: `${moduleName}.module import`,
      markRiskOnOverwrite: true,
    });
    logger.step(`updated file: ${appModulePath}`);
  }
}

async function main() {
  // the script lives in the plugin cache, not in the project: the project is wherever it is run from
  const rootDir = process.cwd();
  const logger = await createSkillRunLogger({
    rootDir,
    skillName: 'config-new-module',
    commandArgs: process.argv.slice(2),
  });

  try {
    activeRunOps = createSkillRunOps({
      rootDir,
      logger,
      dryRun: false,
    });
    const { moduleName, scope: scopeArg, force, backendOnly } = parseArgs(process.argv.slice(2));

    if (!moduleName) {
      usage();
      logger.step('Command without a module name. Exited after showing the help.');
      await logger.success();
      process.exit(1);
    }

    if (!validateModuleName(moduleName)) {
      throw new Error(`Invalid module name '${moduleName}'. Use lowercase letters, numbers and hyphens.`);
    }

    logger.step(`Module name validated: ${moduleName}.`);

    const { packagesDir, sharedModule, sharedPackageJsonPath, config } = await resolveSkillPaths(rootDir);
    const modulesDir = path.join(rootDir, 'modules');
    const targetDir = path.join(modulesDir, moduleName);
    const backendAppPath = config.defaults.backendAppPath;
    const frontendAppPath = config.defaults.frontendAppPath;
    const frontendModulesBaseSegments = ['src', 'modules'];
    const frontendAppBaseSegments = ['src', 'app'];
    const frontendSharedBaseSegments = ['src', 'shared'];
    const frontendModulesBaseDir = path.join(rootDir, frontendAppPath, ...frontendModulesBaseSegments);
    const frontendEmptyDashboardStatePath = path.join(
      rootDir,
      frontendAppPath,
      ...frontendSharedBaseSegments,
      'components',
      'ui',
      'empty-dashboard-state.tsx',
    );
    const frontendAppBaseDir = path.join(rootDir, frontendAppPath, ...frontendAppBaseSegments);
    const frontendPrivateGroupDir = path.join(frontendAppBaseDir, '(private)');
    const hasFrontendPrivateGroup = await pathExists(frontendPrivateGroupDir);
    const backendModuleDir = path.join(rootDir, backendAppPath, 'src', 'modules', moduleName);
    const frontendModuleDir = path.join(frontendModulesBaseDir, moduleName);
    const frontendRouteDir = path.join(
      hasFrontendPrivateGroup ? frontendPrivateGroupDir : frontendAppBaseDir,
      moduleName,
    );
    const backendPrismaModelPath = path.join(rootDir, backendAppPath, 'prisma', 'models', `${moduleName}.model.prisma`);
    const backendAppModulePath = path.join(rootDir, backendAppPath, 'src', 'app.module.ts');
    const backendPackageJsonPath = path.join(rootDir, backendAppPath, 'package.json');
    const frontendPackageJsonPath = path.join(rootDir, frontendAppPath, 'package.json');
    // The project's navigation menu lives as `NAVIGATION_SECTIONS` in the (private)
    // group layout (`app/(private)/layout.tsx`), which renders the application's
    // single `AdminShell`. There is no `dashboard/layout.tsx` and no per-module menu.
    const frontendNavigationLayoutPath = path.join(
      hasFrontendPrivateGroup ? frontendPrivateGroupDir : frontendAppBaseDir,
      'layout.tsx',
    );

    let sharedScopeFromPackage = '';
    try {
      const sharedPkg = await readJson(sharedPackageJsonPath);
      const sharedName = sharedPkg?.name;
      if (typeof sharedName === 'string' && sharedName.includes('/')) {
        sharedScopeFromPackage = sharedName.split('/')[0];
      }
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        throw new Error(`Invalid shared package file at ${sharedPackageJsonPath}: ${error.message}`);
      }
    }

    const { scope } = await resolveNamespace({
      rootDir,
      cliScope: scopeArg,
      fallbackScope: sharedScopeFromPackage,
    });
    logger.step(`Namespace resolved: ${scope}.`);

    const packageName = `${scope}/${moduleName}`;
    const sharedDependency = `${scope}/${sharedModule}`;
    const workspaceTsConfigBasePath = path.join(packagesDir, 'config', 'typescript-config', 'base.json');
    const legacyWorkspaceTsConfigBasePath = path.join(packagesDir, 'typescript-config', 'base.json');
    const fallbackTsConfigBasePath = path.join(rootDir, 'packages', 'config', 'typescript-config', 'base.json');
    const legacyFallbackTsConfigBasePath = path.join(rootDir, 'packages', 'typescript-config', 'base.json');
    let tsConfigBasePath = fallbackTsConfigBasePath;
    if (await pathExists(workspaceTsConfigBasePath)) {
      tsConfigBasePath = workspaceTsConfigBasePath;
    } else if (await pathExists(legacyWorkspaceTsConfigBasePath)) {
      tsConfigBasePath = legacyWorkspaceTsConfigBasePath;
    } else if (await pathExists(legacyFallbackTsConfigBasePath)) {
      tsConfigBasePath = legacyFallbackTsConfigBasePath;
    }
    const tsConfigExtendsPath = toPosixPath(path.relative(targetDir, tsConfigBasePath));
    // the extends above is a path, invisible to `turbo prune`: declaring the package keeps it in the Docker build
    const tsConfigPackageJsonPath = path.join(path.dirname(tsConfigBasePath), 'package.json');
    const tsConfigPackageName = (await pathExists(tsConfigPackageJsonPath)) ? (await readJson(tsConfigPackageJsonPath)).name : '';
    // the test runner's range is the project's, read from a module that already exists (a major bumped by an
    // upgrade must not come back pinned in the next module); the template's own range only for the first one
    const siblingRange = async (dependency) => {
      const siblings = (await pathExists(modulesDir)) ? await fs.readdir(modulesDir) : [];
      for (const sibling of siblings.sort()) {
        const siblingPkgPath = path.join(modulesDir, sibling, 'package.json');
        if (sibling === moduleName || !(await pathExists(siblingPkgPath))) continue;
        const range = (await readJson(siblingPkgPath)).devDependencies?.[dependency];
        if (range) return range;
      }
      return undefined;
    };
    const vitestRange = (await siblingRange('vitest')) ?? '^4.1.2';
    const coverageRange = (await siblingRange('@vitest/coverage-v8')) ?? vitestRange;
    const moduleClassName = toPascalCase(moduleName);
    const backendControllerClassName = `${moduleClassName}Controller`;
    const backendPrismaClassName = `${moduleClassName}Prisma`;
    const backendModuleClassName = `${moduleClassName}Module`;
    const frontendDashboardComponentName = `${moduleClassName}DashboardComponent`;
    const frontendDashboardComponentFileName = `${moduleName}-dashboard.component.tsx`;
    const frontendDashboardPageName = 'DashboardPage';
    const frontendDashboardPageFileName = 'dashboard.page.tsx';
    const frontendDashboardModuleName = resolveMainMenuLabel(moduleName);
    const hasFrontendEmptyDashboardState = await pathExists(frontendEmptyDashboardStatePath);

    await ensureTargetPathAvailability({
      targetPath: targetDir,
      force,
      logger,
      label: 'package directory',
    });
    await ensureTargetPathAvailability({
      targetPath: backendModuleDir,
      force,
      logger,
      label: 'backend module directory',
    });
    await ensureTargetPathAvailability({
      targetPath: frontendModuleDir,
      force,
      logger,
      label: 'frontend module directory',
    });
    await ensureTargetPathAvailability({
      targetPath: frontendRouteDir,
      force,
      logger,
      label: 'frontend route directory',
    });

    const packageJson = {
      name: packageName,
      version: '0.1.0',
      type: 'module',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
        },
      },
      scripts: {
        dev: 'tsc --watch',
        build: 'tsc',
        test: 'vitest run',
        'test:watch': 'vitest',
        'test:cov': 'vitest run --coverage',
      },
      dependencies: {
        [sharedDependency]: '*',
      },
      devDependencies: {
        '@vitest/coverage-v8': coverageRange,
        vitest: vitestRange,
        ...(tsConfigPackageName ? { [tsConfigPackageName]: '*' } : {}),
      },
    };

    const tsconfigJson = {
      extends: tsConfigExtendsPath,
      compilerOptions: {
        rootDir: 'src',
        outDir: './dist',
        declaration: true,
        types: ['node', 'vitest/globals'],
      },
      include: ['src'],
      exclude: ['dist', 'build', 'node_modules'],
    };

    const vitestConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    coverage: { include: ['src/**/*.ts'] },
  },
});
`;

    const indexTs = `export function getModuleName(): string {
  return "${moduleName}";
}
`;

    const indexTest = `import { getModuleName } from '../src/index.js';

describe("getModuleName", () => {
  it("returns module name", () => {
    expect(getModuleName()).toBe("${moduleName}");
  });
});
`;
    const backendControllerTs = `import { Controller, Get } from '@nestjs/common';

@Controller('${moduleName}')
export class ${backendControllerClassName} {
  @Get()
  getExample() {
    return {
      module: '${moduleName}',
      message: '${moduleName} endpoint is working',
    };
  }
}
`;
    const backendPrismaTs = `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service.js';

@Injectable()
export class ${backendPrismaClassName} {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma.client;
  }
}
`;
    const backendModuleTs = backendOnly
      ? `import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';

@Module({
  imports: [DbModule],
})
export class ${backendModuleClassName} {}
`
      : `import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { ${backendControllerClassName} } from './${moduleName}.controller.js';
import { ${backendPrismaClassName} } from './${moduleName}.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [${backendControllerClassName}],
  providers: [${backendPrismaClassName}],
  exports: [${backendPrismaClassName}],
})
export class ${backendModuleClassName} {}
`;
    const backendPrismaModel = `// Prisma models for module: ${moduleName}
// Add concrete models for this module below.
`;
    if (hasFrontendEmptyDashboardState) {
      logger.step(`Base component for the empty dashboard found: ${frontendEmptyDashboardStatePath}.`);
    } else {
      logger.step(
        `Base component for the empty dashboard not found (${frontendEmptyDashboardStatePath}); using a local fallback to avoid a compile error.`,
      );
    }

    const frontendDashboardComponentTsx = hasFrontendEmptyDashboardState
      ? `import { EmptyDashboardState } from '@/shared/components/ui/empty-dashboard-state';

export function ${frontendDashboardComponentName}() {
  return <EmptyDashboardState moduleName="${frontendDashboardModuleName}" />;
}
`
      : `export function ${frontendDashboardComponentName}() {
  return (
    <section className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">${moduleClassName} Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Estrutura inicial do módulo ${moduleName}.
      </p>
    </section>
  );
}
`;
    const frontendDashboardPageTsx = `import { ${frontendDashboardComponentName} } from "../components/${moduleName}-dashboard.component";

export function ${frontendDashboardPageName}() {
  return <${frontendDashboardComponentName} />;
}
`;
    // The project uses a single shell (`AdminShell`) and a single navigation menu in
    // the (private) group layout. The module's pages inherit that shell, so NO
    // per-module `layout.tsx` is generated. The module's entry is registered in
    // `NAVIGATION_SECTIONS` by ensureFrontendNavigationMenuEntry.
    const frontendModuleIndexPath = path.join(frontendModuleDir, 'index.ts');
    const backendPrismaPath = path.join(backendModuleDir, `${moduleName}.prisma.ts`);
    const backendControllerPath = path.join(backendModuleDir, `${moduleName}.controller.ts`);
    const backendModulePath = path.join(backendModuleDir, `${moduleName}.module.ts`);
    const backendModuleIndexPath = path.join(backendModuleDir, 'index.ts');
    const frontendDashboardComponentPath = path.join(
      frontendModuleDir,
      'components',
      frontendDashboardComponentFileName,
    );
    const frontendDataIndexPath = path.join(frontendModuleDir, 'data', 'index.ts');
    const frontendDashboardPagePath = path.join(frontendModuleDir, 'pages', frontendDashboardPageFileName);
    const frontendAppRoutePagePath = path.join(frontendRouteDir, 'page.tsx');
    const frontendDashboardPageImportPath = toImportPath(frontendRouteDir, frontendDashboardPagePath);
    const frontendAppRoutePageTsx = `import { ${frontendDashboardPageName} } from "${frontendDashboardPageImportPath}";

export default function Page() {
  return <${frontendDashboardPageName} />;
}
`;
    const frontendModuleIndexTs = `export * from "./components/${moduleName}-dashboard.component";
export * from "./data";
export * from "./pages/dashboard.page";
`;
    const backendModuleIndexTs = `export * from './${moduleName}.module.js';
`;
    // the e2e covers the guard, the status mapping and the query budget of the route (architecture rules 10 and 11)
    const backendE2eSpecTs = `import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/db/prisma.service.js';
import { ApiExceptionFilter } from '../src/shared/errors/api-exception.filter.js';
import { expectQueryBudget } from './query-budget.js';

describe('${moduleName} (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auth: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const payload = { sub: '00000000-0000-4000-8000-000000000001', name: 'E2E', email: 'e2e@localhost' };
    auth = \`Bearer \${app.get(JwtService).sign(payload)}\`;
  });

  afterAll(() => app.close());

  it('answers 401 without a token', async () => {
    await request(app.getHttpServer()).get('/${moduleName}').expect(401);
  });

  it('lists within the query budget, whatever the number of rows', async () => {
    // seed N rows of the aggregate here once the list reads the database: the budget does not grow with N
    const res = await expectQueryBudget(prisma.client, 2, () =>
      request(app.getHttpServer()).get('/${moduleName}').set('Authorization', auth).expect(200),
    );
    expect(res.body).toBeDefined();
  });
});
`;
    const backendE2eSpecPath = path.join(rootDir, backendAppPath, 'test', `${moduleName}.e2e-spec.ts`);
    const perfConfigPath = path.join(rootDir, 'perf.config.json');

    await activeRunOps.ensureDir(path.join(targetDir, 'src'), {
      note: 'package base structure',
    });
    await activeRunOps.ensureDir(path.join(targetDir, 'test'), {
      note: 'package base structure',
    });

    await writeFile(path.join(targetDir, 'package.json'), stringifyJson(packageJson));
    logger.step(`created file: ${path.join(targetDir, 'package.json')}`);
    await writeFile(path.join(targetDir, 'tsconfig.json'), stringifyJson(tsconfigJson));
    logger.step(`created file: ${path.join(targetDir, 'tsconfig.json')}`);
    await writeFile(path.join(targetDir, 'vitest.config.ts'), vitestConfig);
    logger.step(`created file: ${path.join(targetDir, 'vitest.config.ts')}`);
    // mutation testing of this module alone (npm run mutation -- <module>): the thresholds inform, they do not break
    await writeFile(
      path.join(targetDir, 'stryker.config.json'),
      stringifyJson({
        testRunner: 'vitest',
        vitest: { configFile: 'vitest.config.ts' },
        mutate: ['src/**/*.ts', '!src/**/index.ts', '!src/**/*.d.ts'],
        incremental: true,
        incrementalFile: 'reports/stryker-incremental.json',
        reporters: ['clear-text', 'progress'],
        thresholds: { high: 80, low: 60, break: null },
        tempDirName: '.stryker-tmp',
      }),
    );
    logger.step(`created file: ${path.join(targetDir, 'stryker.config.json')}`);
    await writeFile(path.join(targetDir, 'src', 'index.ts'), indexTs);
    logger.step(`created file: ${path.join(targetDir, 'src', 'index.ts')}`);
    await writeFile(path.join(targetDir, 'test', 'index.test.ts'), indexTest);
    logger.step(`created file: ${path.join(targetDir, 'test', 'index.test.ts')}`);

    logger.step(`Base structure created at ${targetDir}.`);
    logger.step(`Shared dependency configured: ${sharedDependency}.`);

    if (!backendOnly) {
      await writeFile(backendControllerPath, backendControllerTs);
      logger.step(`created file: ${backendControllerPath}`);
      await writeFile(backendPrismaPath, backendPrismaTs);
      logger.step(`created file: ${backendPrismaPath}`);
    }
    await writeFile(backendModulePath, backendModuleTs);
    logger.step(`created file: ${backendModulePath}`);
    await writeFile(backendModuleIndexPath, backendModuleIndexTs);
    logger.step(`created file: ${backendModuleIndexPath}`);
    await writeFile(backendPrismaModelPath, backendPrismaModel);
    logger.step(`created file: ${backendPrismaModelPath}`);
    if (!backendOnly) {
      await writeFile(backendE2eSpecPath, backendE2eSpecTs);
      logger.step(`created file: ${backendE2eSpecPath}`);
    }
    // the list route enters the latency budget the day it is born; a route outside perf.config.json is a review finding
    if (!backendOnly && (await pathExists(perfConfigPath))) {
      const perfConfig = await readJson(perfConfigPath);
      perfConfig.routes = perfConfig.routes ?? [];
      if (!perfConfig.routes.some((route) => route.path === `/${moduleName}`)) {
        // `modules`: every module whose code the request runs; a composition route lists all of them, or perf --changed skips it
        perfConfig.routes.push({ path: `/${moduleName}`, modules: [moduleName], auth: true, p95Ms: 200 });
        await writeFile(perfConfigPath, stringifyJson(perfConfig));
        logger.step(`route /${moduleName} added to the p95 budget: ${perfConfigPath}`);
      }
    }
    await ensureBackendModuleImportedInAppModule({
      appModulePath: backendAppModulePath,
      moduleName,
      moduleClassName,
      logger,
    });
    logger.step(`Backend structure created at ${backendModuleDir}.`);

    if (backendOnly) {
      logger.step('--backend-only: frontend, route and menu not generated.');
    } else {
    await writeFile(frontendDashboardComponentPath, frontendDashboardComponentTsx);
    logger.step(`created file: ${frontendDashboardComponentPath}`);
    await writeFile(frontendDataIndexPath, `// Frontend-only API clients, schemas, hooks and browser state for ${moduleName}.\nexport {};\n`);
    logger.step(`created file: ${frontendDataIndexPath}`);
    await writeFile(frontendDashboardPagePath, frontendDashboardPageTsx);
    logger.step(`created file: ${frontendDashboardPagePath}`);
    await writeFile(frontendModuleIndexPath, frontendModuleIndexTs);
    logger.step(`created file: ${frontendModuleIndexPath}`);
    await writeFile(frontendAppRoutePagePath, frontendAppRoutePageTsx);
    logger.step(`created file: ${frontendAppRoutePagePath}`);
    await ensureFrontendNavigationMenuEntry({
      navigationLayoutPath: frontendNavigationLayoutPath,
      moduleName,
      logger,
    });
    logger.step(`Frontend structure created at ${frontendModuleDir}.`);
    }

    await ensurePackageDependency({
      packageJsonPath: backendPackageJsonPath,
      dependencyName: packageName,
      dependencyVersion: '*',
      logger,
      label: 'Backend package',
    });
    if (!backendOnly) {
      await ensurePackageDependency({
        packageJsonPath: frontendPackageJsonPath,
        dependencyName: packageName,
        dependencyVersion: '*',
        logger,
        label: 'Frontend package',
      });
    }
    // new workspace + new deps: without this the lockfile is stale and `npm ci` fails
    await activeRunOps.runCommand('npm', ['install', '--no-audit', '--no-fund'], rootDir);

    console.log(`Created domain module at: ${targetDir}`);
    console.log(`Package name: ${packageName}`);
    console.log(`Backend module scaffolded at: ${path.join(backendAppPath, 'src', 'modules', moduleName)}`);
    if (backendOnly) {
      console.log('Backend-only module: no frontend module, route or navigation entry.');
      console.log(`Backend dependency updated with: ${packageName}@*`);
    } else {
      console.log(
        `Frontend module scaffolded at: ${path.join(frontendAppPath, ...frontendModulesBaseSegments, moduleName)}`,
      );
      console.log(
        `Frontend route scaffolded at: ${path.join(frontendAppPath, ...frontendAppBaseSegments, hasFrontendPrivateGroup ? '(private)' : '', moduleName)}`,
      );
      console.log(`Backend/frontend dependencies updated with: ${packageName}@*`);
    }
    await logger.success();
  } catch (error) {
    await logger.failure(error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
