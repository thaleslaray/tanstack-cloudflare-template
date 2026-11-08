import { createFileRoute, redirect } from '@tanstack/react-router'

// Endereço antigo da página da conta. Redirecionamento PERMANENTE (301) para
// a área logada: links e favoritos antigos continuam funcionando.
export const Route = createFileRoute('/conta')({
  beforeLoad: () => {
    throw redirect({ to: '/app/configuracoes', statusCode: 301 })
  },
})
