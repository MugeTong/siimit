import { chmod, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

type StoredConf = {
    schemaVersion: number;
    workspaceId: string;
    baseUrl: string;
};

const defaultConf: StoredConf = {
    schemaVersion: 1,
    baseUrl: "https://qz.sii.edu.cn",
    workspaceId: "ws-9dcc0e1f-80a4-4af2-bc2f-0e352e7b17e6",
};

interface ConfStorage {
    load(): Promise<StoredConf>;
    save(conf: StoredConf): Promise<void>;
    clear(): Promise<void>;
}

function isFileNotFoundError(error: unknown): boolean {
    return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isInvalidJsonError(error: unknown): boolean {
    return error instanceof SyntaxError;
}

class FileConfStorage implements ConfStorage {
    private cachedStorage?: StoredConf;

    constructor(
        private readonly filePath: string = join(homedir(), ".config", "siimit", "config.json"),
    ) {}

    private handleEnvOverrides(conf: StoredConf): StoredConf {
        const baseUrl = process.env.SIIMIT_BASE_URL;
        const workspaceId = process.env.SIIMIT_WORKSPACE_ID;

        return {
            ...conf,
            workspaceId: workspaceId || conf.workspaceId,
            baseUrl: baseUrl || conf.baseUrl,
        };
    }

    async load(): Promise<StoredConf> {
        if (this.cachedStorage) {
            return this.handleEnvOverrides(this.cachedStorage);
        }

        try {
            const content = await readFile(this.filePath, "utf-8");
            const conf = JSON.parse(content) as StoredConf;
            // Validate the loaded data
            if (!conf.schemaVersion || !conf.workspaceId || !conf.baseUrl) {
                console.warn(
                    "Invalid data in configuration file. \nRepairing with default configuration.",
                );
                await this.save(defaultConf);
                this.cachedStorage = defaultConf;
                return this.handleEnvOverrides(defaultConf);
            }
            this.cachedStorage = conf;
            return this.handleEnvOverrides(conf);
        } catch (error) {
            if (isFileNotFoundError(error) || isInvalidJsonError(error)) {
                await this.save(defaultConf);
                this.cachedStorage = defaultConf;
                return this.handleEnvOverrides(defaultConf);
            }
            throw error;
        }
    }

    async save(conf: StoredConf): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(conf, null, 2), "utf-8");
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

        this.cachedStorage = undefined;
    }
}

export const confStorage: ConfStorage = new FileConfStorage();
