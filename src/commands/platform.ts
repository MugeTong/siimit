import Command from "./command";

class GroupsCommand extends Command {
  name = "groups";
  short = "Show information about groups";
  description = "Display information about groups available to the user, including group names and IDs.";

  async run(): Promise<void> {}
}

class ImagesCommand extends Command {
  name = "images";
  short = "Show information about images";
  description = "Display information about images available to the user, including image names and IDs.";
    async run(): Promise<void> {}
}

class ProjectsCommand extends Command {
  name = "projects";
  short = "Show information about projects";
  description = "Display information about projects available to the user, including project names and IDs.";
    async run(): Promise<void> {}
}


export { GroupsCommand, ImagesCommand, ProjectsCommand };
