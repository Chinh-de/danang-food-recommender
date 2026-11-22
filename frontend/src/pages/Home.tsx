import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { MapPin, Sparkles, UserRound } from "lucide-react"
import { api } from "@/lib/api"
import type { Home as HomeT, Recs } from "@/lib/types"
import { useCurrentUser } from "@/lib/user-context"
import { useTrace } from "@/lib/trace-context"
import { ModelPicker, modelLabel } from "@/components/trace/ModelPicker"
import { ErrorNote, PlaceGrid, SectionHeader } from "@/components/common"
import { buttonVariants } from "@/components/ui/button"

function Chips({ items, param }: { items: { name: string; count: number }[]; param: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((f) => (
        <Link key={f.name} to={`/tim-kiem?${param}=${encodeURIComponent(f.name)}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm transition-colors hover:border-brand hover:text-brand outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {f.name} <span className="text-xs text-muted-foreground tabular-nums">{f.count}</span>
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  const { userId, user } = useCurrentUser()
  const { data, isLoading, error } = useQuery({
    queryKey: ["home", userId],
    queryFn: () => api.get<HomeT>("/api/home", { user_id: userId ?? undefined }),
  })
  const { model, models } = useTrace()
  // mô hình chính đã có trong /api/home; mô hình khác lấy top-20 của mô hình đó
  const other = useQuery({
    queryKey: ["recs", userId, model],
    queryFn: () => api.get<Recs>("/api/recommendations", { user_id: userId!, k: 20, model }),
    enabled: userId !== null && model !== "full",
    placeholderData: (prev) => prev,
  })
  const recs = model === "full" ? data?.recommended : other.data
  const cold = data?.recommended?.branch === "nguoi_dung_moi_chua_co_lich_su"
  return (
    <div className="mx-auto max-w-[1200px] space-y-12 px-4 py-8">
      {error && <ErrorNote error={error} />}

      {userId === null ? (
        <section className="flex flex-col items-start gap-4 rounded-xl border bg-brand-soft/50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hôm nay ăn gì ở Đà Nẵng?</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">Chọn một người dùng để nhận gợi ý quán ăn cá nhân hóa từ mô hình GNN dị thể, hoặc duyệt quán theo khu vực bên dưới.</p>
          </div>
          <Link to="/nguoi-dung" className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })}>
            <UserRound aria-hidden /> Chọn người dùng
          </Link>
        </section>
      ) : (
        <section aria-labelledby="rec-title">
          <SectionHeader title={user ? `Gợi ý cho ${user.name}` : "Gợi ý cho bạn"}
            subtitle={model !== "full" ? `Đang gợi ý bằng mô hình ${modelLabel(models, model)} (so sánh). Chọn “Hai tầng” để dùng mô hình đề xuất.`
              : cold ? "Hãy đánh giá vài quán để nhận gợi ý sát hơn." : "Những quán bạn chưa đến, chọn theo khẩu vị và thói quen của bạn."}
            action={<ModelPicker />} />
          {other.error && <ErrorNote error={other.error} />}
          <PlaceGrid places={recs?.items} loading={isLoading || (model !== "full" && other.isLoading)} count={20} why />
        </section>
      )}

      {data && data.revisit.length > 0 && (
        <section>
          <SectionHeader title="Ghé lại quán quen" subtitle="Những quán bạn từng chấm từ 7 điểm trở lên." />
          <PlaceGrid places={data.revisit.slice(0, 10)} />
        </section>
      )}

      {data && data.new_places.length > 0 && (
        <section>
          <SectionHeader title="Quán mới" subtitle={<span className="inline-flex items-center gap-1"><Sparkles className="size-4" aria-hidden /> Vừa có mặt trên FoodGo</span>} />
          <PlaceGrid places={data.new_places} />
        </section>
      )}

      {data && (
        <section className="grid gap-10 md:grid-cols-2">
          <div>
            <SectionHeader title="Theo khu vực" subtitle={<span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden /> Các quận ở Đà Nẵng</span>} />
            <Chips items={data.districts} param="district" />
          </div>
          <div>
            <SectionHeader title="Theo danh mục" />
            <Chips items={data.categories} param="category" />
          </div>
        </section>
      )}
    </div>
  )
}
