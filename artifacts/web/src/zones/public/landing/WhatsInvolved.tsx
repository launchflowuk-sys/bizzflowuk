import { useState } from "react";
import { BUILD_STEPS } from "./content";
import { INK, MUTED, TEXT } from "./theme";

/**
 * A drawn cross-section of the wall, with the layer for the selected stage lit up.
 *
 * Drawn rather than photographed on purpose: it has to work on day one, before the client has
 * supplied a single job photo, and it keeps working afterwards because no photograph shows what's
 * under the finish coat. It also answers the question that decides most of these jobs — why one
 * quote is dearer than another — by showing the layers a cheaper quote leaves out.
 */
function WallSection({ active }: { active: number }) {
  const layer = (index: number) => ({
    opacity: active === index ? 1 : 0.34,
    transition: "opacity .25s ease",
  });

  return (
    <svg viewBox="0 0 300 250" className="h-auto w-full" role="img"
         aria-label="Cross-section of a rendered wall showing brickwork, basecoat with mesh, primer and topcoat">
      <defs>
        <pattern id="lp-mesh" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 0L9 9M9 0L0 9" stroke="#94A3B8" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Brickwork — the substrate, always shown solid because it's what's already there. */}
      <g>
        <rect x="10" y="30" width="120" height="190" fill="#E2E5E9" />
        {[0, 1, 2, 3, 4, 5, 6].map(row => (
          <g key={row}>
            <line x1="10" y1={30 + row * 27} x2="130" y2={30 + row * 27} stroke="#C2C8D0" strokeWidth="2" />
            <line x1={row % 2 === 0 ? 50 : 70} y1={30 + row * 27} x2={row % 2 === 0 ? 50 : 70} y2={30 + (row + 1) * 27} stroke="#C2C8D0" strokeWidth="2" />
            <line x1={row % 2 === 0 ? 95 : 110} y1={30 + row * 27} x2={row % 2 === 0 ? 95 : 110} y2={30 + (row + 1) * 27} stroke="#C2C8D0" strokeWidth="2" />
          </g>
        ))}
        <text x="70" y="238" textAnchor="middle" fontSize="11" fontWeight="700" fill={MUTED}>Your wall</text>
      </g>

      {/* 01 Prep — a bead set to the corner. */}
      <g style={layer(0)}>
        <path d="M130 30 L138 30 L138 220 L130 220 Z" fill="#B9C0C9" />
        <path d="M130 26 L142 26 L142 34 L130 34 Z" fill="#8D96A1" />
        <text x="152" y="24" fontSize="10.5" fontWeight="700" fill={INK}>Beads &amp; made good</text>
      </g>

      {/* 02 Basecoat with mesh bedded in. */}
      <g style={layer(1)}>
        <rect x="138" y="30" width="34" height="190" fill="#D4DAE1" />
        <rect x="138" y="30" width="34" height="190" fill="url(#lp-mesh)" />
        <line x1="172" y1="125" x2="196" y2="125" stroke="#94A3B8" strokeWidth="1.5" />
        <text x="200" y="122" fontSize="10.5" fontWeight="700" fill={INK}>Basecoat</text>
        <text x="200" y="136" fontSize="10.5" fill={MUTED}>+ fibreglass mesh</text>
      </g>

      {/* 03 Primer. */}
      <g style={layer(2)}>
        <rect x="172" y="30" width="12" height="190" fill="#C8D3C0" />
        <line x1="184" y1="70" x2="204" y2="70" stroke="#94A3B8" strokeWidth="1.5" />
        <text x="208" y="73" fontSize="10.5" fontWeight="700" fill={INK}>Primer</text>
      </g>

      {/* 04 Topcoat, textured on its outer face. */}
      <g style={layer(3)}>
        <path d="M184 30 h30 q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12 q4 6 0 10 h-30 Z"
              fill="#9FB27E" />
        <line x1="214" y1="176" x2="234" y2="176" stroke="#94A3B8" strokeWidth="1.5" />
        <text x="238" y="173" fontSize="10.5" fontWeight="700" fill={INK}>Topcoat</text>
        <text x="238" y="187" fontSize="10.5" fill={MUTED}>the bit you see</text>
      </g>
    </svg>
  );
}

export default function WhatsInvolved({ accent }: { accent: string }) {
  const [active, setActive] = useState(0);

  return (
    <section className="border-y border-slate-200" style={{ backgroundColor: "#F6F8FB" }}>
      <div className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: INK }}>What you're actually paying for</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
          Render isn't one coat of anything. It's a build-up, and the difference between a wall that
          lasts twenty years and one that cracks in three is almost always in the layers nobody sees.
        </p>

        <div className="mt-9 grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
          <ol className="space-y-3">
            {BUILD_STEPS.map((step, i) => {
              const on = active === i;
              return (
                <li key={step.stage}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    aria-current={on}
                    className="flex w-full gap-4 rounded-xl border p-4 text-left transition-colors"
                    style={{
                      borderColor: on ? accent : "#E2E8F0",
                      backgroundColor: on ? "#FFFFFF" : "transparent",
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold"
                      style={{ backgroundColor: on ? accent : "#E2E8F0", color: on ? "#FFFFFF" : MUTED }}
                    >
                      {step.stage}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold" style={{ color: INK }}>{step.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed" style={{ color: on ? TEXT : MUTED }}>
                        {step.body}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <WallSection active={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
