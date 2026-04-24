import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { globSync } from "glob";
import { parseBridgeFile, parseModuleName, type ParsedMethod } from "../parser/bridgeParser";

export type ScanCommandOptions = {
  debug?: boolean;
  includeNodeModules?: boolean;
  outDir?: string;
};

type LogLevel = "info" | "success" | "warning" | "error" | "debug";

export function scanCommand(projectPath: string, options: ScanCommandOptions = {}): number {
  const debug = options.debug ?? false;
  const resolvedProjectPath = path.resolve(projectPath);
  const outDir = path.resolve(options.outDir ?? path.join(process.cwd(), "generated/specs"));

  try {
    log("info", `Scanning project ${resolvedProjectPath}`);

    if (!fs.existsSync(resolvedProjectPath) || !fs.statSync(resolvedProjectPath).isDirectory()) {
      log("error", `Invalid path provided: ${resolvedProjectPath}`);
      return 1;
    }

    const ignore = ["**/build/**", "**/.gradle/**", "**/generated/**"];
    if (!options.includeNodeModules) {
      ignore.unshift("**/node_modules/**");
    }

    const sourceFiles = globSync("**/*.{java,kt}", {
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

    fs.ensureDirSync(outDir);
    ensureCodegenConfig(resolvedProjectPath, outDir, debug);

    let generatedCount = 0;
    let skippedCount = 0;
    const outputFileNameCounts = new Map<string, number>();

    for (const filePath of sourceFiles) {
      const relativeSourcePath = path.relative(resolvedProjectPath, filePath);
      const methods = parseBridgeFile(filePath);

      if (methods.length === 0) {
        skippedCount++;
        if (debug) {
          log("debug", `Skipped ${relativeSourcePath} (no @ReactMethod methods found)`);
        }
        continue;
      }

      const moduleName = parseModuleName(filePath) ?? path.basename(filePath, path.extname(filePath));
      const specContent = generateSpec(moduleName, methods);
      const baseFileName = `Native${moduleName}`;
      const nextCount = (outputFileNameCounts.get(baseFileName) ?? 0) + 1;
      outputFileNameCounts.set(baseFileName, nextCount);

      const outputFileName = nextCount === 1 ? `${baseFileName}.ts` : `${baseFileName}${nextCount}.ts`;
      const outFile = path.join(outDir, outputFileName);

      fs.writeFileSync(outFile, specContent);
      generatedCount++;

      log("success", `Generated ${outputFileName}`);
      if (debug) {
        log("debug", `${relativeSourcePath} -> ${methods.length} method(s) -> ${path.relative(process.cwd(), outFile)}`);
      }
    }

    if (generatedCount === 0) {
      log("warning", "No React Native bridge methods found (@ReactMethod).");
      return 0;
    }

    if (skippedCount > 0) {
      log("warning", `Skipped ${skippedCount} file(s) without @ReactMethod`);
    }

    log("success", `Done! Generated ${generatedCount} module(s) in ${path.relative(process.cwd(), outDir) || outDir}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", message);

    if (debug && error instanceof Error && error.stack) {
      log("debug", error.stack);
    }

    return 1;
  }
}

function log(level: LogLevel, message: string): void {
  const prefixMap: Record<LogLevel, string> = {
    info: "[scan]",
    success: "[ok]",
    warning: "[warn]",
    error: "[error]",
    debug: "[debug]"
  };

  const colorize: Record<LogLevel, (text: string) => string> = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    debug: chalk.gray
  };

  const output = `${prefixMap[level]} ${message}`;
  const stream = level === "error" ? console.error : console.log;
  stream(colorize[level](output));
}

function ensureCodegenConfig(resolvedProjectPath: string, outDir: string, debug: boolean): void {
  const packageJsonCandidates = [
    path.join(resolvedProjectPath, "package.json"),
    path.join(process.cwd(), "package.json")
  ];

  const packageJsonPath = packageJsonCandidates.find((candidate, index) => {
    if (index === 1 && candidate === packageJsonCandidates[0]) {
      return false;
    }
    return fs.existsSync(candidate);
  });

  if (!packageJsonPath) {
    log("warning", "No package.json found for codegenConfig injection.");
    return;
  }

  const packageJson = fs.readJsonSync(packageJsonPath) as {
    codegenConfig?: {
      name?: string;
      type?: string;
      jsSrcsDir?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  const packageDir = path.dirname(packageJsonPath);
  const defaultJsSrcsDir = path.relative(packageDir, outDir).split(path.sep).join("/") || "generated/specs";
  const original = packageJson.codegenConfig ?? {};
  const merged = {
    ...original,
    name: original.name ?? "AppSpecs",
    type: original.type ?? "modules",
    jsSrcsDir: original.jsSrcsDir ?? defaultJsSrcsDir
  };

  const changed =
    !packageJson.codegenConfig ||
    packageJson.codegenConfig.name !== merged.name ||
    packageJson.codegenConfig.type !== merged.type ||
    packageJson.codegenConfig.jsSrcsDir !== merged.jsSrcsDir;

  if (!changed) {
    if (debug) {
      log("debug", `codegenConfig already present in ${path.relative(process.cwd(), packageJsonPath) || "package.json"}`);
    }
    return;
  }

  packageJson.codegenConfig = merged;
  fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
  log("success", `Updated codegenConfig in ${path.relative(process.cwd(), packageJsonPath) || "package.json"}`);
}

export function generateSpec(moduleName: string, methods: ParsedMethod[]) {
  const interfaceName = `Native${moduleName}Spec`;
  const uniqueBySignature = [
    ...new Map(
      methods.map((m) => {
        const signature = `${m.name}(${m.params
          .map((p) => `${p.name}:${p.type}`)
          .join(",")})|${m.hasPromiseParam ? "promise" : "void"}`;
        return [signature, m] as const;
      })
    ).values()
  ];

  const codegenTypeImports = collectCodegenTypeImports(uniqueBySignature);
  const codegenImportLine =
    codegenTypeImports.length > 0
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

function collectCodegenTypeImports(methods: ParsedMethod[]): string[] {
  const supported = ["Int32", "Double", "Float", "UnsafeObject"];
  const found = new Set<string>();

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
