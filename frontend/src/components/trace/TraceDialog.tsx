import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, CornerDownRight, Pause, Play } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { ModelKey, TraceAny } from "@/lib/trace-types"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorNote } from "@/components/common"
import { SubGraph } from "./viz"
import { searchStep, type Step } from "./steps-common"
import { ModelSelect } from "./ModelPicker"
import { gnnSteps } from "./steps-main"
import { classicSteps } from "./steps-classic"

const BRANCH = { mo_hinh_chinh: "Mô hình chính hai tầng", nguoi_dung_moi_co_lich_su: "Người dùng mới, đã có đánh giá: mô hình chính", nguoi_dung_moi_chua_co_lich_su: "Người dùng mới chưa có đánh giá: mô hình đơn giản" }
const GNN_LABEL: Partial<Record<ModelKey, string>> = { full: "Mô hình chính", gnn_bin: "GNN dị thể nhị phân", gnn_rating: "GNN dị thể theo điểm", gnn_dyn: "GNN dị thể động" }

function buildSteps(t: TraceAny, side: "place" | "user", setSide: (s: "place" | "user") => void): Step[] {
  if (t.model === "full") return gnnSteps(t, side, setSide, GNN_LABEL.full!)   // bước tìm kiếm đã có sẵn trong mô hình chính
  const steps = t.model in GNN_LABEL ? gnnSteps(t, side, setSide, GNN_LABEL[t.model]!) : classicSteps(t, side, setSide)
  return t.search ? [searchStep(t), ...steps] : steps
}

/** Cột luồng: mỗi bước một ô ghi giá trị nó tính ra; bước đang xem sáng, các bước cấp dữ liệu cho nó viền xanh. */
function FlowColumn({ steps, k, onPick }: { steps: Step[]; k: number; onPick: (j: number) => void }) {
  const feeds = new Set((steps[k]?.inputs ?? []).flatMap((x) => [x.from, ...(x.also ?? [])]))
  return (
    <ol className="flex gap-0 overflow-x-auto p-2 md:flex-col md:overflow-x-visible md:overflow-y-auto md:p-3" aria-label="Luồng tính toán">
      {steps.map((st, j) => {
        const cur = j === k, done = j < k, feed = feeds.has(st.key)
        return (
          <li key={st.key} className="flex shrink-0 items-center md:flex-col md:items-stretch">
            <button type="button" onClick={() => onPick(j)} aria-current={cur ? "step" : undefined}
              ref={cur ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
              className={cn("w-36 rounded-md border px-2.5 py-1.5 text-left transition-colors md:w-full",
                cur ? "border-brand bg-brand/5 ring-2 ring-brand/25" : feed ? "border-[#2a78d6] bg-[#2a78d6]/5" : done ? "bg-background hover:bg-surface" : "border-dashed text-muted-foreground hover:bg-surface")}>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className={cn("grid size-4 shrink-0 place-items-center rounded-full text-[10px] tabular-nums", cur ? "bg-brand text-white" : done || feed ? "bg-foreground/80 text-white" : "bg-foreground/10")}>{j + 1}</span>
                <span className="truncate">{st.short}</span>
                {feed && <span className="ml-auto text-[10px] font-medium text-[#2a78d6]">đầu vào</span>}
              </div>
              <div className="mt-0.5 min-h-4 truncate text-[11px] tabular-nums text-muted-foreground">{j <= k ? st.flow : "…"}</div>
            </button>
            {j < steps.length - 1 && (
              <span className={cn("grid place-items-center px-1 text-muted-foreground/60 md:h-4 md:px-0", j === k - 1 && "text-brand")} aria-hidden>
                <ArrowRight className="size-3.5 md:hidden" /><ArrowDown className="hidden size-3.5 md:block" />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function TraceDialog({ open, onOpenChange, userId, placeId, q, initialModel = "full" }: { open: boolean; onOpenChange: (o: boolean) => void; userId: number | null; placeId: number | null; q?: string; initialModel?: ModelKey }) {
  const [model, setModel] = useState<ModelKey>(initialModel)
  const { data: t, isLoading, isFetching, error } = useQuery({
    queryKey: ["trace", userId, placeId, q ?? "", model],
    queryFn: () => api.get<TraceAny>("/api/trace", { user_id: userId!, place_id: placeId!, q, model }),
    enabled: open && userId !== null && placeId !== null,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const [k, setK] = useState(0)
  const [side, setSide] = useState<"place" | "user">("place")
  const [playing, setPlaying] = useState(false)
  const steps = useMemo(() => (t ? buildSteps(t, side, setSide) : []), [t, side])
  // mở popup: bắt đầu từ bước 1 với mô hình đang dùng để gợi ý
  useEffect(() => { if (open) { setK(0); setPlaying(false); setSide("place"); setModel(initialModel) } }, [open, placeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setK(0); setPlaying(false); setSide("place") }, [model])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "SELECT") return
      if (e.key === "ArrowRight") setK((x) => Math.min(x + 1, steps.length - 1))
      if (e.key === "ArrowLeft") setK((x) => Math.max(x - 1, 0))
    }
    window.addEventListener("keydown", h, true)   // bắt ở pha capture: nút đang có focus trong popup không chặn được
    return () => window.removeEventListener("keydown", h, true)
  }, [open, steps.length])
  useEffect(() => {
    if (!playing) return
    if (k >= steps.length - 1) { setPlaying(false); return }
    const id = window.setTimeout(() => setK((x) => x + 1), 2500)
    return () => window.clearTimeout(id)
  }, [playing, k, steps.length])
  const s = steps[Math.min(k, steps.length - 1)]
  const idx = (key: string) => steps.findIndex((x) => x.key === key)
  const go = (j: number) => { if (j >= 0) { setK(j); setPlaying(false) } }
  const info = t?.models.find((m) => m.key === t.model)
  const next = steps[k + 1]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] w-[min(1200px,calc(100%-2rem))] max-w-none flex-col gap-0 p-0 sm:max-w-none max-sm:h-dvh max-sm:w-full max-sm:rounded-none">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-semibold">
              Vì sao gợi ý <span className="text-brand">{t?.place.name ?? "…"}</span> cho <span className="text-[#2a78d6]">{t?.user.name ?? "…"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {!t ? "Đang tính từng bước…" : t.model === "full" ? BRANCH[t.branch] : `${info?.label}: ${info?.description}`}
            </DialogDescription>
          </div>
          {t && (
            <label className="flex items-center gap-2 text-xs font-medium whitespace-nowrap max-sm:w-full">
              Mô hình
              <ModelSelect value={model} onChange={setModel} models={t.models} disabled={isFetching} className="h-8 max-sm:flex-1" />
            </label>
          )}
        </div>
        {error ? <div className="p-4"><ErrorNote error={error} /></div> : isLoading || !t || !s ? (
          <div className="grid flex-1 gap-4 p-4 md:grid-cols-[15rem_1fr]"><Skeleton className="h-full min-h-60" /><div className="space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-40" /><Skeleton className="h-24" /></div></div>
        ) : (
          <>
            <div className={cn("flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[15rem_1fr]", isFetching && "opacity-60 transition-opacity")}>
              <div className="shrink-0 border-b bg-surface/50 md:min-h-0 md:overflow-y-auto md:border-r md:border-b-0">
                <FlowColumn steps={steps} k={k} onPick={go} />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="text-xs font-medium text-muted-foreground">Bước {k + 1}/{steps.length}</p>
                <h3 className="mb-3 text-lg font-semibold">{s.title}</h3>
                {s.inputs && s.inputs.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {s.inputs.map((inp, j) => {
                      const n = idx(inp.from)
                      return (
                        <button key={j} type="button" onClick={() => go(n)}
                          className="flex w-full items-start gap-2 rounded-md bg-[#2a78d6]/8 px-2.5 py-1.5 text-left text-xs hover:bg-[#2a78d6]/15">
                          <CornerDownRight className="mt-px size-3.5 shrink-0 text-[#2a78d6]" aria-hidden />
                          <span><b className="text-[#2a78d6]">Đầu vào từ bước {n + 1} · {steps[n]?.short}:</b> {inp.text}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {s.graph && <div className="mb-3 h-64 rounded-md border"><SubGraph t={t} focus={s.graph.focus} layer={s.graph.layer} /></div>}
                {s.body}
                {s.output && (
                  <div className="mt-4 flex items-start gap-2 rounded-md border-l-4 border-brand bg-brand/5 px-3 py-2 text-xs">
                    <span><b className="text-brand">Đầu ra{next ? ` → bước ${k + 2} · ${next.short}` : ""}:</b> {s.output}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
              <Button variant="outline" onClick={() => go(Math.max(k - 1, 0))} disabled={k === 0}><ChevronLeft /> Trước</Button>
              <Button onClick={() => go(Math.min(k + 1, steps.length - 1))} disabled={k >= steps.length - 1}>Bước tiếp <ChevronRight /></Button>
              <Button variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={k >= steps.length - 1}>{playing ? <><Pause /> Dừng</> : <><Play /> Tự chạy</>}</Button>
              <p className="ml-auto max-w-xl text-xs text-muted-foreground max-sm:w-full">{s.note}</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
