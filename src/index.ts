#!/usr/bin/env bun
import { Command, Ref } from "@/utils";
import { commands } from "@/commands";

import packageJson from "../package.json" with { type: "json" };

const mainCommand = new Command({
    name: "siimit",
    version: packageJson.version,
    short: "no short description available",
    long: packageJson.description,
    commands: Object.values(commands),
    run: async (self: Command) => {
        self.help();
    },
});

mainCommand.execute().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
});
