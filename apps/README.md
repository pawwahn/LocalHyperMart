# Flutter buyer app — Phase 1 (TODO)

See `docs/05_API_CONTRACTS.md` for API integration.

## Architecture (loosely coupled, wireframe-resilient)

```text
features/<domain>/
  data/       # API client, repository, DTO → view model mappers
  state/      # BLoC / Riverpod / controllers
  ui/         # screens + presentational widgets only
shared/       # theme tokens, routing, loading/error/empty components
```

- Screens **never** call HTTP directly — use repositories.
- New wireframes should change **ui/** and theme tokens first, not **data/**.
- Full rules: `docs/02_SYSTEM_DESIGN.md` §2.2 and `.cursor/rules/loose-coupling.mdc`.
