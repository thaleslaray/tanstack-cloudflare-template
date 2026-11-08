import { Link } from '@tanstack/react-router'
import { Logo } from '#/components/logo'
import { appConfig } from '#/config/app'

const footerLink =
  'text-sm text-muted-foreground no-underline transition-colors hover:text-foreground'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-10 py-12 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Link
              to="/"
              className="flex items-center gap-2 text-base font-extrabold tracking-tight text-foreground no-underline"
            >
              <Logo className="size-5" />
              {appConfig.name}
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              {appConfig.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-12 gap-y-8 sm:gap-x-20">
            <div className="flex flex-col items-start gap-3">
              <span className="kicker">Produto</span>
              <a href="/docs" className={footerLink}>
                Documentação
              </a>
              <a href="/blog" className={footerLink}>
                Blog
              </a>
              <a href="/demo/drizzle" className={footerLink}>
                Demos
              </a>
            </div>
            <div className="flex flex-col items-start gap-3">
              <span className="kicker">Legal</span>
              <a href="/termos" className={footerLink}>
                Termos de uso
              </a>
              <a href="/privacidade" className={footerLink}>
                Privacidade
              </a>
            </div>
            <div className="flex flex-col items-start gap-3">
              <span className="kicker">Contato</span>
              <a
                href={`mailto:${appConfig.supportEmail}`}
                className={footerLink}
              >
                {appConfig.supportEmail}
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 pb-8 text-sm text-muted-foreground sm:flex-row sm:items-baseline sm:justify-between">
          <span>
            © {year} {appConfig.name}
          </span>
          <span>Feito com TanStack Start na Cloudflare</span>
        </div>
      </div>
    </footer>
  )
}
