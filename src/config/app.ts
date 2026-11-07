// Configuração da marca do app. Estes valores são PLACEHOLDERS: troque pelos do seu projeto.
//
// Atenção: `url` serve apenas para montar links em e-mails e SEO. A URL pública real
// do app, usada pelo Better Auth, vem de `env.BETTER_AUTH_URL` (wrangler.jsonc).
export const appConfig = {
  name: 'Meu App',
  description: 'Template full-stack na Cloudflare',
  url: 'http://localhost:3000',
  supportEmail: 'suporte@exemplo.com.br',
} as const
