import {
  BellIcon,
  ChartColumnIcon,
  ClockIcon,
  CloudIcon,
  CodeIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  MailIcon,
  PaletteIcon,
  RocketIcon,
  ShieldCheckIcon,
  TerminalIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'

/**
 * Os ícones que um bloco da landing pode pedir pelo NOME (`icon: 'mail'`),
 * para o arquivo de dados não precisar importar componente. Todos do
 * `lucide-react`. Precisa de outro? Importe do lucide e acrescente aqui:
 * o nome novo passa a valer em `types.ts` sozinho.
 */
export const landingIcons = {
  bell: BellIcon,
  chart: ChartColumnIcon,
  clock: ClockIcon,
  cloud: CloudIcon,
  code: CodeIcon,
  database: DatabaseIcon,
  file: FileTextIcon,
  folder: FolderIcon,
  globe: GlobeIcon,
  key: KeyRoundIcon,
  grid: LayoutGridIcon,
  mail: MailIcon,
  palette: PaletteIcon,
  rocket: RocketIcon,
  shield: ShieldCheckIcon,
  terminal: TerminalIcon,
  users: UsersIcon,
  zap: ZapIcon,
} as const

export type LandingIcon = keyof typeof landingIcons
