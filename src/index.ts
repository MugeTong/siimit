#!/usr/bin/env bun
import { commands, executeCommand } from "@/commands";

async function main() {
    const [arg, ...rest] = process.argv.slice(2);

    // Does not allow "help" as a command argument.
    if (arg && arg === "help") {
        console.error(`Unknown command: ${arg}\nUse "siimit --help" to see available commands.`);
        process.exit(1);
    }

    let command = arg ? arg : "help";
    if (arg === "--help" || arg === "-h") {
        command = "help";
    }
    if (arg === "--version" || arg === "-v") {
        command = "version";
    }

    const selectedCommand = commands[command];
    if (!selectedCommand) {
        console.error(
            `Unknown command: ${command}\nUse "siimit --help" to see available commands.`,
        );
        process.exit(1);
    }
    await executeCommand(selectedCommand, rest);
}

main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
});
