"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanCommand = scanCommand;
exports.generateSpec = generateSpec;
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
const bridgeParser_1 = require("../parser/bridgeParser");
function scanCommand(projectPath, options = {}) {
    const debug = options.debug ?? false;
    const resolvedProjectPath = path_1.default.resolve(projectPath);
    const outDir = path_1.default.resolve(options.outDir ?? path_1.default.join(resolvedProjectPath, "generated/specs"));
    try {
        log("info", `Scanning project ${resolvedProjectPath}`);
        if (!fs_extra_1.default.existsSync(resolvedProjectPath) || !fs_extra_1.default.statSync(resolvedProjectPath).isDirectory()) {
            log("error", `Invalid path provided: ${resolvedProjectPath}`);
            return 1;
        }
        const ignore = ["**/build/**", "**/.gradle/**", "**/generated/**"];
        if (!options.includeNodeModules) {
            ignore.unshift("**/node_modules/**");
        }
        const sourceFiles = (0, glob_1.globSync)("**/*.{java,kt}", {
            cwd: resolvedProjectPath,
            absolute: true,
            nodir: true,
            ignore
        }).sort();
        if (sourceFiles.length === 0) {
            log("warning", "No Java or Kotlin files found in the provided project path.");
            return 0;
        }
        log("info", `Found ${sourceFiles.length} source file(s)`);
        log("info", `Writing specs to ${outDir}`);
        log("info", "Parsing modules...");
        fs_extra_1.default.ensureDirSync(outDir);
        ensureCodegenConfig(resolvedProjectPath, outDir, debug);
        let generatedCount = 0;
        let skippedCount = 0;
        const outputFileNameCounts = new Map();
        for (const filePath of sourceFiles) {
            const relativeSourcePath = path_1.default.relative(resolvedProjectPath, filePath);
            const methods = (0, bridgeParser_1.parseBridgeFile)(filePath);
            if (methods.length === 0) {
                skippedCount++;
                if (debug) {
                    log("debug", `Skipped ${relativeSourcePath} (no @ReactMethod methods found)`);
                }
                continue;
            }
            const moduleName = (0, bridgeParser_1.parseModuleName)(filePath) ?? path_1.default.basename(filePath, path_1.default.extname(filePath));
            const specContent = generateSpec(moduleName, methods);
            const subfolder = resolveOutputSubfolder(filePath, resolvedProjectPath);
            const subOutDir = path_1.default.join(outDir, subfolder);
            fs_extra_1.default.ensureDirSync(subOutDir);
            const baseFileName = `Native${moduleName}`;
            const countKey = `${subfolder}::${baseFileName}`;
            const nextCount = (outputFileNameCounts.get(countKey) ?? 0) + 1;
            outputFileNameCounts.set(countKey, nextCount);
            const outputFileName = nextCount === 1 ? `${baseFileName}.ts` : `${baseFileName}${nextCount}.ts`;
            const outFile = path_1.default.join(subOutDir, outputFileName);
            fs_extra_1.default.writeFileSync(outFile, specContent);
            generatedCount++;
            const displayPath = `${subfolder}/${outputFileName}`;
            log("success", `Generated ${displayPath}`);
            if (debug) {
                log("debug", `${relativeSourcePath} -> ${methods.length} method(s) -> ${path_1.default.relative(process.cwd(), outFile)}`);
            }
        }
        if (generatedCount === 0) {
            log("warning", "No React Native bridge methods found (@ReactMethod).");
            return 0;
        }
        if (skippedCount > 0) {
            log("warning", `Skipped ${skippedCount} file(s) without @ReactMethod`);
        }
        log("success", `Done! Generated ${generatedCount} module(s) in ${path_1.default.relative(process.cwd(), outDir) || outDir}`);
        return 0;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("error", message);
        if (debug && error instanceof Error && error.stack) {
            log("debug", error.stack);
        }
        return 1;
    }
}
function resolveOutputSubfolder(filePath, resolvedProjectPath) {
    const rel = path_1.default.relative(resolvedProjectPath, filePath);
    const parts = rel.split(path_1.default.sep);
    const nmIdx = parts.indexOf("node_modules");
    if (nmIdx === -1) {
        return "app";
    }
    const packagePart = parts[nmIdx + 1];
    if (!packagePart) {
        return "app";
    }
    // scoped package: use just the @scope as folder
    if (packagePart.startsWith("@")) {
        return packagePart;
    }
    return packagePart;
}
function log(level, message) {
    const prefixMap = {
        info: "[scan]",
        success: "[ok]",
        warning: "[warn]",
        error: "[error]",
        debug: "[debug]"
    };
    const colorize = {
        info: chalk_1.default.blue,
        success: chalk_1.default.green,
        warning: chalk_1.default.yellow,
        error: chalk_1.default.red,
        debug: chalk_1.default.gray
    };
    const output = `${prefixMap[level]} ${message}`;
    const stream = level === "error" ? console.error : console.log;
    stream(colorize[level](output));
}
function ensureCodegenConfig(resolvedProjectPath, outDir, debug) {
    const packageJsonCandidates = [
        path_1.default.join(resolvedProjectPath, "package.json"),
        path_1.default.join(process.cwd(), "package.json")
    ];
    const packageJsonPath = packageJsonCandidates.find((candidate, index) => {
        if (index === 1 && candidate === packageJsonCandidates[0]) {
            return false;
        }
        return fs_extra_1.default.existsSync(candidate);
    });
    if (!packageJsonPath) {
        log("warning", "No package.json found for codegenConfig injection.");
        return;
    }
    const packageJson = fs_extra_1.default.readJsonSync(packageJsonPath);
    const packageDir = path_1.default.dirname(packageJsonPath);
    const defaultJsSrcsDir = path_1.default.relative(packageDir, outDir).split(path_1.default.sep).join("/") || "generated/specs";
    const original = packageJson.codegenConfig ?? {};
    const merged = {
        ...original,
        name: original.name ?? "AppSpecs",
        type: original.type ?? "modules",
        jsSrcsDir: original.jsSrcsDir ?? defaultJsSrcsDir
    };
    const changed = !packageJson.codegenConfig ||
        packageJson.codegenConfig.name !== merged.name ||
        packageJson.codegenConfig.type !== merged.type ||
        packageJson.codegenConfig.jsSrcsDir !== merged.jsSrcsDir;
    if (!changed) {
        if (debug) {
            log("debug", `codegenConfig already present in ${path_1.default.relative(process.cwd(), packageJsonPath) || "package.json"}`);
        }
        return;
    }
    packageJson.codegenConfig = merged;
    fs_extra_1.default.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
    log("success", `Updated codegenConfig in ${path_1.default.relative(process.cwd(), packageJsonPath) || "package.json"}`);
}
function generateSpec(moduleName, methods) {
    const interfaceName = `Native${moduleName}Spec`;
    const uniqueBySignature = [
        ...new Map(methods.map((m) => {
            const signature = `${m.name}(${m.params
                .map((p) => `${p.name}:${p.type}`)
                .join(",")})|${m.hasPromiseParam ? "promise" : "void"}`;
            return [signature, m];
        })).values()
    ];
    const codegenTypeImports = collectCodegenTypeImports(uniqueBySignature);
    const codegenImportLine = codegenTypeImports.length > 0
        ? `import type { ${codegenTypeImports.join(", ")} } from 'react-native/Libraries/Types/CodegenTypes';\n`
        : "";
    const methodsCode = uniqueBySignature
        .map((method) => {
        const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
        const resolvedType = method.promiseResolvedType ?? "unknown";
        const returnType = method.hasPromiseParam ? `Promise<${resolvedType}>` : "void";
        return `  ${method.name}(${params}): ${returnType};`;
    })
        .join("\n");
    return `
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
${codegenImportLine}

export interface ${interfaceName} extends TurboModule {
${methodsCode}
}

export default TurboModuleRegistry.getEnforcing<${interfaceName}>(
  '${moduleName}'
);
`;
}
function collectCodegenTypeImports(methods) {
    const supported = ["Int32", "Double", "Float", "UnsafeObject"];
    const found = new Set();
    for (const method of methods) {
        const typesToScan = [...method.params.map((param) => param.type)];
        if (method.promiseResolvedType) {
            typesToScan.push(method.promiseResolvedType);
        }
        for (const typeText of typesToScan) {
            for (const typeName of supported) {
                if (new RegExp(`\\b${typeName}\\b`).test(typeText)) {
                    found.add(typeName);
                }
            }
        }
    }
    return [...found].sort();
}
