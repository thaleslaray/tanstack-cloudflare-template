// Para onde ir depois de entrar. O valor vem de uma URL que o visitante controla,
// então só caminhos do próprio site passam (nada de URL absoluta nem `//outro.com`).
export function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/conta'
  return value
}
