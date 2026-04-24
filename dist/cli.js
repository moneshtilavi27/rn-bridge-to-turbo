"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const scan_1 = require("./commands/scan");
const program = new commander_1.Command();
program
    .name("rn-bridge-to-turbo")
    .description("Convert React Native Bridge modules to TurboModule specs")
    .version("1.0.0");
program.showHelpAfterError();
program
    .command("scan")
    .argument("<path>", "Path to React Native project")
    .description("Scan project and generate TurboModule specs")
    .option("--debug", "Show parsed files, methods, and skipped reasons")
    .option("--include-node-modules", "Allow scanning dependencies inside node_modules")
    .option("--out-dir <path>", "Write generated spec files to a custom output directory")
    .action((projectPath, options) => {
    process.exitCode = (0, scan_1.scanCommand)(projectPath, {
        debug: options.debug,
        includeNodeModules: options.includeNodeModules,
        outDir: options.outDir
    });
});
program.parse();
