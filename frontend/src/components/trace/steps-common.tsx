import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Ranking, TraceAny } from "@/lib/trace-types"
import { CheckLine, Histogram, fmt, type Focus } from "./viz"

/** Một bước của popup. `flow` là giá trị bước này tính ra, hiện ở cột luồng bên trái; `inputs` trỏ về bước cung cấp dữ liệu. */
export type Step = {
  key: string
  short: string
  title: string
  flow: ReactNode
  inputs?: { from: string; also?: string[]; text: ReactNode }[]   // also: các bước khác cùng cấp dữ liệu (chỉ để tô sáng)
  output?: ReactNode
  graph?: { focus: Focus; layer?: number }
  note: string
  body: ReactNode
}

export function Table({ head, rows, className }: { head: ReactNode[]; rows: ReactNode[][]; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-md border", className)}>
      <table className="w-full text-xs">
        <thead className="bg-surface text-left"><tr>{head.map((h, k) => <th key={k} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, k) => <tr key={k} className="border-t">{r.map((c, j) => <td key={j} className={cn("px-2 py-1.5 tabular-nums", j > 0 && "whitespace-nowrap")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export const Chip = ({ children, color = "#55555c" }: { children: ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium" style={{ borderColor: color, color }}>{children}</span>
)

/** Bước 1 chung cho mọi mô hình: thuộc tính quán và lịch sử đánh giá; `uses` nói mô hình đang xem dùng phần nào. */
export function dataStep(t: TraceAny, uses: string): Step {
  const P = t.data.place, Uh = t.data.user
  return {
    key: "data", short: "Dữ liệu", title: "Dữ liệu thô", graph: t.nodes ? { focus: "pair" } : undefined,
    flow: <>{Uh.n_history} đánh giá của u · quán i</>,
    output: <>Thuộc tính của quán i và lịch sử đánh giá của u</>,
    note: uses,
    body: (
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-1 text-sm font-semibold text-brand">Quán i: {P.name}</h4>
          <Table head={["Thuộc tính", "Giá trị"]} rows={[
            ["Danh mục", P.categories.join(", ") || "-"], ["Mức giá", P.price_label ?? "-"], ["Giao hàng", P.delivery ? "Có" : "Không"],
            ["Quận", P.district ?? "-"], ["Đối tượng khách", P.target_audience.join(", ") || "-"],
            ["5 khía cạnh", P.aspects.map((a) => `${a.name} ${fmt(a.score, 1)}`).join(" · ")],
            ["Tọa độ", `${fmt(P.lat, 4)}, ${fmt(P.lon, 4)}`], ["Điểm, số review", `${fmt(P.stars, 1)} · ${P.review_count}`],
          ]} />
        </div>
        <div>
          <h4 className="mb-1 text-sm font-semibold text-[#2a78d6]">Người dùng u: {Uh.name} ({Uh.n_history} đánh giá)</h4>
          {Uh.n_history === 0 ? <p className="text-sm text-muted-foreground">Chưa có đánh giá nào.</p> : (
            <Table head={["Quán đã đánh giá", "Điểm", "Ngày"]} rows={Uh.history.map((h) => [h.name, fmt(h.rating, 1), h.date])} />
          )}
          {Uh.n_history > Uh.history.length && <p className="mt-1 text-xs text-muted-foreground">… và {Uh.n_history - Uh.history.length} đánh giá cũ hơn</p>}
        </div>
      </div>
    ),
  }
}

/** Bước cuối chung: xếp các quán u chưa đến theo điểm của mô hình, ra top-K. */
export function rankingStep(t: TraceAny, R: Ranking, from: string, scoreLabel: string, what: string): Step {
  const rankText = R.seen ? "đã đến" : R.rank === null ? "-" : `#${R.rank}`
  return {
    key: "ranking", short: "Xếp hạng", title: "Thứ hạng cuối",
    flow: <b className={R.in_topk ? "text-rating" : undefined}>{rankText}{R.in_topk ? ` · top-${R.topk}` : ""}</b>,
    inputs: [{ from, text: <>{scoreLabel} = {fmt(R.score, 4)} của quán i, và điểm của mọi quán khác</> }],
    output: R.in_topk ? <>Quán i nằm trong top-{R.topk} gợi ý của mô hình này</> : <>Quán i không vào top-{R.topk}</>,
    note: "Sắp xếp mọi quán u chưa đến theo điểm, giữ K quán đầu. Danh sách này trùng với cột của mô hình ở trang So sánh mô hình.",
    body: (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border px-4 py-2 text-center"><div className="text-xs text-muted-foreground">{scoreLabel}</div><div className="text-xl font-bold tabular-nums">{fmt(R.score, 4)}</div></div>
          <ChevronRight className="text-muted-foreground" aria-hidden />
          <div className={cn("rounded-lg border px-4 py-2 text-center", R.in_topk && "border-rating bg-rating/10")}><div className="text-xs text-muted-foreground">Thứ hạng</div><div className="text-2xl font-bold tabular-nums">{rankText}</div></div>
          <p>{R.seen ? "u đã đánh giá quán này nên nó không được gợi ý lại." : <>trong {R.pool} quán u chưa đến{R.ties > 0 ? `, ${R.ties} quán khác cùng điểm` : ""}. {R.in_topk ? <b className="text-rating">Nằm trong top-{R.topk}.</b> : `Ngoài top-${R.topk}.`}</>}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Phân bố điểm của {R.pool} quán (vạch đỏ: quán i)</p>
          <Histogram counts={R.hist.counts} edges={R.hist.edges} mark={R.score} />
        </div>
        <div><h4 className="mb-1 font-semibold">Top-{R.topk} của {t.user.name}</h4>
          <ol className="grid grid-cols-1 gap-x-4 text-xs sm:grid-cols-2">{R.top.map((p, k) => <li key={p.id} className={cn("truncate py-0.5", p.id === t.place.id && "font-bold text-brand")}>{k + 1}. {p.name}</li>)}</ol>
        </div>
        <CheckLine check={R.check} what={what} />
      </div>
    ),
  }
}

/** Bước "Khớp từ khóa" khi popup mở từ trang tìm kiếm: các quán khớp được xếp bằng chính mô hình đang xem. */
export function searchStep(t: TraceAny): Step {
  const S = t.search!
  const info = t.models.find((m) => m.key === t.model)
  return {
    key: "search", short: "Tìm kiếm", title: "Khớp từ khóa",
    flow: <>“{S.q}”: #{S.rank ?? "-"}/{S.matched}</>,
    output: <>{S.matched} quán khớp tên, xếp theo điểm của {info?.label ?? "mô hình"} ở các bước sau</>,
    note: "Tìm kiếm chỉ lọc theo tên (và địa chỉ). Thứ tự các quán khớp do mô hình gợi ý đang chọn quyết định.",
    body: (
      <div className="space-y-2 text-sm">
        <p>Từ khóa <b>“{S.q}”</b> khớp <b>{S.matched}</b> quán ({S.name_match ? "có trong tên quán này" : "khớp địa chỉ"}).</p>
        <p>Trong {S.matched} quán đó, “{t.place.name}” đứng thứ <b>{S.rank ?? "-"}</b> khi xếp theo điểm của mô hình {info?.label} cho {t.user.name}.</p>
      </div>
    ),
  }
}
