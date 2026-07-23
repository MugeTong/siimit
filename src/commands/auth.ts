import Command from "./command";


class LoginCommand extends Command {
    name = "login";
    short = "Authenticate with the platform";
    description = "Log in to the platform using your credentials and establish a session.";

    async run(): Promise<void> {
    }
}

class LogoutCommand extends Command {
    name = "logout";
    short = "Log out of the platform";
    description = "Clear the current session and log out of the platform.";

    async run(): Promise<void> {
    }
}

export { LoginCommand, LogoutCommand };
