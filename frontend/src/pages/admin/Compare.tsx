import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { CircleCheck } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { PlaceCard, User } from "@/lib/types"
import { ErrorNote, SafeImage, UserAvatar } from "@/components/common"
import { CompareMap } from "@/components/CompareMap"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { UserPicker } from "./Explain"

type ModelMeta = { key: string; label: string; group: "A" | "B"; mechanisms: string[]; description: string; available: boolean }
type Stats = { km: number | null; out_pct: number | null; cat_pct: number | null; pop: number | null; overlap: number | null; radius_km?: number }
type Column = ModelMeta & { items: number[]; stats: Stats; hits?: number[]; metrics?: Record<string, number> }
type CompareRes = {
  mode: "now" | "holdout"; k: number; error?: string; targets: number[]; user: User
  center: { lat: number; lon: number; radius_km: number }; columns: Column[]
  places: Record<string, PlaceCard & { lat: number; lon: number }>
}
type SummaryRow = ModelMeta & { metrics?: Record<string, number>; notebook?: Record<string, number>; match?: boolean }
type Summary = { n_users: number; ks: number[]; rows: SummaryRow[]; examples: { user_id: number; name: string; ndcg_full: number; ndcg_best_other: number }[] }

const MECH: [string, string][] = [["interactions", "Tương tác"], ["attributes", "Thuộc tính"], ["rating", "Điểm"], ["time", "Thời gian"], ["location", "Khoảng cách"], ["local", "Đà Nẵng"]]
const PRESETS: { label: string; keys: string[] }[] = [
  { label: "Đơn giản và đề xuất", keys: ["pop", "itemknn", "svd", "full"] },
  { label: "Lọc cộng tác và GNN", keys: ["userknn", "itemknn", "svd", "gcn", "full"] },
  { label: "Các bước của đề tài", keys: ["gcn", "gnn_bin", "gnn_rating", "gnn_dyn", "full"] },
]
const MAX_COLS = 5
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "-" : `${x.toLocaleString("vi-VN")}%`)
const n4 = (x: number | undefined) => (x === undefined ? "-" : x.toFixed(4).replace(".", ","))

function MechBar({ m }: { m: string[] }) {
  return (
    <div className="flex gap-0.5" aria-label={`Dùng: ${MECH.filter(([k]) => m.includes(k)).map(([, l]) => l).join(", ") || "không dùng lịch sử cá nhân"}`}>
      {MECH.map(([k, l]) => <span key={k} title={l} className={cn("h-1.5 flex-1 rounded-full", m.includes(k) ? "bg-brand" : "bg-foreground/10")} />)}
    </div>
  )
}

export default function Compare() {
  const [sp, setSp] = useSearchParams()
  const userId = sp.get("user_id") ? Number(sp.get("user_id")) : null
  const mode = (sp.get("mode") as "now" | "holdout") ?? "now"
  const [keys, setKeys] = useState<string[]>(PRESETS[0].keys)
  const [hover, setHover] = useState<number | null>(null)
  const [mapCol, setMapCol] = useState<string>("full")
  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) n.set(k, v); setSp(n) }

  const models = useQuery({ queryKey: ["compare-models"], queryFn: () => api.get<ModelMeta[]>("/api/admin/compare/models") })
  const avail = (models.data ?? []).filter((m) => m.available)
  const shown = keys.filter((k) => avail.some((m) => m.key === k))
  const { data, error, isFetching } = useQuery({
    queryKey: ["compare", userId, mode, shown.join(",")],
    queryFn: () => api.get<CompareRes>("/api/admin/compare", { user_id: userId!, mode, k: 10, models: shown.join(",") }),
    enabled: userId !== null && shown.length > 0,
    placeholderData: (p) => p,
  })
  const summary = useQuery({ queryKey: ["compare-summary"], queryFn: () => api.get<Summary>("/api/admin/compare/summary"), staleTime: Infinity })
  const toggle = (k: string) => setKeys((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : ks.length >= MAX_COLS ? ks : [...ks, k]))
  const targets = new Set(data?.targets ?? [])
  const col = data?.columns.find((c) => c.key === mapCol) ?? data?.columns[data.columns.length - 1]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">So sánh mô hình</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cùng một người dùng, gợi ý của nhiều mô hình đặt cạnh nhau. Dải nhỏ dưới tên mô hình cho biết mô hình dùng thông tin nào:
          {" "}{MECH.map(([, l]) => l).join(", ")}. Nhóm A là mô hình cổ điển, nhóm B là các mô hình GNN của đề tài.
        </p>
      </div>

      <UserPicker value={userId} onPick={(id) => set({ user_id: String(id) })} />

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Chế độ</span>
          {([["now", "Gợi ý hiện tại"], ["holdout", "Kiểm tra quá khứ"]] as const).map(([m, l]) => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => set({ mode: m })}>{l}</Button>
          ))}
          <span className="ml-4 text-sm font-medium">Chọn nhanh</span>
          {PRESETS.map((p) => <Button key={p.label} size="sm" variant="ghost" onClick={() => setKeys(p.keys)}>{p.label}</Button>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(models.data ?? []).map((m) => (
            <button key={m.key} type="button" disabled={!m.available} onClick={() => toggle(m.key)} title={m.available ? m.description : "Chưa có tham số: cần chạy lại notebook để lưu gcn.pt"}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                keys.includes(m.key) ? "border-brand bg-brand text-white" : "bg-background hover:bg-muted")}>
              <span className="mr-1 opacity-70">{m.group}</span>{m.label}
            </button>
          ))}
          <span className="self-center text-xs text-muted-foreground">tối đa {MAX_COLS} cột</span>
        </div>
        {mode === "holdout" && (
          <div className="text-sm">
            <p className="text-muted-foreground">Ẩn các quán người dùng đến gần đây nhất (tập test), đồ thị chỉ dùng train + valid, rồi xem mô hình nào đoán trúng. Chỉ áp dụng cho người dùng gốc của Foody.</p>
            {summary.data && summary.data.examples.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium">Ví dụ mà mô hình hai tầng đoán đúng, các mô hình khác trượt:</span>
                {summary.data.examples.slice(0, 6).map((e) => (
                  <Button key={e.user_id} size="xs" variant="outline" onClick={() => set({ user_id: String(e.user_id) })}>{e.name}</Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <ErrorNote error={error} />}
      {data?.error && <p className="rounded-lg border bg-card p-4 text-sm">{data.error}</p>}
      {userId !== null && !data && !error && <Skeleton className="h-96" />}

      {data && !data.error && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card p-4 text-sm">
            <span className="flex items-center gap-2 font-medium"><UserAvatar user={data.user} size={28} /> {data.user.name}</span>
            <span>Bán kính vùng quen: <b className="tabular-nums">{data.center.radius_km.toLocaleString("vi-VN")} km</b></span>
            {mode === "holdout" && <span>Thực tế đã đến tiếp (bị ẩn khi đoán): <b>{data.targets.map((t) => data.places[t]?.name).join(", ")}</b></span>}
            {isFetching && <span className="text-muted-foreground">Đang tính…</span>}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${data.columns.length}, minmax(180px, 1fr))` }}>
            {data.columns.map((c) => (
              <section key={c.key} className={cn("flex min-w-0 flex-col rounded-lg border bg-card", c.key === "full" && "ring-2 ring-brand")}>
                <header className="space-y-1.5 border-b p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">{c.label}</h2><span className="text-xs text-muted-foreground">nhóm {c.group}</span>
                  </div>
                  <MechBar m={c.mechanisms} />
                  <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                </header>
                <ol className="flex-1 divide-y">
                  {c.items.map((id, r) => {
                    const p = data.places[id]
                    const hit = targets.has(id)
                    return (
                      <li key={id} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
                        className={cn("flex items-center gap-2 px-2 py-1.5 text-xs transition-colors", hover === id && "bg-brand-soft", hit && "bg-rating/10")}>
                        <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{r + 1}</span>
                        <SafeImage src={p?.image_url} alt="" className="size-8 shrink-0 rounded" />
                        <span className="min-w-0 flex-1 truncate" title={p?.name}>{p?.name}</span>
                        {hit && <CircleCheck className="size-4 shrink-0 text-rating" aria-label="Đoán trúng" />}
                      </li>
                    )
                  })}
                </ol>
                <footer className="space-y-0.5 border-t bg-surface/60 p-3 text-xs tabular-nums">
                  {c.metrics && <p className="mb-1 font-semibold">NDCG@10 {n4(c.metrics["NDCG@10"])} · trúng {c.hits?.length ?? 0}</p>}
                  <p>Cách vùng quen TB: <b>{c.stats.km?.toLocaleString("vi-VN") ?? "-"} km</b></p>
                  <p>Ngoài vùng quen: <b>{pct(c.stats.out_pct)}</b></p>
                  <p>Khớp danh mục quen: <b>{pct(c.stats.cat_pct)}</b></p>
                  <p>Số review TB: <b>{c.stats.pop?.toLocaleString("vi-VN") ?? "-"}</b></p>
                  {c.key !== "full" && <p>Trùng với hai tầng: <b>{c.stats.overlap}/{c.items.length}</b></p>}
                  <Button size="xs" variant={col?.key === c.key ? "default" : "outline"} className="mt-1.5 w-full" onClick={() => setMapCol(c.key)}>Xem trên bản đồ</Button>
                </footer>
              </section>
            ))}
          </div>

          {col && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Bản đồ: {col.label}</h2>
              <p className="text-xs text-muted-foreground">Vòng xanh nét đứt là vùng quen của người dùng. Chấm tím là quán mô hình gợi ý{mode === "holdout" ? ", chấm xanh lá là quán thực tế đã đến (viền tím nếu mô hình đoán trúng)" : ""}.</p>
              <CompareMap center={data.center} radiusKm={data.center.radius_km} points={[
                ...col.items.map((id, r) => ({ id, lat: data.places[id].lat, lon: data.places[id].lon, label: data.places[id].name, rank: r + 1, kind: targets.has(id) ? "both" as const : "pick" as const })),
                ...data.targets.filter((t) => !col.items.includes(t)).map((t) => ({ id: t, lat: data.places[t].lat, lon: data.places[t].lon, label: data.places[t].name, kind: "target" as const })),
              ]} />
            </div>
          )}
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Kết quả trên toàn tập test</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Tính lại ngay trên web cho {summary.data?.n_users.toLocaleString("vi-VN") ?? "…"} người dùng, cùng cách đánh giá với notebook (đồ thị train + valid, đích là tập test).
          Cột “Notebook” là số trong báo cáo; dấu ✔ nghĩa là số tính lại trên web khớp. Mô hình nhóm A học từ train + valid, tức nhiều dữ liệu hơn GNN.
        </p>
        {summary.isLoading ? <Skeleton className="h-64" /> : summary.data && (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-surface text-left">
                <tr>
                  <th className="px-3 py-2">Mô hình</th>
                  {["Recall@10", "Recall@20", "NDCG@10", "NDCG@20", "HitRate@20", "MRR@20", "NDCG@50"].map((h) => <th key={h} className="px-3 py-2 text-right">{h}</th>)}
                  <th className="px-3 py-2 text-right">Notebook NDCG@20</th>
                </tr>
              </thead>
              <tbody>
                {summary.data.rows.map((r) => {
                  const best = r.key === "full"
                  return (
                    <tr key={r.key} className={cn("border-t", best && "bg-brand-soft/60 font-semibold", r.key === "gcn" && "border-t-2")}>
                      <td className="px-3 py-1.5"><span className="mr-1.5 text-muted-foreground">{r.group}</span>{r.label}</td>
                      {r.metrics ? ["Recall@10", "Recall@20", "NDCG@10", "NDCG@20", "HitRate@20", "MRR@20", "NDCG@50"].map((h) => <td key={h} className="px-3 py-1.5 text-right">{n4(r.metrics![h])}</td>)
                        : <td colSpan={7} className="px-3 py-1.5 text-muted-foreground">Chưa có tham số (cần chạy lại notebook để lưu gcn.pt)</td>}
                      <td className="px-3 py-1.5 text-right">{r.notebook ? <>{n4(r.notebook["NDCG@20"])} {r.match && <span className="text-rating">✔</span>}</> : "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
