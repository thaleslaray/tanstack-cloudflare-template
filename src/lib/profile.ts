// Regras do perfil que o navegador pode mexer pelo `/update-user` do Better
// Auth. Sem bindings: o limite do nome vale na tela (`maxLength`) e no servidor.

export const NAME_MAX_LENGTH = 100

// A foto só nasce em POST /api/avatar (src/routes/api/avatar.ts), que grava
// `/api/avatar/<userId>?v=<timestamp>`. Qualquer outro valor vindo do
// `/update-user` (URL externa, `javascript:`, caminho com `..`) é recusado.
const AVATAR_IMAGE = /^\/api\/avatar\/[A-Za-z0-9_-]{1,64}(\?v=\d+)?$/

export function isOwnAvatarUrl(value: string): boolean {
  return AVATAR_IMAGE.test(value)
}

/**
 * Filtra o que o `/update-user` (e qualquer atualização de usuário) pode
 * gravar: `image` só é aceito se for nulo ou a URL da foto do próprio app (o
 * campo é descartado, não gravado: fica `undefined`); `name` é cortado em `NAME_MAX_LENGTH`.
 */
export function sanitizeProfileUpdate<
  T extends { name?: unknown; image?: unknown },
>(data: T): T {
  const next = { ...data }
  if (typeof next.name === 'string') {
    next.name = next.name.trim().slice(0, NAME_MAX_LENGTH)
  }
  if ('image' in next && next.image != null) {
    if (typeof next.image !== 'string' || !isOwnAvatarUrl(next.image)) {
      // `undefined` (não `delete`): o Better Auth mistura o retorno do hook
      // por cima do original, e uma chave ausente deixaria o valor passar.
      next.image = undefined
    }
  }
  return next
}
