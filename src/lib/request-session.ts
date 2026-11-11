// A sessão do pedido, lida UMA vez. Na renderização no servidor, o guard
// (`_app.tsx`) e o loader da página chamam server functions que precisam da
// sessão; sem isto cada uma repetia a leitura (com o cache do cookie vencido,
// são idas ao D1 em fila). A chave é o próprio `Request`: some junto com ele,
// então nada vaza de um pedido para outro.
//
// SÓ para leituras comuns. Ação sensível (encerrar conta, baixar dados, foto)
// continua chamando `api.getSession` com `disableCookieCache: true`.
import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'

import { getAuth } from '#/lib/auth'

const porPedido = new WeakMap<
  Request,
  ReturnType<ReturnType<typeof getAuth>['api']['getSession']>
>()

export function getRequestSession() {
  const request = getRequest()
  let sessao = porPedido.get(request)
  if (!sessao) {
    sessao = getAuth(env, request).api.getSession({ headers: request.headers })
    porPedido.set(request, sessao)
  }
  return sessao
}
