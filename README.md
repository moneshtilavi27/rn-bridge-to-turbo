# rn-bridge-to-turbo

Convert React Native Bridge modules into **Codegen-ready TurboModule specs** automatically.

---

## 🚀 Why use this?

Migrating from Bridge modules to TurboModules is manual, repetitive, and error-prone.

This CLI helps you:

* ⚡ Automatically generate TurboModule specs
* 🔍 Detect native module methods
* 🧠 Map Java/Kotlin types to Codegen-compatible types
* 🧩 Preserve method signatures and overloads

---

## ⚙️ Usage

```bash
npx rn-bridge-to-turbo scan .
```

More options:

```bash
npx rn-bridge-to-turbo --help
npx rn-bridge-to-turbo scan . --include-node-modules
npx rn-bridge-to-turbo scan . --out-dir ./specs
npx rn-bridge-to-turbo scan . --debug
```

---

## 📦 What it does

* Scans your React Native project for native modules (`.java`, `.kt`)
* Detects methods annotated with `@ReactMethod`
* Converts them into TurboModule TypeScript specs
* Generates files inside:

```text
generated/specs/
  NativeMyModule.ts
  NativeMyKotlinModule.ts
```

---

## 🧾 Example Output

```ts
export interface NativeMyModuleSpec extends TurboModule {
  getData(id: string): Promise<unknown>;
  sendEvent(name: string, value: Int32): void;
}
```

---

## 🛠 Install

```bash
npm install
npm run build
```

Global usage:

```bash
npm install -g .
rn-bridge-to-turbo scan <path>
```

---

## ⚡ React Native Codegen Setup

The CLI automatically ensures `codegenConfig` exists in your `package.json`.

```json
"codegenConfig": {
  "name": "AppSpecs",
  "type": "modules",
  "jsSrcsDir": "generated/specs"
}
```

---

## 🧠 Type Mapping

* `String` → `string`
* `int` → `Int32`
* `double` → `Double`
* `long` → `unknown`
* `Map` → `UnsafeObject`
* `List<T>` → `ReadonlyArray<T>`

Promise handling:

* Inferred when possible
* Falls back to `Promise<unknown>`

---

## 📌 Notes

* Java parsing uses AST (with fallback for edge cases)
* Kotlin parsing is currently regex-based
* Some complex signatures may need manual refinement

---

## ✅ Example CLI Output

```text
[scan] Scanning project /path/to/app
[scan] Found 12 source file(s)
[scan] Writing specs to /generated/specs
[ok] Generated NativeMyModule.ts
[warn] Skipped 3 file(s)
[ok] Done! Generated 5 module(s)
```
