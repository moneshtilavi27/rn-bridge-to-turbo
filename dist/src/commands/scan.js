"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanCommand = scanCommand;
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = __importDefault(require("fs-extra"));
function scanCommand(path) {
    console.log(chalk_1.default.blue(`Scanning project: ${path}`));
    const exists = fs_extra_1.default.existsSync(path);
    if (!exists) {
        console.log(chalk_1.default.red("Path does not exist"));
        return;
    }
    console.log(chalk_1.default.green("Project found ✔"));
    console.log("Next step: parsing bridge modules...");
}
