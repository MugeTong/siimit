# siimit architecture

The CLI is organized around explicit dependency directions:

```text
index.ts
  -> cli/commands + cli/runtime
      -> domain services (submission, jobs, projects, groups, images)
          -> platform client (client, auth, http)
      -> local infrastructure (config)
```

## Module boundaries

- `src/index.ts`: command routing only.
- `src/cli/`: argument parsing, help, authenticated execution, and command orchestration.
- `src/shared/`: data-shape helpers with no platform or CLI dependencies.
- `src/domain/`: business operations, normalization, and terminal rendering by user-facing concept.
- `src/platform/client.ts`, `http.ts`, `auth.ts`: Inspire transport and authentication.
- `src/platform/catalog/`: focused platform lookups for workspaces, projects, quotas, and private images.
- `src/config.ts`: schemas plus credential/session/application configuration persistence.

## Extension rules

1. A new CLI command gets a handler in `src/cli/commands/`; `index.ts` only routes to it.
2. HTTP details stay behind `InspireClient` or a domain service; command handlers do not call `fetch`.
3. Platform response normalization happens in domain modules, never in terminal rendering code.
4. Persistent local files are limited to configuration and authentication state.
5. Shared helpers must not import CLI, storage, or platform modules.
