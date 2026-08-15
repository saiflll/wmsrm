const ts = require('C:/Users/Lenovo/Documents/dev/app/wms/rm/rm/backend/node_modules/typescript');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = 'C:/Users/Lenovo/Documents/dev/app/wms/rm';
const SRC_DIR = path.join(PROJECT_ROOT, 'rm', 'backend', 'src').replace(/\\/g, '/');
const SRC_DIR_FS = path.join(PROJECT_ROOT, 'rm', 'backend', 'src');

function toSnakeCase(str) {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}

const FRAMEWORK_SKIP = new Set([
    'onApplicationBootstrap','onModuleInit','onModuleDestroy','onApplicationShutdown',
    'canActivate','handle','intercept','transform','bind','log','execute','resolve',
    'canActivate','isAccessAllowed','validateBody','validateParam','validateQuery',
    'validate','transformValue','transformResponse','catch','use'
]);

function isCamelCase(str) {
    if (FRAMEWORK_SKIP.has(str)) return false;
    return /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/.test(str) && str.length > 2;
}

function getSourceFiles(dir) {
    const files = [];
    function walk(d) {
        let items;
        try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const item of items) {
            const fullPath = path.join(d, item.name);
            if (item.isDirectory()) {
                if (!item.name.startsWith('.') && !['node_modules', 'dist', '.next', 'coverage'].includes(item.name)) {
                    walk(fullPath);
                }
            } else if (item.isFile() && item.name.endsWith('.ts')) {
                files.push(fullPath);
            }
        }
    }
    walk(dir);
    return files;
}

const compilerOptions = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    strict: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    baseUrl: PROJECT_ROOT + '/rm/backend',
    resolveJsonModule: true,
    noImplicitAny: false,
    strictNullChecks: true,
};

const allFiles = getSourceFiles(SRC_DIR);
const program = ts.createProgram(allFiles, compilerOptions);
const checker = program.getTypeChecker();

const renameCandidates = new Map();

for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.replace(/\\/g, '/').startsWith(SRC_DIR)) continue;

    function visit(node) {
        const isDecl =
            (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) ||
            ts.isMethodDeclaration(node) ||
            ts.isMethodSignature(node) ||
            ts.isGetAccessor(node) ||
            ts.isSetAccessor(node) ||
            ts.isFunctionDeclaration(node) ||
            ts.isVariableDeclaration(node) ||
            ts.isParameter(node) ||
            ts.isBindingElement(node);

        if (isDecl && node.name && ts.isIdentifier(node.name)) {
            const text = node.name.text;
            if (isCamelCase(text)) {
                if (!renameCandidates.has(text)) {
                    renameCandidates.set(text, { newName: toSnakeCase(text), decls: new Set() });
                }
                renameCandidates.get(text).decls.add(node);
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
}

console.log(`Collected ${renameCandidates.size} rename candidates`);

const edits = [];

for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.replace(/\\/g, '/').startsWith(SRC_DIR)) continue;

    function visit(node) {
        if (ts.isIdentifier(node)) {
            const text = node.text;
            if (isCamelCase(text) && renameCandidates.has(text)) {
                const symbol = checker.getSymbolAtLocation(node);
                let shouldRename = false;
                if (symbol && symbol.declarations && symbol.declarations.length > 0) {
                    const candidate = renameCandidates.get(text);
                    for (const decl of symbol.declarations) {
                        if (candidate.decls.has(decl)) { shouldRename = true; break; }
                    }
                    if (!shouldRename) {
                        for (const decl of symbol.declarations) {
                            const df = decl.getSourceFile();
                            if (df && df.fileName.startsWith(SRC_DIR) &&
                                decl.name && ts.isIdentifier(decl.name) && decl.name.text === text) {
                                shouldRename = true; break;
                            }
                        }
                    }
                }
                if (shouldRename) {
                    edits.push({
                        fileName: sourceFile.fileName,
                        start: node.getStart(sourceFile),
                        end: node.getEnd(),
                        oldText: text,
                        newText: renameCandidates.get(text).newName,
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
}

console.log(`Found ${edits.length} reference occurrences to rename`);

const editsByFile = new Map();
for (const e of edits) {
    if (!editsByFile.has(e.fileName)) editsByFile.set(e.fileName, []);
    editsByFile.get(e.fileName).push(e);
}

let filesModified = 0;
let total = 0;
for (const [fileName, list] of editsByFile) {
    list.sort((a, b) => b.start - a.start);
    let content = fs.readFileSync(fileName, 'utf8');
    let changed = false;
    for (const e of list) {
        const actual = content.substring(e.start, e.end);
        if (actual !== e.oldText) {
            console.warn(`Mismatch at ${path.relative(SRC_DIR, fileName)}: expected "${e.oldText}" got "${actual}"`);
            continue;
        }
        content = content.substring(0, e.start) + e.newText + content.substring(e.end);
        changed = true;
    }
    if (changed) {
        fs.writeFileSync(fileName, content, 'utf8');
        filesModified++;
        total += list.length;
        console.log(`✓ ${path.relative(SRC_DIR_FS, fileName)} (${list.length} edits)`);
    }
}
console.log(`\nModified ${filesModified} files, ${total} total edits`);

const mapObj = {};
for (const [oldName, { newName }] of renameCandidates) mapObj[oldName] = newName;
const mapPath = path.join(SRC_DIR_FS, '../rename-mapping.json');
fs.writeFileSync(mapPath, JSON.stringify(mapObj, null, 2), 'utf8');
console.log('Saved mapping to rm/backend/rename-mapping.json');