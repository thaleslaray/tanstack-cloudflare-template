// Configuração da marca do app. Estes valores são PLACEHOLDERS: troque pelos do seu projeto.
//
// Atenção: `url` serve para links em e-mails e SEO (sitemap, canonical, og:url). A URL
// pública usada pelo Better Auth é deduzida da requisição (ou de BETTER_AUTH_URL, opcional).
// TROQUE `url` ANTES DO BUILD DE PRODUÇÃO: com localhost, o sitemap e o canonical saem
// errados (`npm run sitemap` avisa).
export const appConfig = {
  name: 'Meu App',
  description: 'Template full-stack na Cloudflare',
  url: 'http://localhost:3000',
  supportEmail: 'suporte@exemplo.com.br',
} as const
