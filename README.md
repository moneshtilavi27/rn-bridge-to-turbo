# rn-bridge-to-turbo

Convert React Native Bridge modules to Codegen-ready TurboModule specs.

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
```

For local CLI usage:

```bash
npx tsc
node dist/cli.js scan <your-react-native-project-path>
```

## Usage
Basic scan:

```bash
node dist/cli.js scan <your-react-native-project-path>
```

Include node_modules in scan:

```bash
node dist/cli.js scan <your-react-native-project-path> --include-node-modules
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
npx tsc --noEmit
npx tsc
node dist/cli.js scan <your-react-native-project-path>
```

## Notes
- Parser is regex-based and designed for common real-world bridge patterns
- If a signature is unusual, generated output may need small manual adjustments
