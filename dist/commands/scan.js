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
    const resolvedProjectPath = path_1.default.resolve(projectPath);
    console.log(chalk_1.default.blue(`Scanning project: ${resolvedProjectPath}`));
    if (!fs_extra_1.default.existsSync(resolvedProjectPath)) {
        console.log(chalk_1.default.red(`Path does not exist: ${resolvedProjectPath}`));
        return;
    }
    if (!fs_extra_1.default.statSync(resolvedProjectPath).isDirectory()) {
        console.log(chalk_1.default.red(`Path is not a directory: ${resolvedProjectPath}`));
        return;
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
        console.log(chalk_1.default.yellow("No Java or Kotlin files found in the provided project path."));
        return;
    }
    const outDir = path_1.default.join(process.cwd(), "generated/specs");
    fs_extra_1.default.ensureDirSync(outDir);
    ensureCodegenConfig(resolvedProjectPath, outDir);
    let generatedCount = 0;
    let skippedCount = 0;
    const outputFileNameCounts = new Map();
    for (const filePath of sourceFiles) {
        const methods = (0, bridgeParser_1.parseBridgeFile)(filePath);
        if (methods.length === 0) {
            skippedCount++;
            continue;
        }
        const moduleName = (0, bridgeParser_1.parseModuleName)(filePath) ?? path_1.default.basename(filePath, path_1.default.extname(filePath));
        const specContent = generateSpec(moduleName, methods);
        const baseFileName = `Native${moduleName}`;
        const nextCount = (outputFileNameCounts.get(baseFileName) ?? 0) + 1;
        outputFileNameCounts.set(baseFileName, nextCount);
        const outputFileName = nextCount === 1 ? `${baseFileName}.ts` : `${baseFileName}${nextCount}.ts`;
        const outFile = path_1.default.join(outDir, outputFileName);
        fs_extra_1.default.writeFileSync(outFile, specContent);
        generatedCount++;
        const relativeSourcePath = path_1.default.relative(resolvedProjectPath, filePath);
        console.log(chalk_1.default.green(`Generated ${outputFileName} from ${relativeSourcePath}`));
    }
    if (generatedCount === 0) {
        console.log(chalk_1.default.yellow("No React Native bridge methods found (@ReactMethod)."));
        return;
    }
    console.log(chalk_1.default.green(`Scan complete. Generated ${generatedCount} spec file(s), skipped ${skippedCount} file(s) without @ReactMethod.`));
}
function ensureCodegenConfig(resolvedProjectPath, outDir) {
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
        console.log(chalk_1.default.yellow("No package.json found for codegenConfig injection."));
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
        console.log(chalk_1.default.gray(`codegenConfig already present in ${path_1.default.relative(process.cwd(), packageJsonPath) || "package.json"}`));
        return;
    }
    packageJson.codegenConfig = merged;
    fs_extra_1.default.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
    console.log(chalk_1.default.green(`Updated codegenConfig in ${path_1.default.relative(process.cwd(), packageJsonPath) || "package.json"}`));
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
