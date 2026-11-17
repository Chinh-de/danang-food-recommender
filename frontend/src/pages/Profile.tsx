import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { fmtInt } from "@/lib/format"
import type { Page, Review } from "@/lib/types"
import { useCurrentUser } from "@/lib/user-context"
import { EmptyState, Pagination, UserAvatar } from "@/components/common"
import { ReviewItem } from "@/components/Reviews"
import { Button, buttonVariants } from "@/components/ui/button"

export default function Profile() {
  const { userId, user, setUserId } = useCurrentUser()
  const [page, setPage] = useState(1)
  const reviews = useQuery({
    queryKey: ["user-reviews", userId, page],
    queryFn: () => api.get<Page<Review>>(`/api/users/${userId}/reviews`, { page, page_size: 10 }),
    enabled: userId !== null,
    placeholderData: (prev) => prev,
  })
  if (userId === null) return <Navigate to="/nguoi-dung" replace />
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {user && (
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar user={user} size={72} />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.is_new ? "Người dùng mới · " : "Thành viên Foody · "}{fmtInt(user.total_reviews)} đánh giá</p>
            {user.prefs && (
              <p className="mt-1 text-sm text-muted-foreground">
                Sở thích: {[...user.prefs.categories, ...user.prefs.districts].join(", ") || "chưa chọn"}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/nguoi-dung" className={buttonVariants({ variant: "outline", size: "lg", className: "h-10 px-4" })}>Đổi người dùng</Link>
            <Button variant="ghost" size="lg" className="h-10 px-4" onClick={() => setUserId(null)}>Thoát</Button>
          </div>
        </div>
      )}
      <h2 className="mt-8 mb-2 text-xl font-semibold">Lịch sử đánh giá</h2>
      {reviews.data?.items.length === 0 ? (
        <EmptyState title="Chưa có đánh giá nào"><Link to="/tim-kiem" className="text-brand hover:underline">Tìm một quán để đánh giá</Link></EmptyState>
      ) : (
        <>
          <div>{reviews.data?.items.map((r) => <ReviewItem key={r.id} r={r} showPlace />)}</div>
          {reviews.data && <Pagination page={page} total={reviews.data.total} pageSize={reviews.data.page_size} onChange={setPage} />}
        </>
      )}
    </div>
  )
}
