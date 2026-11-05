import { bindings, defineConfig, exports, triggers } from "cf/config";

import * as entrypoint from "./src/server.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "tanstack-cloudflare-template",
		compatibilityDate: "2026-11-05",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint,
		observability: {
			enabled: true,
		},
		// Cron (UTC): dispara o handler scheduled() todo dia as 03:00
		triggers: [
			triggers.scheduled({
				schedule: "0 3 * * *",
			}),
		],
		// Durable Object com SQLite: substitui `migrations` do Wrangler
		exports: {
			Counter: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			// D1 acessado via Drizzle. O `id` precisa ser um UUID v4 valido: `cf d1 migrations apply`
			// so aceita ID (nao nome/binding) e, no dev, o banco local e chaveado por esse ID.
			// Este e um placeholder local; troque pelo ID real (`cf d1 create`) antes do deploy
			// e atualize os scripts `db:migrate:*` no package.json.
			// `migrations_dir` do Wrangler nao existe aqui: vai em `--dir drizzle` nos scripts.
			DB: bindings.d1({
				name: "tanstack-cloudflare-template-db",
				id: "11111111-1111-4111-8111-111111111111",
			}),
			// Armazenamento de objetos (R2)
			BUCKET: bindings.r2({
				name: "tanstack-cloudflare-template-files",
			}),
			COUNTER: bindings.durableObject({
				worker: "tanstack-cloudflare-template",
				exportName: "Counter",
			}),
			// Segredo: valor local em .dev.vars; em producao via `--secrets-file` no `cf deploy`
			BETTER_AUTH_SECRET: bindings.secret(),
			// Variavel (texto inline). Troque pela URL publica ao publicar.
			BETTER_AUTH_URL: bindings.text("http://localhost:3000"),
			// E-mail (opcional). Sem estes segredos, o e-mail vai para o console do `cf dev`.
			// Chave de API do Resend (https://resend.com/api-keys).
			RESEND_API_KEY: bindings.secret(),
			// Remetente, ex.: "Meu App <contato@seudominio.com.br>". Precisa ser de domínio verificado.
			EMAIL_FROM: bindings.secret(),
			// Cloudflare Email Service (opcional, plano Workers Paid, domínio precisa estar verificado em
			// Compute → Email Service → Email Sending). Descomente, defina EMAIL_FROM com um endereço do
			// domínio verificado e a camada de e-mail (src/lib/email.ts) passa a usar este binding
			// quando RESEND_API_KEY não existir.
			// EMAIL: bindings.sendEmail(),
		},
	},
});
