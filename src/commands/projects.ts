import { Command, Ref } from "@/utils";
import { projectsApi } from "@/api";
import { prettyPrint } from "@/utils";

const jsonFlag = new Ref(false);

async function projectsHandler(self: Command): Promise<void> {
    // Fetch the project list from the API
    const data = await projectsApi.listProjects();

    // Handle the results for better display
    const results = data.map((project) => ({
        ...project,
    }));

    prettyPrint(results, jsonFlag.value, ["id", "name", "priority", "remain", "myRemain"]);
}

const projectsCommand = new Command({
    name: "projects",
    short: "list projects participated in",
    long: "List projects, available priorities, and point balances.",
    aliases: [],
    run: projectsHandler,
});

projectsCommand.setFlag(jsonFlag, "json", "j", "output in JSON format");

export { projectsCommand };
