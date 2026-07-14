export class SiimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class AuthenticationError extends SiimitError {}
export class ApiError extends SiimitError {}
export class ConfigurationError extends SiimitError {}

