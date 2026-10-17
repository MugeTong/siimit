import type { Command } from "./types";
import { authStorage } from "@/storage";

async function logoutHandler(): Promise<void> {
    await authStorage.clear();
    console.log("Logged out successfully.");
}

export const logoutCommand: Command = {
    name: "logout",
    hidden: false,
    short: "log out of the service",
    description: "Log out and clear authentication data.",
    aliases: ["signout"],
    positionalNames: [],
    valueOptions: {},
    flagOptions: {},
    run: logoutHandler,
}
