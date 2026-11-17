// No modo lista, o acesso também vale para sessões que já existem. Ele é
// conferido quando a sessão nasce (`session.create.before`), mas a renovação
// diária estende a sessão sem criar outra: sem esta conferência, quem saiu da
// lista seguiria logado enquanto voltasse ao sistema a cada 7 dias.
//
// O e-mail vem do próprio usuário da sessão (que pode estar no cookie de cache
// de 60 s), então a conferência não custa ida ao D1: a lista é a variável
// `ACCESS_ALLOWLIST`, e tirar alguém dela vale já no próximo pedido. Ao achar
// alguém fora da lista, apaga as sessões dele (nos outros aparelhos, o cache
// do cookie ainda vale por até 60 s, mas esta conferência o barra antes).
// No modo 'open' não faz nada.
import { eq } from 'drizzle-orm'

import { session as sessionTable } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import { hasAccess } from '#/lib/allowlist'

/** Devolve a sessão se o e-mail dela ainda tem acesso; senão `null` e as sessões dele são apagadas. */
export async function enforceAccess<
  T extends { user: { id: string; email: string } } | null,
>(env: Env, current: T): Promise<T | null> {
  if (!current) return current
  if (hasAccess(current.user.email, env.ACCESS_ALLOWLIST)) return current
  try {
    await getDb(env.DB)
      .delete(sessionTable)
      .where(eq(sessionTable.userId, current.user.id))
  } catch (error) {
    // Recusar já protege; a limpeza é reforço.
    console.error(
      '[auth] não consegui apagar as sessões de quem saiu da lista',
      error,
    )
  }
  return null
}
