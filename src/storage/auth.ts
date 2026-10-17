
import { dirname, join } from "path";
import { homedir } from "os";
import { readFile, writeFile, unlink, mkdir, chmod } from "fs/promises";
import { authApi } from "@/api";

function isFileNotFoundError(error: unknown): boolean {
    return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

type StoredAuth = {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresAt: number;
    refreshExpiresAt: number;
}

interface AuthStorage {
    load(): Promise<string>;
    save(auth: StoredAuth): Promise<void>;
    clear(): Promise<void>;
}

class FileAuthStorage implements AuthStorage {
    constructor(
        private readonly filePath: string = join(homedir(), ".config", "siimit", "auth.json"),
    ) { }

    async load(): Promise<string> {
        try {
            const content = await readFile(this.filePath, "utf-8");
            const auth = JSON.parse(content) as StoredAuth;
            // Validate the loaded data
            if (!auth.accessToken || !auth.expiresAt || !auth.refreshToken || !auth.refreshExpiresAt || !auth.tokenType) {
                throw new Error("Invalid auth data in storage.");
            }

            // Check if the access token has expired
            if (Date.now() >= auth.expiresAt) {
                // If the fresh token has also expired, clear the storage and return null
                if (Date.now() >= auth.refreshExpiresAt) {
                    await this.clear();
                    throw new Error("Refresh token has expired. Please log in again.");
                }

                const data = await authApi.refreshAuth(auth.refreshToken);
                const newAuth: StoredAuth = {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    tokenType: data.token_type,
                    expiresAt: Date.now() + data.expires_in * 1000 - 5000, // Subtract 5 seconds to account for any potential delays
                    refreshExpiresAt: Date.now() + data.refresh_expires_in * 1000 - 5000, // Subtract 5 seconds
                };
                await this.save(newAuth);
                return `${newAuth.tokenType} ${newAuth.accessToken}`;
            }

            return `${auth.tokenType} ${auth.accessToken}`;
        } catch (error) {
            if (isFileNotFoundError(error)) {
                throw new Error("No auth data found. Please log in.");
            }
            throw error;
        }
    }

    async save(auth: StoredAuth): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });

        await writeFile(this.filePath, JSON.stringify(auth, null, 2), {
        encoding: "utf8",
        mode: 0o600,
        });

        await chmod(this.filePath, 0o600);
    }

    async clear(): Promise<void> {
        try {
            await unlink(this.filePath);
        } catch (error) {
            if (!isFileNotFoundError(error)) {
                throw error;
            }
        }
    }
}

export const authStorage: AuthStorage = new FileAuthStorage();
