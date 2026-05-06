// Composants de graphiques minimalistes en SVG — pas de lib externe.

type Point = { label: string; value: number };

export function LineChart({
  data,
  height = 180,
  stroke = "currentColor",
  fill = "currentColor",
  fillOpacity = 0.12
}: {
  data: Point[];
  height?: number;
  stroke?: string;
  fill?: string;
  fillOpacity?: number;
}) {
  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }

  const width = 600;
  const padX = 8;
  const padY = 12;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = data.length > 1 ? (width - 2 * padX) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - d.value / max) * (height - 2 * padY);
    return { x, y };
  });

  const pathLine = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const pathArea =
    pathLine +
    ` L ${points[points.length - 1].x.toFixed(2)} ${height - padY}` +
    ` L ${points[0].x.toFixed(2)} ${height - padY} Z`;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Graphique"
      >
        <path d={pathArea} fill={fill} opacity={fillOpacity} />
        <path d={pathLine} stroke={stroke} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill={stroke} />
        ))}
      </svg>
    </div>
  );
}

export function BarChartHorizontal({
  data,
  formatValue,
  barColor = "rgb(var(--bar-color, 105 21 36))"
}: {
  data: Point[];
  formatValue?: (v: number) => string;
  barColor?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400">Aucune donnée sur la période.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <li key={d.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-zinc-700">{d.label}</span>
              <span className="text-zinc-500">
                {formatValue ? formatValue(d.value) : d.value}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100">
              <div
                className="h-2 rounded-full"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DonutChart({
  data,
  size = 140
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <EmptyChart height={size} />;
  }
  const radius = size / 2 - 8;
  const inner = radius - 18;
  const cx = size / 2;
  const cy = size / 2;

  let acc = 0;
  const arcs = data.map((d) => {
    const start = acc / total;
    const end = (acc + d.value) / total;
    acc += d.value;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = end * 2 * Math.PI - Math.PI / 2;
    const large = end - start > 0.5 ? 1 : 0;
    const x0 = cx + radius * Math.cos(a0);
    const y0 = cy + radius * Math.sin(a0);
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const xi1 = cx + inner * Math.cos(a1);
    const yi1 = cy + inner * Math.sin(a1);
    const xi0 = cx + inner * Math.cos(a0);
    const yi0 = cy + inner * Math.sin(a0);
    return {
      d: `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`,
      color: d.color,
      label: d.label
    };
  });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color}>
            <title>{a.label}</title>
          </path>
        ))}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-zinc-700">{d.label}</span>
            <span className="ml-auto font-medium text-zinc-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-lg bg-zinc-50 text-xs text-zinc-400"
      style={{ height }}
    >
      Pas encore de données.
    </div>
  );
}
