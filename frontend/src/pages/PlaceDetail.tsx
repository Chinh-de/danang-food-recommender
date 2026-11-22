import { useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Bike, Clock, MapPin, Phone, Tag, Users as UsersIcon } from "lucide-react"
import { api } from "@/lib/api"
import { fmtInt, fmtMinutes, fmtMoney, fmtScore } from "@/lib/format"
import type { Page, Place, PlaceCard, Review } from "@/lib/types"
import { useCurrentUser } from "@/lib/user-context"
import { ErrorNote, Pagination, PlaceGrid, RatingBadge, SafeImage, SectionHeader } from "@/components/common"
import { PlaceMap } from "@/components/PlaceMap"
import { ReviewForm, ReviewItem } from "@/components/Reviews"
import { Skeleton } from "@/components/ui/skeleton"
import { WhyButton } from "@/components/trace/WhyButton"

function Info({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return <li className="flex gap-2.5 text-sm"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><span>{children}</span></li>
}

export default function PlaceDetail() {
  const id = Number(useParams().id)
  const { userId, user } = useCurrentUser()
  const [page, setPage] = useState(1)
  const { data: p, isLoading, error } = useQuery({
    queryKey: ["place", id, userId],
    queryFn: () => api.get<Place>(`/api/places/${id}`, { user_id: userId ?? undefined }),
  })
  const reviews = useQuery({
    queryKey: ["place-reviews", id, page],
    queryFn: () => api.get<Page<Review>>(`/api/places/${id}/reviews`, { page, page_size: 8 }),
    placeholderData: (prev) => prev,
  })
  const similar = useQuery({
    queryKey: ["similar", id, userId],
    queryFn: () => api.get<PlaceCard[]>(`/api/places/${id}/similar`, { k: 10, user_id: userId ?? undefined }),
  })

  if (error) return <div className="mx-auto max-w-[1200px] px-4 py-8"><ErrorNote error={error} /></div>
  if (isLoading || !p) {
    return <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-8 md:grid-cols-[1.2fr_1fr]"><Skeleton className="aspect-[4/3]" /><div className="space-y-3"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-40" /></div></div>
  }
  const priceRange = [fmtMoney(p.price_min), fmtMoney(p.price_max)].filter(Boolean).join(" - ")
  const aspects = p.aspects.filter((a) => a.score !== null)
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      {p.is_hidden && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Quán đã ngừng hiển thị trên FoodGo.</p>}
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:gap-8">
        <SafeImage src={p.image_full_url ?? p.image_url} alt={p.name} className="aspect-[4/3] w-full rounded-xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {p.categories.map((c) => <span key={c} className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium">{c}</span>)}
            {p.is_new && <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-accent-foreground">Mới</span>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <RatingBadge value={p.stars} className="px-2 py-1 text-lg" />
            <span className="text-sm text-muted-foreground tabular-nums">{fmtInt(p.review_count)} đánh giá</span>
            {p.my_rating !== null && <span className="text-sm font-medium text-brand">Bạn đã chấm {fmtScore(p.my_rating)}</span>}
          </div>
          <WhyButton placeId={p.id} variant="detail" className="mt-3" />
          <ul className="mt-5 space-y-2.5">
            {p.address && <Info icon={MapPin}>{p.address}</Info>}
            <Info icon={Clock}>
              {p.opening.length === 0 ? "Chưa có giờ mở cửa" : (
                <>
                  {p.is_open_now !== null && <b className={p.is_open_now ? "text-rating" : "text-rating-low"}>{p.is_open_now ? "Đang mở cửa" : "Đã đóng cửa"} · </b>}
                  {p.opening.map(([, a, b]) => `${fmtMinutes(a)} - ${fmtMinutes(b)}`).join(", ")}
                </>
              )}
            </Info>
            {(priceRange || p.price_label) && <Info icon={Tag}>{priceRange || p.price_label}{priceRange && p.price_label ? ` · ${p.price_label}` : ""}</Info>}
            {p.phone && <Info icon={Phone}>{p.phone}</Info>}
            {p.target_audience.length > 0 && <Info icon={UsersIcon}>Phù hợp: {p.target_audience.join(", ")}</Info>}
            {p.delivery && <Info icon={Bike}>Có giao hàng</Info>}
          </ul>
          {aspects.length > 0 && (
            <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {aspects.map((a) => (
                <div key={a.name} className="flex items-center gap-2 text-sm">
                  <dt className="w-24 shrink-0 text-muted-foreground">{a.name}</dt>
                  <dd className="flex flex-1 items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-brand" style={{ width: `${(a.score! / 10) * 100}%` }} /></span>
                    <span className="w-8 text-right font-medium tabular-nums">{fmtScore(a.score)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <section>
          {p.description && <p className="mb-8 leading-relaxed text-foreground/85">{p.description}</p>}
          <SectionHeader title="Đánh giá" subtitle={reviews.data ? `${fmtInt(reviews.data.total)} đánh giá` : undefined} />
          {reviews.data?.items.length === 0 && <p className="text-sm text-muted-foreground">Chưa có đánh giá nào. Hãy là người đầu tiên.</p>}
          <div>{reviews.data?.items.map((r) => <ReviewItem key={r.id} r={r} />)}</div>
          {reviews.data && <Pagination page={page} total={reviews.data.total} pageSize={reviews.data.page_size} onChange={setPage} />}
        </section>
        <aside className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Viết đánh giá</h2>
            <ReviewForm placeId={id} user={user} onDone={() => setPage(1)} />
          </div>
          <PlaceMap lat={p.lat} lon={p.lon} />
        </aside>
      </div>

      {similar.data && similar.data.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="Quán tương tự" subtitle="Gần nhau trong không gian vector của mô hình GNN." />
          <PlaceGrid places={similar.data} />
        </section>
      )}
    </div>
  )
}
