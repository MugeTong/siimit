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
    refreshExpiresAt: number | null;
};

interface AuthStorage {
    load(): Promise<string>;
    save(auth: StoredAuth): Promise<void>;
    clear(): Promise<void>;
}

class FileAuthStorage implements AuthStorage {
    private cachedStorage?: StoredAuth;

    constructor(
        private readonly filePath: string = join(homedir(), ".config", "siimit", "auth.json"),
    ) {}

    async checkEffectiveness(auth: StoredAuth): Promise<StoredAuth> {
        // Check if the access token has expired
        if (Date.now() >= auth.expiresAt) {
            // If the fresh token has also expired, clear the storage and return null
            if (auth.refreshExpiresAt !== null && Date.now() >= auth.refreshExpiresAt) {
                await this.clear();
                throw new Error("Refresh token has expired. Please log in again.");
            }

            const data = await authApi.refreshAuth(auth.refreshToken);
            const newAuth: StoredAuth = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                tokenType: data.token_type,
                expiresAt: Date.now() + data.expires_in * 1000 - 5000,
                refreshExpiresAt:
                    data.refresh_expires_in === 0
                        ? null
                        : Date.now() + data.refresh_expires_in * 1000 - 5000,
            };
            await this.save(newAuth);
            return newAuth;
        }
        this.cachedStorage = auth;
        return auth;
    }

    async load(): Promise<string> {
        if (this.cachedStorage) {
            const effectiveAuth = await this.checkEffectiveness(this.cachedStorage);
            return `${effectiveAuth.tokenType} ${effectiveAuth.accessToken}`;
        }

        try {
            const content = await readFile(this.filePath, "utf-8");
            const auth = JSON.parse(content) as StoredAuth;
            // Validate the loaded data
            if (
                !auth.accessToken ||
                !auth.expiresAt ||
                !auth.refreshToken ||
                auth.refreshExpiresAt === undefined ||
                !auth.tokenType
            ) {
                throw new Error("Invalid auth data in storage");
            }

            const checkedAuth = await this.checkEffectiveness(auth);
            return `${checkedAuth.tokenType} ${checkedAuth.accessToken}`;
        } catch (error) {
            if (isFileNotFoundError(error)) {
                throw new Error("No auth data found. Please log in.");
            }
            throw error;
        }
    }

    async save(auth: StoredAuth): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(auth, null, 2), "utf-8");
        await chmod(this.filePath, 0o600);

        this.cachedStorage = auth;
    }

    async clear(): Promise<void> {
        try {
            await unlink(this.filePath);
        } catch (error) {
            if (!isFileNotFoundError(error)) {
                throw error;
            }
        }

        this.cachedStorage = undefined;
    }
}

export const authStorage: AuthStorage = new FileAuthStorage();
