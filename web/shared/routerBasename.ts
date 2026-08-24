export function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base === '' ? undefined : base;
}
