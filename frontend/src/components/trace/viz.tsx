import { CircleCheck, CircleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Check as CheckT, Trace } from "@/lib/trace-types"

export const GROUP_COLOR = { static: "#2a78d6", dynamic: "#1a8a3a", extra: "#eb6834" } as const
export const GROUP_LABEL = { static: "Tĩnh", dynamic: "Động", extra: "Đặc thù Đà Nẵng" } as const
const REL_COLOR: Record<string, string> = { UI: "#2a78d6", IC: "#55555c", IP: "#55555c", IF: "#55555c", ID: "#eb6834", IA: "#eb6834" }
export const relColor = (r: string) => REL_COLOR[r] ?? "#55555c"

export const fmt = (x: number | null | undefined, d = 3) =>
  x === null || x === undefined || !Number.isFinite(x) ? "-" : x.toLocaleString("vi-VN", { maximumFractionDigits: d, minimumFractionDigits: 0 })

/** Dải 64 ô: xanh = âm, đỏ = dương, cùng thang `scale` để so được giữa các dải. */
export function VectorStrip({ v, scale, label, sub, className }: { v: number[]; scale: number; label?: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label !== undefined && <div className="w-28 shrink-0 text-right text-xs leading-tight"><div className="font-medium">{label}</div>{sub && <div className="text-muted-foreground">{sub}</div>}</div>}
      <div className="grid h-4 flex-1 overflow-hidden rounded-sm ring-1 ring-foreground/10" style={{ gridTemplateColumns: `repeat(${v.length}, minmax(0, 1fr))` }}>
        {v.map((x, k) => {
          const t = Math.min(Math.abs(x) / (scale || 1), 1)
          const c = x >= 0 ? `rgba(208, 2, 27, ${t})` : `rgba(42, 120, 214, ${t})`
          return <span key={k} style={{ background: c }} title={`chiều ${k}: ${x.toFixed(4)}`} />
        })}
      </div>
    </div>
  )
}

export const maxAbs = (...vs: number[][]) => Math.max(1e-9, ...vs.flat().map(Math.abs))

/** Dải vector thu nhỏ cho cột luồng. */
export const MiniStrip = ({ v }: { v: number[] }) => <VectorStrip v={v} scale={maxAbs(v)} className="h-2.5 [&>div]:h-2.5" />

/** Tọa độ các quán đã đến, tâm vùng quen và quán đang xét. Khung bám cụm chính; quán ở xa được kẹp vào mép (chấm rỗng). */
export function GeoScatter({ points, center, place, km }: { points: { name: string; lat: number; lon: number }[]; center: { lat: number; lon: number }; place: { lat: number; lon: number }; km: number }) {
  const W = 440, H = 280, pad = 26
  const kx = Math.cos((center.lat * Math.PI) / 180)
  const px = (p: { lat: number; lon: number }) => p.lon * kx
  const q = (a: number[], t: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.max(0, Math.round(t * (b.length - 1))))] }
  const xs = points.map(px), ys = points.map((p) => p.lat)
  const fx = [q(xs, 0.1), q(xs, 0.9), px(center), px(place)], fy = [q(ys, 0.1), q(ys, 0.9), center.lat, place.lat]
  const cx = (Math.min(...fx) + Math.max(...fx)) / 2, cy = (Math.min(...fy) + Math.max(...fy)) / 2
  const span = Math.max(Math.max(...fx) - Math.min(...fx), Math.max(...fy) - Math.min(...fy), 0.004) * 1.15
  const sc = Math.min(W - 2 * pad, H - 2 * pad) / span
  const raw = (p: { lat: number; lon: number }) => ({ x: W / 2 + (px(p) - cx) * sc, y: H / 2 - (p.lat - cy) * sc })
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const at = (p: { lat: number; lon: number }) => { const r = raw(p); return { x: clamp(r.x, 8, W - 8), y: clamp(r.y, 8, H - 8), out: r.x < 8 || r.x > W - 8 || r.y < 8 || r.y > H - 8 } }
  const C = at(center), P = at(place)
  return (
    <div className="max-w-xl space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border bg-surface" role="img" aria-label="Vị trí các quán đã đến, tâm vùng quen và quán đang xét">
        {points.map((p, k) => { const a = at(p); return <circle key={k} cx={a.x} cy={a.y} r={a.out ? 3.5 : 4.5} fill={a.out ? "none" : "#2a78d6"} stroke="#2a78d6" strokeWidth={a.out ? 1.5 : 0} opacity={a.out ? 0.8 : 0.55}><title>{p.name}{a.out ? " (ở xa, ngoài khung)" : ""}</title></circle> })}
        <line x1={C.x} y1={C.y} x2={P.x} y2={P.y} stroke="#6b4fc8" strokeWidth={2} strokeDasharray="5 4" />
        <line x1={C.x - 8} y1={C.y} x2={C.x + 8} y2={C.y} stroke="#1f1f22" strokeWidth={2.5} /><line x1={C.x} y1={C.y - 8} x2={C.x} y2={C.y + 8} stroke="#1f1f22" strokeWidth={2.5} />
        <circle cx={P.x} cy={P.y} r={7} fill="#fdecee" stroke="#d0021b" strokeWidth={2.5} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#2a78d6]/60" />quán u đã đến</span>
        <span className="flex items-center gap-1"><span className="font-bold text-foreground">+</span>tâm vùng quen</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-[#d0021b] bg-[#fdecee]" />quán i</span>
        <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-[#6b4fc8]" />{fmt(km, 2)} km</span>
      </div>
    </div>
  )
}

export function CheckLine({ check, what }: { check: CheckT | undefined; what: string }) {
  if (!check) return null
  const ok = check.err < 1e-3
  return (
    <p className={cn("mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs", ok ? "bg-rating/10 text-rating" : "bg-destructive/10 text-destructive")}>
      {ok ? <CircleCheck className="mt-px size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />}
      <span><b>Kiểm chứng:</b> {what} {ok ? "khớp" : "lệch"} giá trị engine đang dùng, sai số lớn nhất {check.err.toExponential(1)}.</span>
    </p>
  )
}

export function Formula({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-surface px-3 py-2 font-mono text-[13px]">{children}</div>
}

/** Dải phân bố giá trị của 200 ứng viên, vạch đỏ là quán đang xét. */
export function DistStrip({ dist, value, color }: { dist: number[]; value: number | null; color: string }) {
  if (!dist.length) return null
  const lo = Math.min(...dist, value ?? Infinity), hi = Math.max(...dist, value ?? -Infinity)
  const x = (t: number) => (hi > lo ? ((t - lo) / (hi - lo)) * 100 : 50)
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-3 w-full" aria-hidden>
      <line x1="0" y1="5" x2="100" y2="5" stroke="#d4d4d8" strokeWidth="0.6" />
      {dist.map((d, k) => <circle key={k} cx={x(d)} cy={5} r={0.9} fill={color} opacity={0.35} />)}
      {value !== null && <rect x={x(value) - 0.7} y="0" width="1.4" height="10" fill="#d0021b" />}
    </svg>
  )
}

export function Histogram({ counts, edges, mark }: { counts: number[]; edges: number[]; mark: number }) {
  const W = 360, H = 90, mx = Math.max(...counts, 1)
  const lo = edges[0], hi = edges[edges.length - 1]
  const xm = ((mark - lo) / (hi - lo || 1)) * W
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full max-w-md">
      {counts.map((c, k) => (
        <rect key={k} x={(k / counts.length) * W + 1} y={H - (c / mx) * H} width={W / counts.length - 2} height={(c / mx) * H} fill="#2a78d6" opacity="0.35" />
      ))}
      <line x1={xm} y1={0} x2={xm} y2={H} stroke="#d0021b" strokeWidth="2.5" />
      <text x={Math.min(Math.max(xm, 30), W - 30)} y={H + 14} fontSize="11" textAnchor="middle" fill="#d0021b" fontWeight="600">quán này</text>
    </svg>
  )
}

/** Thác nước: nền → cộng/trừ từng tiêu chí → điểm cuối. */
export function Waterfall({ base, items, score }: { base: number; items: { label: string; total: number; group: keyof typeof GROUP_COLOR }[]; score: number }) {
  const rows = [{ label: "Giá trị nền", from: 0, to: base, color: "#8a8a92" }]
  let cur = base
  for (const it of items) {
    rows.push({ label: it.label, from: cur, to: cur + it.total, color: GROUP_COLOR[it.group] })
    cur += it.total
  }
  rows.push({ label: "Điểm cuối s", from: 0, to: score, color: "#6b4fc8" })
  const vals = rows.flatMap((r) => [r.from, r.to])
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals)
  const X = (t: number) => ((t - lo) / (hi - lo || 1)) * 100
  return (
    <div className="space-y-1">
      {rows.map((r, k) => {
        const a = X(Math.min(r.from, r.to)), b = X(Math.max(r.from, r.to))
        const d = r.to - r.from
        const last = k === rows.length - 1 || k === 0
        return (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className={cn("w-40 shrink-0 truncate text-right", last && "font-semibold")}>{r.label}</span>
            <div className="relative h-4 flex-1 rounded-sm bg-surface">
              <span className="absolute top-0 bottom-0 w-px bg-foreground/30" style={{ left: `${X(0)}%` }} />
              <span className="absolute top-0.5 bottom-0.5 rounded-[2px]" style={{ left: `${a}%`, width: `${Math.max(b - a, 0.6)}%`, background: r.color, opacity: last ? 1 : 0.85 }} />
            </div>
            <span className={cn("w-16 shrink-0 text-right tabular-nums", !last && (d >= 0 ? "text-rating" : "text-destructive"))}>
              {last ? fmt(r.to, 3) : `${d >= 0 ? "+" : ""}${fmt(d, 3)}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------- Đồ thị con ----------------
export type Focus = "pair" | "attrs" | "weights" | "norm" | "e0" | "layer" | "score" | "dim"

const KIND_STYLE: Record<string, { fill: string; stroke: string }> = {
  user: { fill: "#e8f1fc", stroke: "#2a78d6" }, place: { fill: "#fdecee", stroke: "#d0021b" },
  IC: { fill: "#f4f4f5", stroke: "#3d3d44" }, IP: { fill: "#f4f4f5", stroke: "#3d3d44" }, IF: { fill: "#f4f4f5", stroke: "#3d3d44" },
  ID: { fill: "#fdf0e8", stroke: "#eb6834" }, IA: { fill: "#fdf0e8", stroke: "#eb6834" },
}
const short = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

export function SubGraph({ t, focus, layer }: { t: Trace; focus: Focus; layer?: number }) {
  const W = 520
  const U = { x: 150, y: 215 }, P = { x: 335, y: 215 }
  const attrs = t.nodes?.place_attrs ?? []
  const hist = (t.weights?.edges ?? []).filter((e) => e.place_id !== t.place.id).slice(0, 6)
  const others = (t.layers?.[0]?.place.rels.find((r) => r.rel === "UI")?.neighbors ?? []).filter((n) => n.id !== t.user.id).slice(0, 4)
  const arc = (c: { x: number; y: number }, r: number, a0: number, a1: number, n: number) =>
    Array.from({ length: n }, (_, k) => {
      const a = n === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * k) / (n - 1)
      return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }
    })
  const attrPos = arc(P, 115, -Math.PI * 0.42, Math.PI * 0.42, attrs.length)
  const histPos = arc(U, 88, Math.PI * 0.62, Math.PI * 1.38, hist.length)
  const otherPos = arc(P, 105, -Math.PI * 0.85, -Math.PI * 0.55, others.length)
  const maxW = Math.max(...hist.map((e) => e.w), 0.01)
  const on = (f: Focus[]) => f.includes(focus)
  const dimAll = focus === "dim"
  const flow = focus === "layer"
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }, color: string, w: number, active: boolean, key: string, label?: string) => (
    <g key={key} opacity={dimAll ? 0.15 : active ? 1 : 0.18}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w} className={flow && active ? "trace-flow" : undefined} strokeDasharray={flow && active ? "6 6" : undefined} />
      {label && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} fontSize="10" textAnchor="middle" fill={color} fontWeight="600">{label}</text>}
    </g>
  )
  const node = (p: { x: number; y: number }, kind: string, label: string, r: number, active: boolean, key: string, big = false) => (
    <g key={key} opacity={dimAll ? 0.2 : active ? 1 : 0.25}>
      {kind === "user" || kind === "place"
        ? <circle cx={p.x} cy={p.y} r={r} fill={KIND_STYLE[kind].fill} stroke={KIND_STYLE[kind].stroke} strokeWidth={big ? 3 : 2} />
        : <rect x={p.x - 9} y={p.y - 9} width="18" height="18" rx="4" fill={KIND_STYLE[kind].fill} stroke={KIND_STYLE[kind].stroke} strokeWidth="2" />}
      {big && <text x={p.x} y={p.y + 5} fontSize="14" fontWeight="700" textAnchor="middle">{kind === "user" ? "u" : "i"}</text>}
      <text x={p.x} y={p.y + r + 13} fontSize={big ? 12 : 10} fontWeight={big ? 700 : 500} textAnchor="middle" fill="#1f1f22">{short(label, big ? 22 : 15)}</text>
    </g>
  )
  return (
    <svg viewBox="20 80 500 305" className="h-full w-full" role="img" aria-label="Đồ thị con quanh người dùng và quán">
      {attrs.map((a, k) => edge(P, attrPos[k], relColor(a.rel), 2, on(["attrs", "norm", "layer", "e0"]), `ea${k}`,
        focus === "norm" ? fmt(t.norm?.attrs.find((x) => x.label === a.label)?.a_hat, 3) : undefined))}
      {hist.map((e, k) => edge(U, histPos[k], "#2a78d6", focus === "weights" ? 1 + 5 * (e.w / maxW) : 2, on(["attrs", "weights", "norm", "layer", "e0"]), `eh${k}`,
        focus === "weights" ? fmt(e.w, 2) : focus === "norm" ? fmt(e.a_hat, 3) : undefined))}
      {others.map((_, k) => edge(P, otherPos[k], "#2a78d6", 2, on(["layer"]), `eo${k}`))}
      {focus === "score"
        ? edge(U, P, "#6b4fc8", 4, true, "uy", `ŷ = ${fmt(t.stage1?.y, 3)}`)
        : t.weights?.edges.some((e) => e.place_id === t.place.id) && edge(U, P, "#2a78d6", 3, true, "up")}
      {attrs.map((a, k) => node(attrPos[k], a.kind, a.label, 9, on(["attrs", "norm", "layer", "e0"]), `na${k}`))}
      {hist.map((e, k) => node(histPos[k], "place", e.name, 9, on(["attrs", "weights", "norm", "layer", "e0"]), `nh${k}`))}
      {others.map((o, k) => node(otherPos[k], "user", o.label, 8, on(["layer"]), `no${k}`))}
      {node(U, "user", t.user.name, 20, true, "u", true)}
      {node(P, "place", t.place.name, 20, true, "p", true)}
      {flow && layer !== undefined && <text x={W / 2} y={378} fontSize="11" textAnchor="middle" fill="#2a78d6" fontWeight="600">Lớp {layer}: thông tin chảy từ hàng xóm vào u và i</text>}
    </svg>
  )
}
