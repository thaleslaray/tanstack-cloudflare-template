// Trilha de auditoria: "quem fez o quê, em quê". Qualquer código de servidor
// chama `audit({...})`; quem quer guardar ou repassar os eventos registra um
// SINK com `onAudit()`. Sem nenhum sink registrado, `audit()` não faz nada
// (no-op): quem chama nunca precisa saber se a auditoria existe.
//
// O sink padrão grava na tabela `audit_log` do D1 (src/lib/audit-d1.ts) e é
// registrado pelo src/server.ts. Para desligar, apague aquele import.
//
// Um evento é um FATO, nunca um segredo: nada de token, senha, código de
// login, cookie, chave de API, nem corpo de requisição inteiro. `meta` serve
// para os poucos campos que deixam a linha útil sozinha (tamanho do arquivo,
// método de login...). `formatAuditEntry` descarta chaves com cara de segredo
// mesmo assim, como rede de segurança.

/** Valor permitido em `meta`: só primitivos (nada de objeto aninhado). */
export type AuditMetaValue = string | number | boolean | null

export type AuditEntry = {
  /** `<area>.<verbo>` em minúsculas, ex.: `auth.sign_in`, `account.avatar_set`. */
  action: string
  /** Quem fez. Os dois nulos = o sistema (cron, webhook). */
  actorId?: string | null
  actorEmail?: string | null
  /** Em que foi feito, ex.: ('user', id). */
  targetType?: string | null
  targetId?: string | null
  meta?: Record<string, AuditMetaValue> | null
  ip?: string | null
  userAgent?: string | null
}

/** A linha já normalizada, pronta para qualquer sink gravar. */
export type AuditRecord = {
  action: string
  actorId: string | null
  actorEmail: string | null
  targetType: string | null
  targetId: string | null
  /** `meta` em JSON (ou null), já sem chaves de segredo. */
  meta: string | null
  ip: string | null
  userAgent: string | null
}

export type AuditSink = (record: AuditRecord) => Promise<void>

/** O que o Worker oferece para trabalho em segundo plano (`ctx.waitUntil`). */
export type BackgroundContext = {
  waitUntil: (promise: Promise<unknown>) => void
}

const ACTION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/
// Chaves que NUNCA entram em `meta`, mesmo que alguém passe por engano.
const SECRET_KEY = /pass|secret|token|otp|code|cookie|authorization|api_?key/i
const MAX_TEXT = 255
const MAX_META_KEYS = 20

// Map por nome: se o módulo do sink rodar de novo (HMR no dev), o registro
// é substituído em vez de duplicado.
const sinks = new Map<string, AuditSink>()

/** Registra (ou substitui) um sink. Devolve a função que o remove. */
export function onAudit(name: string, sink: AuditSink): () => void {
  sinks.set(name, sink)
  return () => {
    sinks.delete(name)
  }
}

/** Quantos sinks estão registrados (usado nos testes). */
export function auditSinkCount(): number {
  return sinks.size
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null
}

/**
 * Normaliza um evento: valida `action`, corta textos longos e limpa `meta`
 * (só primitivos, no máximo 20 chaves, sem chaves com cara de segredo).
 * Lança erro se `action` não seguir o formato `<area>.<verbo>`.
 */
export function formatAuditEntry(entry: AuditEntry): AuditRecord {
  if (!ACTION_PATTERN.test(entry.action)) {
    throw new Error(
      `[audit] action inválida: "${entry.action}". Use <area>.<verbo>, ex.: account.avatar_set`,
    )
  }
  let meta: string | null = null
  if (entry.meta) {
    const clean: Record<string, AuditMetaValue> = {}
    for (const [key, value] of Object.entries(entry.meta)) {
      if (Object.keys(clean).length >= MAX_META_KEYS) break
      if (SECRET_KEY.test(key)) continue
      if (typeof value === 'string') clean[key] = value.slice(0, MAX_TEXT)
      else if (
        value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      ) {
        clean[key] = value
      }
    }
    if (Object.keys(clean).length > 0) meta = JSON.stringify(clean)
  }
  return {
    action: entry.action,
    actorId: text(entry.actorId),
    actorEmail: text(entry.actorEmail)?.toLowerCase() ?? null,
    targetType: text(entry.targetType),
    targetId: text(entry.targetId),
    meta,
    ip: text(entry.ip),
    userAgent: text(entry.userAgent),
  }
}

async function dispatch(record: AuditRecord): Promise<void> {
  for (const [name, sink] of sinks) {
    try {
      await sink(record)
    } catch (error) {
      // Melhor esforço: falha da auditoria nunca derruba a ação auditada.
      console.error(`[audit] sink "${name}" falhou em ${record.action}`, error)
    }
  }
}

/**
 * Registra um evento em todos os sinks. Nunca lança erro.
 *
 * Com `ctx` (algo com `waitUntil`, como o `ctx` do Worker ou o `waitUntil`
 * de `cloudflare:workers`), a gravação segue em segundo plano e a resposta
 * não espera por ela. Sem `ctx`, aguarda a gravação terminar.
 */
export async function audit(
  entry: AuditEntry,
  ctx?: BackgroundContext,
): Promise<void> {
  if (sinks.size === 0) return
  let record: AuditRecord
  try {
    record = formatAuditEntry(entry)
  } catch (error) {
    console.error(error)
    return
  }
  if (ctx) {
    ctx.waitUntil(dispatch(record))
    return
  }
  await dispatch(record)
}

/** IP e navegador da requisição, para espalhar no evento: `...requestMeta(headers)`. */
export function requestMeta(headers: Headers | null | undefined): {
  ip: string | null
  userAgent: string | null
} {
  if (!headers) return { ip: null, userAgent: null }
  return {
    ip:
      headers.get('cf-connecting-ip') ??
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      null,
    userAgent: headers.get('user-agent'),
  }
}
