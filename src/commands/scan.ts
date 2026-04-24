import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { globSync } from "glob";
import { parseBridgeFile, parseModuleName, type ParsedMethod } from "../parser/bridgeParser";

export type ScanCommandOptions = {
  includeNodeModules?: boolean;
};

export function scanCommand(projectPath: string, options: ScanCommandOptions = {}) {
  const resolvedProjectPath = path.resolve(projectPath);
  console.log(chalk.blue(`Scanning project: ${resolvedProjectPath}`));

  if (!fs.existsSync(resolvedProjectPath)) {
    console.log(chalk.red(`Path does not exist: ${resolvedProjectPath}`));
    return;
  }

  if (!fs.statSync(resolvedProjectPath).isDirectory()) {
    console.log(chalk.red(`Path is not a directory: ${resolvedProjectPath}`));
    return;
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
    console.log(chalk.yellow("No Java or Kotlin files found in the provided project path."));
    return;
  }

  const outDir = path.join(process.cwd(), "generated/specs");
  fs.ensureDirSync(outDir);
  ensureCodegenConfig(resolvedProjectPath, outDir);

  let generatedCount = 0;
  let skippedCount = 0;
  const outputFileNameCounts = new Map<string, number>();

  for (const filePath of sourceFiles) {
    const methods = parseBridgeFile(filePath);

    if (methods.length === 0) {
      skippedCount++;
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

    const relativeSourcePath = path.relative(resolvedProjectPath, filePath);
    console.log(chalk.green(`Generated ${outputFileName} from ${relativeSourcePath}`));
  }

  if (generatedCount === 0) {
    console.log(chalk.yellow("No React Native bridge methods found (@ReactMethod)."));
    return;
  }

  console.log(
    chalk.green(
      `Scan complete. Generated ${generatedCount} spec file(s), skipped ${skippedCount} file(s) without @ReactMethod.`
    )
  );
}

function ensureCodegenConfig(resolvedProjectPath: string, outDir: string): void {
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
    console.log(chalk.yellow("No package.json found for codegenConfig injection."));
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
    console.log(chalk.gray(`codegenConfig already present in ${path.relative(process.cwd(), packageJsonPath) || "package.json"}`));
    return;
  }

  packageJson.codegenConfig = merged;
  fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
  console.log(chalk.green(`Updated codegenConfig in ${path.relative(process.cwd(), packageJsonPath) || "package.json"}`));
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
