import { ConfigurationError } from "../../errors";
import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface Workspace {
  id: string;
  name: string;
}

export async function listWorkspaces(client: InspireClient): Promise<Workspace[]> {
  const response = await client.getJson("/api/v1/user/routes/default");
  const routes = asRecord(response.data)?.routes;
  const workspaces: Workspace[] = [];
  for (const group of records(routes)) {
    if (group.name !== "userWorkspaceList") continue;
    for (const item of records(group.routes)) {
      const id = String(item.path ?? "");
      if (id) workspaces.push({ id, name: String(item.name ?? id) });
    }
  }
  return workspaces;
}

export async function resolveWorkspace(client: InspireClient, requested: string): Promise<string> {
  if (requested.startsWith("ws-")) return requested;
  const workspace = (await listWorkspaces(client)).find(
    (item) => item.name === requested || item.id === requested,
  );
  if (!workspace) throw new ConfigurationError(`No workspace exactly matches ${JSON.stringify(requested)}.`);
  return workspace.id;
}
