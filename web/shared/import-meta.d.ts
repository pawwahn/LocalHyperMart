/** Minimal `import.meta.glob` typing for shared modules (no Vite in `web/shared`). */
interface ImportMeta {
  readonly glob: (
    pattern: string,
    options?: { eager?: boolean; import?: string; query?: string },
  ) => Record<string, unknown>;
}
