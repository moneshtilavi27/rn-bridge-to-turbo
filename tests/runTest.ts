import fs from "fs";
import path from "path";
import { parseBridgeFile, parseModuleName } from "../src/parser/bridgeParser";
import { generateSpec } from "../src/commands/scan";

const testCases = [
	{
		label: "Java module",
		inputPath: path.join(__dirname, "fixtures/MyModule.java"),
		expectedPath: path.join(__dirname, "expected/MyModule.expected.ts")
	},
	{
		label: "Kotlin module",
		inputPath: path.join(__dirname, "fixtures/MyKotlinModule.kt"),
		expectedPath: path.join(__dirname, "expected/MyKotlinModule.expected.ts")
	}
];

let hasFailure = false;

for (const testCase of testCases) {
	const expected = normalizeSpec(fs.readFileSync(testCase.expectedPath, "utf-8"));
	const methods = parseBridgeFile(testCase.inputPath);
	const moduleName = parseModuleName(testCase.inputPath) ?? path.basename(testCase.inputPath, path.extname(testCase.inputPath));
	const output = normalizeSpec(generateSpec(moduleName, methods));
	const match = output === expected;

	console.log(`===== ${testCase.label.toUpperCase()} GENERATED =====`);
	console.log(output);

	console.log(`\n===== ${testCase.label.toUpperCase()} EXPECTED =====`);
	console.log(expected);

	console.log(`\n===== ${testCase.label.toUpperCase()} RESULT =====`);
	console.log(match ? "PASS" : "FAIL");
	console.log("");

	if (!match) {
		hasFailure = true;
	}
}

if (hasFailure) {
	process.exitCode = 1;
}

function normalizeSpec(spec: string): string {
	return spec
		.replace(/\r\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
