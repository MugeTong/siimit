import { ConfigurationError } from "../../errors";
import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface Workspace {
  id: string;
  name: string;
}

export async function listWorkspaces(client: InspireClient): Promise<Workspace[]> {
  const response = await client.postJson("/api/v2/workspace?Action=ListWorkspaces", {
    PageNumber: 0,
    page_size: 100,
  });
  return records(asRecord(response.Result)?.items).flatMap((item): Workspace[] => {
    const id = String(item.id ?? "");
    return id ? [{ id, name: String(item.name ?? id) }] : [];
  });
}

export async function resolveWorkspace(client: InspireClient, requested: string): Promise<string> {
  if (requested.startsWith("ws-")) return requested;
  const workspace = (await listWorkspaces(client)).find(
    (item) => item.name === requested || item.id === requested,
  );
  if (!workspace) throw new ConfigurationError(`No workspace exactly matches ${JSON.stringify(requested)}.`);
  return workspace.id;
}
