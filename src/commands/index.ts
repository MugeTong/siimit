import { deleteCommand } from "./delete";
import { getCommand } from "./get";
import { groupsCommand } from "./groups";
import { imagesCommand } from "./images";
import { listCommand } from "./list";
import { loginCommand } from "./login";
import { logoutCommand } from "./logout";
import { projectsCommand } from "./projects";
import { stopCommand } from "./stop";
import { submitCommand } from "./submit";

export const commands = [
    loginCommand,
    logoutCommand,
    projectsCommand,
    imagesCommand,
    groupsCommand,
    submitCommand,
    listCommand,
    getCommand,
    stopCommand,
    deleteCommand,
];
