// Substituto de `cloudflare:workers` nos testes (alias em vitest.config.ts).
// O módulo real só existe dentro do workerd; cada teste preenche `env` com os
// bindings de que precisa (ex.: `Object.assign(env, { RESEND_API_KEY: 'x' })`).
export const env: Record<string, unknown> = {}
