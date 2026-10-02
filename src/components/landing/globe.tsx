// Decorative hero graphic: buyer markets around the world connected to Kerala.
const ORIGINS = [
  { x: 118, y: 168, label: "Europe" },
  { x: 196, y: 112, label: "" },
  { x: 150, y: 262, label: "Middle East" },
  { x: 96, y: 330, label: "Africa" },
  { x: 404, y: 150, label: "East Asia" },
  { x: 438, y: 238, label: "" },
  { x: 420, y: 372, label: "Oceania" },
  { x: 236, y: 420, label: "" },
];
const K = { x: 300, y: 300 }; // Kerala
const COLORS = ["#3cb54a", "#2ea3e6", "#dcc72b", "#d62a2a"];

export function Globe() {
  return (
    <svg viewBox="0 0 520 520" className="h-auto w-full" role="img" aria-label="International buyers connected to Kerala">
      <defs>
        <radialGradient id="g-sphere" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#1f3b5c" />
          <stop offset="60%" stopColor="#13253d" />
          <stop offset="100%" stopColor="#0b1626" />
        </radialGradient>
        <radialGradient id="g-glow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#3cb54a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3cb54a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="g-clip"><circle cx="260" cy="260" r="210" /></clipPath>
      </defs>
      <circle cx="260" cy="260" r="258" fill="url(#g-glow)" />
      <circle cx="260" cy="260" r="210" fill="url(#g-sphere)" stroke="rgb(255 255 255 / 0.12)" />
      <g clipPath="url(#g-clip)" fill="none" stroke="rgb(255 255 255 / 0.08)">
        {[-150, -100, -50, 0, 50, 100, 150].map((d) => <ellipse key={`lat${d}`} cx="260" cy={260 + d} rx={Math.sqrt(210 ** 2 - d ** 2)} ry={Math.sqrt(210 ** 2 - d ** 2) * 0.16} />)}
        {[30, 70, 110, 150, 190].map((rx) => <ellipse key={`lon${rx}`} cx="260" cy="260" rx={rx} ry="210" />)}
        <line x1="260" y1="50" x2="260" y2="470" />
      </g>
      {/* dotted land masses (stylised) */}
      <g clipPath="url(#g-clip)" fill="rgb(255 255 255 / 0.16)">
        {Array.from({ length: 34 * 34 }, (_, i) => {
          const x = 62 + (i % 34) * 12;
          const y = 62 + Math.floor(i / 34) * 12;
          // A few smooth blobs read as continents without pretending to be a real map.
          const land = Math.sin(x / 46) * 1.2 + Math.cos(y / 39) + Math.sin((x - y) / 70) * 0.8 > 1.0;
          return land ? <circle key={i} cx={x} cy={y} r="1.9" /> : null;
        })}
      </g>
      {ORIGINS.map((o, i) => {
        const mx = (o.x + K.x) / 2;
        const my = Math.min(o.y, K.y) - 70;
        const c = COLORS[i % COLORS.length];
        return (
          <g key={i}>
            <path d={`M${o.x} ${o.y} Q${mx} ${my} ${K.x} ${K.y}`} fill="none" stroke={c} strokeOpacity="0.25" strokeWidth="2" />
            <path d={`M${o.x} ${o.y} Q${mx} ${my} ${K.x} ${K.y}`} fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"
              className="tx-arc" style={{ animationDelay: `${i * 0.45}s` }} />
            <circle cx={o.x} cy={o.y} r="4.5" fill={c} />
            <circle cx={o.x} cy={o.y} r="9" fill={c} fillOpacity="0.2" />
          </g>
        );
      })}
      <circle cx={K.x} cy={K.y} r="22" fill="#3cb54a" fillOpacity="0.18" className="tx-pulse" />
      <circle cx={K.x} cy={K.y} r="9" fill="#3cb54a" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}
