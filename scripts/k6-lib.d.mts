export const LINK_INSTALAR: string
export function nomeDoArquivo(
  versao: string,
  sistema: string,
  arquitetura: string,
): { arquivo: string; tipo: 'zip' | 'tar.gz'; pasta: string; programa: string }
export function acharSoma(texto: string, arquivo: string): string
export function sha256(dados: Uint8Array): string
export function conferirSoma(dados: Uint8Array, esperada: string): void
