/**
 * A marca: um círculo cheio na cor da marca, um anel tracejado em volta e
 * uma bolinha menor em órbita. Desenhada em SVG com `currentColor`, então
 * herda a cor do texto onde estiver; a cor da marca vem do token `--brand`.
 */
export function Logo({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle cx="16" cy="16" r="7" fill="var(--brand)" />
      <circle
        cx="16"
        cy="16"
        r="12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3.2"
        opacity="0.55"
      />
      <circle cx="27" cy="10" r="2.6" fill="var(--brand)" />
    </svg>
  )
}
