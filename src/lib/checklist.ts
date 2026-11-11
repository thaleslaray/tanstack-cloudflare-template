// "Primeiros passos" do painel: se a pessoa dispensou, mora num cookie simples
// (sem dado pessoal, só `1`) em vez do localStorage. O motivo é o servidor
// poder ler o cookie e já desenhar o painel certo no HTML, sem esperar a
// hidratação. Sem bindings: serve ao servidor e ao navegador.
export const CHECKLIST_COOKIE = 'app-checklist-dispensado'

// Lê o cabeçalho `Cookie` de um pedido (servidor).
export function checklistDismissedFromCookie(header: string | null): boolean {
  if (!header) return false
  return header
    .split(';')
    .some((part) => part.trim() === `${CHECKLIST_COOKIE}=1`)
}

// Grava o cookie pelo navegador (não precisa ser HttpOnly: não protege nada).
// Um ano; `Secure` só fora de localhost, onde o http puro não aceitaria.
export function writeChecklistDismissedCookie() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  // biome-ignore lint/suspicious/noDocumentCookie: cookie fixo e curto; a Cookie Store API ainda não é universal e não queremos função assíncrona aqui
  document.cookie = `${CHECKLIST_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}
