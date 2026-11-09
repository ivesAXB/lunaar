/**
 * Logo oficial da LUNAAR (public/brand).
 * • full: com o slogan "Luta e União de Amigos para Animais em Risco"
 * • compact: sem o slogan, para tamanhos pequenos (barra lateral, topo)
 * onDark usa a versão com traço claro, feita para fundos escuros.
 */
export function Logo({ variant = 'compact', onDark = false, height }: { variant?: 'full' | 'compact'; onDark?: boolean; height: number }) {
  const file = `lunaar-logo${variant === 'compact' ? '-compact' : ''}${onDark ? '-dark' : ''}.png`;
  // Proporções das imagens exportadas (largura / altura)
  const ratio = variant === 'compact' ? 599 / 388 : 900 / 645;
  return (
    <img
      className="logo-img"
      src={`/brand/${file}`}
      alt={variant === 'full' ? 'LUNAAR: Luta e União de Amigos para Animais em Risco' : 'LUNAAR'}
      height={height}
      width={Math.round(height * ratio)}
      decoding="async"
    />
  );
}
