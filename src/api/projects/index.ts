import { authStorage } from "@/storage";
import { discoveryStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import { checkPriority } from "@/types";
import type { Priority } from "@/types";

type ProjectMetadata = {
  id: string;
  name: string;
  priority: Priority[];
  remain: number;
  myRemain: number;
};

type ProjectApiMetadata = {
  id: string;
  name: string;
  priority_name: string;
  remain_budget: string;
  member_remain_budget: string;
};

type ListProjectsResponse = ServiceResponse<{
  items: Array<ProjectApiMetadata>;
  total: number;
}>;

async function listProjects(): Promise<Array<ProjectMetadata>> {
  const token = await authStorage.load();
  const endpoint = await discoveryStorage.load("project");
  const url = new URL(endpoint, "https://qz.sii.edu.cn");
  url.searchParams.set("Action", "GetProjectListV2");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: token,
      "x-inspire-client-source": "inspire-cli/5294f02",
    },
    body: JSON.stringify({
      filter: {
        workspace_id: "ws-9dcc0e1f-80a4-4af2-bc2f-0e352e7b17e6",
      },
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }
  const payload = (await response.json()) as ListProjectsResponse;
  if (!("Result" in payload)) {
    const errorCode = payload.ResponseMetadata.Error.Code;
    const errorMessage = payload.ResponseMetadata.Error.Message;
    throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
  }

  return payload.Result.items.map((project) => ({
    id: project.id,
    name: project.name,
    priority: checkPriority(Number(project.priority_name)),
    remain: Number(project.remain_budget),
    myRemain: Number(project.member_remain_budget),
  }));
}

export const projectsApi = {
  listProjects,
};
