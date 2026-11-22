import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { api } from "@/lib/api"
import { fmtInt } from "@/lib/format"
import type { Meta, Page, PlaceCard } from "@/lib/types"
import { useCurrentUser } from "@/lib/user-context"
import { useTrace } from "@/lib/trace-context"
import { ModelPicker, modelLabel } from "@/components/trace/ModelPicker"
import { EmptyState, ErrorNote, Pagination, PlaceGrid } from "@/components/common"
import { NativeSelect } from "@/components/ChipSelect"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

export default function Search() {
  const [sp, setSp] = useSearchParams()
  const { userId, user } = useCurrentUser()
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") })
  const f = {
    q: sp.get("q") ?? "", district: sp.get("district") ?? "", category: sp.get("category") ?? "",
    price: sp.get("price") ?? "", open_now: sp.get("open_now") === "1",
    sort: sp.get("sort") ?? (userId !== null ? "personal" : "rating"), page: Number(sp.get("page") ?? 1),
  }
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v)
      else n.delete(k)
    }
    if (!("page" in patch)) n.delete("page")
    setSp(n)
  }
  const sort = userId === null && f.sort === "personal" ? "rating" : f.sort
  const { model, models } = useTrace()
  const { data, isLoading, error } = useQuery({
    queryKey: ["places", f, sort, userId, sort === "personal" ? model : ""],
    queryFn: () => api.get<Page<PlaceCard>>("/api/places", {
      q: f.q, district: f.district, category: f.category, price: f.price, open_now: f.open_now,
      sort, user_id: userId ?? undefined, page: f.page, page_size: 24, model: sort === "personal" ? model : undefined,
    }),
    placeholderData: (prev) => prev,
  })
  const active = f.q || f.district || f.category || f.price || f.open_now
  const sortOptions = [
    ...(userId !== null ? [{ value: "personal", label: "Phù hợp với bạn" }] : []),
    { value: "rating", label: "Điểm cao nhất" },
    { value: "reviews", label: "Nhiều đánh giá nhất" },
  ]
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{f.q ? `Kết quả cho “${f.q}”` : "Khám phá quán ăn"}</h1>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {data ? `${fmtInt(data.total)} quán${f.q ? ` có “${f.q}” trong tên` : ""}${sort === "personal" && user ? `, xếp theo mức phù hợp với ${user.name}${model !== "full" ? ` (mô hình ${modelLabel(models, model)})` : ""}` : ""}` : " "}
      </p>

      <div className="sticky top-16 z-30 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <NativeSelect label="Quận" value={f.district} onChange={(v) => set({ district: v })} placeholder="Tất cả quận"
          options={(meta?.districts ?? []).map((d) => ({ value: d, label: d }))} />
        <NativeSelect label="Danh mục" value={f.category} onChange={(v) => set({ category: v })} placeholder="Tất cả danh mục"
          options={(meta?.categories ?? []).map((c) => ({ value: c, label: c }))} className="max-w-48" />
        <NativeSelect label="Mức giá" value={f.price} onChange={(v) => set({ price: v })} placeholder="Mọi mức giá"
          options={(meta?.prices ?? []).map((p) => ({ value: String(p.value), label: p.label }))} />
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
          <Checkbox checked={f.open_now} onCheckedChange={(c) => set({ open_now: c ? "1" : "" })} /> Đang mở cửa
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">Sắp xếp</span>
          <NativeSelect label="Sắp xếp" value={sort} onChange={(v) => set({ sort: v })} options={sortOptions} />
          {sort === "personal" && <ModelPicker />}
        </div>
        {active && (
          <Button variant="ghost" size="lg" className="h-10" onClick={() => setSp(new URLSearchParams(sort !== "rating" ? { sort } : {}))}>
            <X aria-hidden /> Xóa bộ lọc
          </Button>
        )}
      </div>

      <div className="mt-6">
        {error ? <ErrorNote error={error} /> : data && data.items.length === 0 ? (
          <EmptyState title="Không tìm thấy quán phù hợp">Thử bỏ bớt bộ lọc hoặc tìm bằng từ khóa khác.</EmptyState>
        ) : (
          <>
            <PlaceGrid places={data?.items} loading={isLoading} count={15} why={f.q || true} />
            {data && <Pagination page={f.page} total={data.total} pageSize={data.page_size} onChange={(p) => { set({ page: String(p) }); window.scrollTo({ top: 0 }) }} />}
          </>
        )}
      </div>
    </div>
  )
}
