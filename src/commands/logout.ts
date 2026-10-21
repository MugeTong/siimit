import { Command } from "@/utils";
import { authStorage } from "@/storage";

async function logoutHandler(self: Command): Promise<void> {
    await authStorage.clear();
    console.log("Logged out successfully.");
}

const logoutCommand = new Command({
    name: "logout",
    short: "log out of the service",
    long: "Log out and clear authentication data.",
    aliases: ["signout"],
    run: logoutHandler,
});

export { logoutCommand };
