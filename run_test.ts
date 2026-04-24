import { parseBridgeFile, parseModuleName } from "./src/parser/bridgeParser";
import { generateSpec } from "./src/commands/scan";
import * as path from "path";

const javaFile = path.resolve("tests/fixtures/MyModule.java");
const methods = parseBridgeFile(javaFile);
const moduleName = "MyModule";

const spec = generateSpec(moduleName, methods);
console.log(spec);
