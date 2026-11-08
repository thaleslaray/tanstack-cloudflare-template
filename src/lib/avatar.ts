// Foto de perfil: um objeto no R2 por usuário (`avatars/<userId>`), servido
// por GET /api/avatar/<userId>. `user.image` guarda a URL com versão
// (`?v=<timestamp>`), então trocar a foto muda a URL e o cache longo é seguro.
// Arquivo sem bindings: roda no servidor e no navegador (validação e preview).

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type AvatarType = (typeof AVATAR_TYPES)[number]

// Valor do atributo `accept` do <input type="file">.
export const AVATAR_ACCEPT = AVATAR_TYPES.join(',')

// Ids do Better Auth são alfanuméricos; isto barra `../`, barras e afins.
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/

export function isValidUserId(userId: string): boolean {
  return USER_ID.test(userId)
}

export const avatarKey = (userId: string) => `avatars/${userId}`
export const avatarUrl = (userId: string, version: number) =>
  `/api/avatar/${userId}?v=${version}`

export type AvatarProblem = {
  status: 400 | 413 | 415
  message: string
}

/** Confere tipo declarado e tamanho. Devolve o problema, ou null se está ok. */
export function checkAvatarFile(file: {
  type: string
  size: number
}): AvatarProblem | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return { status: 415, message: 'Use uma imagem PNG, JPEG ou WebP.' }
  }
  if (file.size === 0) return { status: 400, message: 'O arquivo está vazio.' }
  if (file.size > AVATAR_MAX_BYTES) {
    return { status: 413, message: 'A imagem precisa ter no máximo 2 MB.' }
  }
  return null
}

/**
 * Descobre o tipo REAL pelos primeiros bytes (o `type` do upload é o que o
 * navegador declarou, e qualquer um pode mentir). Null = não é PNG/JPEG/WebP.
 */
export function detectImageType(bytes: Uint8Array): AvatarType | null {
  const starts = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b)
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg'
  // "RIFF" .... "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp'
  }
  return null
}
