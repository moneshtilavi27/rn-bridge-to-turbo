# rn-bridge-to-turbo

Convert React Native Bridge modules to Codegen-ready TurboModule specs.

## CLI
`rn-bridge-to-turbo` ships as a proper executable command.

Examples:

```bash
npx rn-bridge-to-turbo --help
npx rn-bridge-to-turbo --version
npx rn-bridge-to-turbo scan .
npx rn-bridge-to-turbo scan . --include-node-modules
npx rn-bridge-to-turbo scan . --out-dir ./specs
npx rn-bridge-to-turbo scan . --debug
```

## What This Library Does
- Scans a React Native project for Java and Kotlin native module files
- Finds @ReactMethod methods
- Maps native types to TypeScript/Codegen-friendly types
- Generates spec files under generated/specs

Generated output example:
- NativeMyModule.ts
- NativeMyKotlinModule.ts

## Install
Use in this project:

```bash
npm install
npm run build
```

For local development:

```bash
npm run dev -- scan <your-react-native-project-path>
```

For a global install from the repository root:

```bash
npm install -g .
rn-bridge-to-turbo scan <your-react-native-project-path>
```

## Usage
Basic scan:

```bash
rn-bridge-to-turbo scan <your-react-native-project-path>
```

Include node_modules in scan:

```bash
rn-bridge-to-turbo scan <your-react-native-project-path> --include-node-modules
```

Custom output directory:

```bash
rn-bridge-to-turbo scan <your-react-native-project-path> --out-dir ./specs
```

Verbose debugging:

```bash
rn-bridge-to-turbo scan <your-react-native-project-path> --debug
```

Help and version:

```bash
rn-bridge-to-turbo --help
rn-bridge-to-turbo --version
```

## React Native Codegen Setup
The scanner now auto-injects missing codegenConfig values into package.json when possible.

Default injected shape:

```json
"codegenConfig": {
  "name": "AppSpecs",
  "type": "modules",
  "jsSrcsDir": "generated/specs"
}
```

If codegenConfig already exists, missing keys are filled without removing your custom keys.

## Type Behavior
- Promise methods: Promise<T> inferred from promise.resolve(...) when possible
- Fallback for uncertain Promise payloads: Promise<unknown>
- Non-Promise methods: void

Common mappings:
- String / String (Kotlin) -> string
- int / Int -> Int32
- float / Float -> Float
- double / Double -> Double
- long / Long -> unknown
- Map-like types -> UnsafeObject
- Array/List-like types -> ReadonlyArray<...>

## Output Conventions
- File name: Native<ModuleName>.ts
- Interface name: Native<ModuleName>Spec
- Registry binding: TurboModuleRegistry.getEnforcing<Native<ModuleName>Spec>('ModuleName')
- Overloads are preserved as TypeScript overload signatures

## Supported Inputs
- Java bridge modules (.java)
- Kotlin bridge modules (.kt)

## Build and Verify
```bash
npm run typecheck
npm run build
npm test
rn-bridge-to-turbo scan <your-react-native-project-path>
```

## Notes
- Java parsing is AST-based with a regex fallback for resilience
- Kotlin parsing currently uses regex-based extraction
- If a signature is unusual, generated output may need small manual adjustments

## Example Output
```text
[scan] Scanning project /path/to/app
[scan] Found 12 source file(s)
[scan] Writing specs to /path/to/generated/specs
[scan] Parsing modules...
[ok] Generated NativeMyModule.ts
[warn] Skipped 3 file(s) without @ReactMethod
[ok] Done! Generated 5 module(s) in generated/specs
```
