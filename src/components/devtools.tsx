import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import TanStackQueryDevtools from '#/integrations/tanstack-query/devtools'

// Carregado por __root.tsx só em desenvolvimento.
export default function Devtools() {
  return (
    <TanStackDevtools
      config={{ position: 'bottom-right', hideUntilHover: true }}
      plugins={[
        { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
        TanStackQueryDevtools,
      ]}
    />
  )
}
