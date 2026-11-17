import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { fmtInt } from "@/lib/format"
import type { Stats } from "@/lib/types"
import { ErrorNote } from "@/components/common"
import { Skeleton } from "@/components/ui/skeleton"

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-[28px] leading-tight font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { data: s, error } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api.get<Stats>("/api/admin/stats"), refetchInterval: 10000 })
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dữ liệu Foody Đà Nẵng cộng với phát sinh trên FoodGo.</p>
      </div>
      {error && <ErrorNote error={error} />}
      {!s ? <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <>
          <section>
            <h2 className="mb-3 font-semibold">Toàn hệ thống</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Tile label="Người dùng" value={fmtInt(s.users)} />
              <Tile label="Quán" value={fmtInt(s.places)} note={`${fmtInt(s.hidden_places)} quán đang ẩn`} />
              <Tile label="Đánh giá" value={fmtInt(s.reviews)} />
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-semibold">Phát sinh trên FoodGo</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Tile label="Người dùng mới" value={fmtInt(s.new_users)} />
              <Tile label="Quán mới" value={fmtInt(s.new_places)} />
              <Tile label="Đánh giá mới" value={fmtInt(s.new_reviews)} />
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-semibold">Khởi đầu lạnh</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Tile label="Người dùng chưa có đánh giá" value={fmtInt(s.cold_users)} note="Gợi ý bằng mô hình đơn giản (phổ biến + sở thích)" />
              <Tile label="Quán mới chưa có đánh giá" value={fmtInt(s.cold_places)} note="Vector lấy từ nút danh mục, giá, quận, đối tượng" />
              <Tile label="Thời gian cập nhật mô hình" value={`${fmtInt(Math.round(s.last_reload_ms))} ms`} note="Dựng lại đồ thị và lan truyền sau mỗi lần ghi" />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
