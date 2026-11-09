// Para onde ir depois de entrar. O valor vem de uma URL que o visitante controla,
// então só caminhos do próprio site passam (nada de URL absoluta, `//outro.com`,
// `/\outro.com` nem caractere de controle: navegadores tratam `\` como `/`
// e ignoram tab e quebra de linha dentro da URL).
const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid'
// biome-ignore lint/suspicious/noControlCharactersInRegex: é justamente o que queremos barrar
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

export function safeRedirect(value: string | undefined): string {
  if (!value?.startsWith('/') || value.includes('\\')) return '/app'
  if (CONTROL_CHARS.test(value)) return '/app'
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN)
    // Se a URL resolveu para outro site, o valor não era um caminho local.
    if (url.origin !== PLACEHOLDER_ORIGIN) return '/app'
    return url.pathname + url.search + url.hash
  } catch {
    return '/app'
  }
}
