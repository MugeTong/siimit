import { discoveryApi } from "@/api/discovery";
import { chmod, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

function isFileNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

// The actions required for the tool.
const services = [
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
] as const;

type Service = (typeof services)[number];

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
  constructor(
    private readonly filePath: string = join(
      homedir(),
      ".cache",
      "siimit",
      "discovery.json",
    ),
  ) {}

  async load(requiredService: Service): Promise<string> {
    let requireCheck = undefined;
    try {
      const content = await readFile(this.filePath, "utf-8");
      const discovery = JSON.parse(content) as StoredDiscovery;
      // Validate the loaded data
      if (
        !discovery.schemaVersion ||
        !discovery.version ||
        !discovery.endpoints ||
        !discovery.expiresAt
      ) {
        throw new Error("Invalid discovery data in storage.");
      }

      if (Date.now() >= discovery.expiresAt) {
        requireCheck = discovery;
        throw new Error("Discovery data has expired.");
      }

      const endpoint = discovery.endpoints[requiredService];
      if (!endpoint) {
        throw new Error(
          `Required service ${requiredService} not found in discovery data.`,
        );
      }

      return endpoint;
    } catch (error) {
      let data;
      if (requireCheck) {
        const [needsUpdate, newData] = await discoveryApi.checkDiscovery(
          requireCheck.version,
        );
        if (needsUpdate) {
          data = newData!.Result;
        } else {
          requireCheck.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Extend the expiration by 24 hours
          await this.save(requireCheck);

          const endpoint = requireCheck.endpoints[requiredService];
          if (!endpoint) {
            throw new Error(
              `Required service ${requiredService} not found in discovery data.`,
            );
          }
          return endpoint;
        }
      } else {
        data = (await discoveryApi.fetchDiscovery()).Result;
      }

      const newDiscovery: StoredDiscovery = {
        schemaVersion: 1,
        version: data.Version,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Expires in 24 hours
        endpoints: services.reduce<Partial<Record<Service, string>>>(
          (acc, service) => {
            const serviceData = data.Services.find((s) => s.Name === service);
            if (!serviceData) {
              throw new Error(
                `Required service "${service}" not found in discovery data`,
              );
            }
            acc[service] = serviceData.Path;
            return acc;
          },
          {},
        ),
      };
      await this.save(newDiscovery);

      const endpoint = newDiscovery.endpoints[requiredService];
      if (!endpoint) {
        throw new Error(
          `Required service ${requiredService} not found in discovery data.`,
        );
      }

      return endpoint;
    }
  }

  async save(discovery: StoredDiscovery): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    await writeFile(this.filePath, JSON.stringify(discovery, null, 2), {
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

export const discoveryStorage: DiscoveryStorage = new FileDiscoveryStorage();
