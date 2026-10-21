import { Command } from "@/utils";
import { authApi } from "@/api";
import { authStorage } from "@/storage";

async function loginHandler(self: Command): Promise<void> {
    const data = await authApi.requestDeviceCode();
    console.log("\nPlease visit the following URL and enter the code to authenticate:\n");
    console.log(`    URL: ${data.verification_uri}`);
    console.log(`    Code: ${data.user_code}`);
    console.log(`\nOr visit complete URL: ${data.verification_uri_complete}`);
    console.log("\nWaiting for authentication to complete...");

    // Wait for the user to complete the authentication
    const auth = await authApi.pollForAuth(data.device_code, data.expires_in, data.interval);

    // Save the auth data to storage
    await authStorage.save({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        tokenType: auth.token_type,
        expiresAt: Date.now() + auth.expires_in * 1000 - 5000, // Subtract 5 seconds to account for any potential delays
        refreshExpiresAt: Date.now() + auth.refresh_expires_in * 1000 - 5000, // Subtract 5 seconds
    });

    console.log(`\nLogged in successfully!`);
}

const loginCommand = new Command({
    name: "login",
    short: "log in to use the service",
    long: "Authenticate and log in to the service.",
    aliases: ["signin"],
    run: loginHandler,
});

export { loginCommand };
