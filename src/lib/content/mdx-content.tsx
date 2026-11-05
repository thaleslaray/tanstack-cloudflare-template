import { Suspense, use } from 'react'
import type { MdxModule } from './mdx'

// Tabela larga rola dentro da própria caixa em vez de empurrar a página
// para o lado no celular.
function ProseTable(props: React.ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  )
}

function Body({ load }: { load: () => Promise<MdxModule> }) {
  const { default: Component } = use(load())
  return <Component components={{ table: ProseTable }} />
}

/**
 * Corpo de uma página. `load` é o da própria entrada (ver mdx.ts); o loader da
 * rota normalmente já o chamou, então na renderização a promise está resolvida
 * e o `use()` não suspende. O Suspense cobre só o caso de hidratar antes de o
 * chunk chegar: o React mantém o HTML do servidor até lá.
 */
export function MDXContent({ load }: { load: () => Promise<MdxModule> }) {
  return (
    <div className="prose prose-neutral prose-lg dark:prose-invert max-w-none">
      <Suspense fallback={null}>
        <Body load={load} />
      </Suspense>
    </div>
  )
}
