import { discoveryApi } from "@/api";
import { chmod, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

function isFileNotFoundError(error: unknown): boolean {
    return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

class InvalidDiscoveryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidDiscoveryError";
    }
}

function isInvalidDiscoveryError(error: unknown): boolean {
    return error instanceof InvalidDiscoveryError;
}

// The actions required for the tool.
const SERVICES = [
    "image",
    "train",
    "project",
    "workspace",
    "notebook",
    "hpc",
    "ray",
    "inference-serving",
    "model-hub",
    "user",
    "cluster",
    "resource-price",
] as const;

type Service = (typeof SERVICES)[number];

type StoredDiscovery = {
    schemaVersion: number;
    version: string;
    expiresAt: number;
    endpoints: Partial<Record<Service, string>>;
};

interface DiscoveryStorage {
    load(requiredService: Service): Promise<string>;
    save(discovery: StoredDiscovery): Promise<void>;
    clear(): Promise<void>;
}

class FileDiscoveryStorage implements DiscoveryStorage {
    private cachedStorage?: StoredDiscovery;

    constructor(
        private readonly filePath: string = join(homedir(), ".cache", "siimit", "discovery.json"),
    ) {}

    async requestNewDiscovery(): Promise<StoredDiscovery> {
        const newDiscovery = await discoveryApi.fetchDiscovery();
        const storedDiscovery: StoredDiscovery = {
            schemaVersion: 1,
            version: newDiscovery.Result.Version,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Expires in 24 hours
            endpoints: SERVICES.reduce<Partial<Record<Service, string>>>((acc, service) => {
                const serviceData = newDiscovery.Result.Services.find((s) => s.Name === service);
                if (!serviceData) {
                    throw new Error(`Required service "${service}" not found in discovery data`);
                }
                acc[service] = serviceData.Path;
                return acc;
            }, {}),
        };
        await this.save(storedDiscovery);
        return storedDiscovery;
    }

    async checkEffectiveness(discovery: StoredDiscovery): Promise<StoredDiscovery> {
        if (Date.now() >= discovery.expiresAt) {
            let updatedDiscovery: StoredDiscovery;

            const [needsUpdate, newData] = await discoveryApi.checkDiscovery(discovery.version);
            if (needsUpdate && newData) {
                updatedDiscovery = {
                    schemaVersion: 1,
                    version: newData.Result.Version,
                    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Expires in 24 hours
                    endpoints: SERVICES.reduce<Partial<Record<Service, string>>>((acc, service) => {
                        const serviceData = newData.Result.Services.find((s) => s.Name === service);
                        if (!serviceData) {
                            throw new Error(
                                `Required service "${service}" not found in discovery data`,
                            );
                        }
                        acc[service] = serviceData.Path;
                        return acc;
                    }, {}),
                };
            } else {
                updatedDiscovery = discovery;
                updatedDiscovery.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
            }
            await this.save(updatedDiscovery);
            return updatedDiscovery;
        }
        this.cachedStorage = discovery;
        return discovery;
    }

    async load(requiredService: Service): Promise<string> {
        if (this.cachedStorage) {
            const checkedDiscovery = await this.checkEffectiveness(this.cachedStorage);
            return checkedDiscovery.endpoints[requiredService]!;
        }

        try {
            const content = await readFile(this.filePath, "utf-8");
            const discovery = JSON.parse(content) as StoredDiscovery;
            // Validate the loaded data
            if (
                !discovery.schemaVersion ||
                !discovery.version ||
                !discovery.expiresAt ||
                !discovery.endpoints ||
                !discovery.endpoints[requiredService]
            ) {
                throw new InvalidDiscoveryError("Invalid discovery data in storage");
            }

            const checkedDiscovery = await this.checkEffectiveness(discovery);
            return checkedDiscovery.endpoints[requiredService]!;
        } catch (error) {
            if (isFileNotFoundError(error) || isInvalidDiscoveryError(error)) {
                const discovery = await this.requestNewDiscovery();
                return discovery.endpoints[requiredService]!;
            }
            throw error;
        }
    }

    async save(discovery: StoredDiscovery): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(discovery, null, 2), "utf-8");
        await chmod(this.filePath, 0o600);

        this.cachedStorage = discovery;
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

export const discoveryStorage: DiscoveryStorage = new FileDiscoveryStorage();
