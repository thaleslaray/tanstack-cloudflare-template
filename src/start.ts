// Configuração global do TanStack Start. Hoje só liga o registro de erros:
// toda server function (inclusive as chamadas durante a renderização no
// servidor, pelo `loader`) que lançar um erro deixa uma linha em `console.error`
// antes de o erro seguir o caminho normal. Veja src/lib/log-erro.ts.
import { createMiddleware, createStart } from '@tanstack/react-start'

import { registrarErro } from '#/lib/log-erro'

const registrarErroDaFuncao = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (erro) {
      registrarErro('server function', erro)
      throw erro
    }
  },
)

export const startInstance = createStart(() => ({
  functionMiddleware: [registrarErroDaFuncao],
}))
