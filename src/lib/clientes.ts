// Regras da tela de clientes que valem no servidor e no navegador (sem
// bindings). A validação de verdade roda nas server functions de
// src/lib/clientes-fns.ts; a tela usa as mesmas funções para avisar antes.

export const SITUACOES = ['ativo', 'pendente', 'inativo'] as const
export type Situacao = (typeof SITUACOES)[number]

export const NOME_MAX = 120
export const EMAIL_MAX = 254
/** Teto por pessoa: evita encher o banco por engano (ou de propósito). */
export const CLIENTES_MAX = 500

/** Erro de um campo do formulário: a tela mostra a mensagem junto dele. */
export class CampoInvalido extends Error {
  constructor(
    readonly campo: 'nome' | 'email' | 'situacao',
    message: string,
  ) {
    super(message)
  }
}

export type NovoCliente = { nome: string; email: string; situacao: Situacao }

/** Confere e limpa o que veio do formulário. Lança erro em pt-BR. */
export function validarCliente(data: unknown): NovoCliente {
  const raw = (data ?? {}) as Record<string, unknown>
  const nome = typeof raw.nome === 'string' ? raw.nome.trim() : ''
  const email =
    typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  const situacao = raw.situacao
  if (!nome) throw new CampoInvalido('nome', 'Escreva o nome do cliente.')
  if (nome.length > NOME_MAX) {
    throw new CampoInvalido(
      'nome',
      `O nome pode ter no máximo ${NOME_MAX} caracteres.`,
    )
  }
  if (email.length > EMAIL_MAX || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new CampoInvalido(
      'email',
      'Digite um e-mail válido, como nome@exemplo.com.br.',
    )
  }
  if (!SITUACOES.includes(situacao as Situacao)) {
    throw new CampoInvalido('situacao', 'Escolha a situação do cliente.')
  }
  return { nome, email, situacao: situacao as Situacao }
}
