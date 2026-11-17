export const fmtScore = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : v.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const fmtInt = (v: number) => v.toLocaleString("vi-VN")

export const fmtMoney = (v: number | null | undefined) => (v ? `${Math.round(v).toLocaleString("vi-VN")}đ` : null)

export function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export const fmtMinutes = (m: number) => {
  const h = Math.floor(m / 60) % 24
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

export function ratingTone(v: number | null | undefined) {
  if (v === null || v === undefined) return "bg-muted-foreground"
  if (v >= 7.5) return "bg-rating"
  if (v >= 5) return "bg-rating-mid"
  return "bg-rating-low"
}

export const BRANCH_LABEL: Record<string, string> = {
  mo_hinh_chinh: "Mô hình chính (GNN dị thể + xếp hạng lại)",
  nguoi_dung_moi_co_lich_su: "Người dùng mới đã có đánh giá (GNN dị thể + xếp hạng lại)",
  nguoi_dung_moi_chua_co_lich_su: "Người dùng mới chưa có đánh giá (mô hình đơn giản: phổ biến + sở thích)",
}
