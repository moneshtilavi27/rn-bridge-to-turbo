"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const scan_1 = require("./commands/scan");
const program = new commander_1.Command();
program
    .name("rn-bridge-to-turbo")
    .description("Migrate React Native Bridge → TurboModules")
    .version("1.0.0");
program
    .command("scan")
    .argument("<path>", "React Native project path")
    .option("--include-node-modules", "Include node_modules while scanning")
    .action((path, options) => {
    (0, scan_1.scanCommand)(path, { includeNodeModules: options.includeNodeModules });
});
program.parse();
