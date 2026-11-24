import { useState } from 'react';

interface Barra {
  chave: string;
  rotulo: string;
  /** Texto curto para o eixo (o rótulo completo aparece na dica). */
  eixo?: string;
  valor: number;
  detalhe?: string;
}

const ALTURA = 220;
const MARGEM = { topo: 12, base: 28, esquerda: 64, direita: 8 };

/** Escala "redonda" para o eixo: 0, 500, 1.000… */
function passoRedondo(max: number) {
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
}

/**
 * Gráfico de barras de uma série (ex.: faturamento por dia).
 * Barras finas com topo arredondado, grade discreta e dica ao passar o mouse.
 */
export function GraficoBarras({ dados, formatar, titulo }: { dados: Barra[]; formatar: (v: number) => string; titulo: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const largura = 760;
  const max = Math.max(...dados.map((d) => d.valor), 0);
  const passo = passoRedondo(max || 1);
  const topo = Math.max(passo * Math.ceil(max / passo), passo);
  const areaL = largura - MARGEM.esquerda - MARGEM.direita;
  const areaA = ALTURA - MARGEM.topo - MARGEM.base;
  const slot = areaL / Math.max(dados.length, 1);
  const larguraBarra = Math.min(36, Math.max(3, slot - 2)); // 2px de respiro entre barras
  const y = (v: number) => MARGEM.topo + areaA - (v / topo) * areaA;
  const marcas = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const cadaN = Math.ceil(dados.length / 12); // não amontoar rótulos

  const barra = (x: number, v: number) => {
    const h = Math.max(0, (v / topo) * areaA);
    const r = Math.min(4, h, larguraBarra / 2);
    const base = MARGEM.topo + areaA;
    if (h === 0) return '';
    return `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + larguraBarra - r} Q${x + larguraBarra},${base - h} ${x + larguraBarra},${base - h + r} V${base} Z`;
  };

  const a = ativo !== null ? dados[ativo] : null;
  const xAtivo = ativo !== null ? MARGEM.esquerda + ativo * slot + slot / 2 : 0;

  return (
    <figure className="relative">
      <figcaption className="sr-only">{titulo}</figcaption>
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} className="h-auto w-full" role="img" aria-label={titulo} onMouseLeave={() => setAtivo(null)}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(m)} y2={y(m)} className="stroke-stone-200" strokeWidth={m === 0 ? 1 : 0.5} />
            <text x={MARGEM.esquerda - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[11px] tabular-nums">{formatar(m)}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x = MARGEM.esquerda + i * slot + (slot - larguraBarra) / 2;
          return (
            <g key={d.chave}>
              <path d={barra(x, d.valor)} className={ativo === null || ativo === i ? 'fill-marca-600' : 'fill-marca-600/40'} />
              {/* área de toque maior que a barra */}
              <rect x={MARGEM.esquerda + i * slot} y={MARGEM.topo} width={slot} height={areaA} fill="transparent" onMouseEnter={() => setAtivo(i)} />
              {i % cadaN === 0 && (
                <text x={MARGEM.esquerda + i * slot + slot / 2} y={ALTURA - 8} textAnchor="middle" className="fill-stone-500 text-[11px]">
                  {d.eixo ?? d.rotulo}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {a && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md bg-stone-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: `${(xAtivo / largura) * 100}%` }}
        >
          <p className="font-medium">{a.rotulo}</p>
          <p className="tabular-nums">{formatar(a.valor)}</p>
          {a.detalhe && <p className="text-stone-300">{a.detalhe}</p>}
        </div>
      )}
    </figure>
  );
}
