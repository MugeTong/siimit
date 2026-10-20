import { homedir } from "os";
import { join } from "path";

type WorkspaceId = string;

interface WorkspaceStorage {
    load(): Promise<WorkspaceId>;
}

class FileWorkspaceStorage implements WorkspaceStorage {
    constructor(
        private readonly filePath: string = join(homedir(), ".config", "siimit", "config.json"),
    ) {}

    async load(): Promise<WorkspaceId> {
        return "ws-9dcc0e1f-80a4-4af2-bc2f-0e352e7b17e6";
    }
}

export const workspaceStorage: WorkspaceStorage = new FileWorkspaceStorage();
