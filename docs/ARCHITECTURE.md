# siimit architecture

The CLI is organized around explicit dependency directions:

```text
index.ts
  -> commands
      -> domain services (submission, jobs, projects, groups, images)
          -> platform APIs (train, catalog)
              -> platform client (client, auth, http)
      -> local infrastructure (config)
```

## Module boundaries

- `src/index.ts`: command routing only.
- `src/commands/`: command metadata, dispatch helpers, argument parsing, and orchestration.
- `src/shared/`: data-shape helpers with no platform or CLI dependencies.
- `src/domain/`: business operations, normalization, and terminal rendering for submissions, jobs, logs, projects, groups, and images.
- `src/platform/train.ts`: training endpoints, v1/v2 response envelopes, and typed platform errors.
- `src/platform/catalog/`: focused platform lookups for workspaces, projects, quotas, and private images.
- `src/platform/client.ts`, `http.ts`, `auth.ts`: Inspire transport and authentication.
- `src/config.ts`: schemas plus credential/session/application configuration persistence.

## Extension rules

1. A new CLI command is a plain `Command` object registered in `src/commands/index.ts`.
2. Endpoint paths and platform response envelopes stay in `src/platform/`; command and domain modules do not call platform endpoints directly.
3. Platform modules unwrap API responses; domain modules normalize them into stable CLI data.
4. Persistent local files are limited to configuration and authentication state.
5. Shared helpers must not import CLI, storage, or platform modules.
