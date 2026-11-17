import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, fieldErrors } from "@/lib/api"
import type { Meta, Prefs, User } from "@/lib/types"
import { useCurrentUser } from "@/lib/user-context"
import { ChipSelect } from "@/components/ChipSelect"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function NewUser() {
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") })
  const [name, setName] = useState("")
  const [prefs, setPrefs] = useState<Prefs>({ categories: [], prices: [], districts: [] })
  const { setUserId } = useCurrentUser()
  const qc = useQueryClient()
  const nav = useNavigate()
  const m = useMutation({
    mutationFn: (withPrefs: boolean) =>
      api.post<User>("/api/users", { name, prefs: withPrefs && (prefs.categories.length || prefs.prices.length || prefs.districts.length) ? prefs : null }),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ["users"] })
      setUserId(u.id)
      toast.success(`Đã tạo người dùng ${u.name}`)
      nav("/")
    },
  })
  const errs = fieldErrors(m.error)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    m.mutate(true)
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tạo người dùng mới</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Người dùng mới chưa có đánh giá nên chưa có trong đồ thị. FoodGo gợi ý theo độ phổ biến và sở thích bạn chọn,
        rồi chuyển sang mô hình GNN ngay sau đánh giá đầu tiên.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Tên hiển thị</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="h-10 text-base md:text-sm"
            aria-invalid={!!errs.name} aria-describedby={errs.name ? "name-err" : undefined} autoFocus />
          {errs.name && <p id="name-err" className="text-sm text-destructive">Tên không được để trống.</p>}
        </div>
        <fieldset className="space-y-3">
          <legend className="font-medium">Bạn hay ăn gì? <span className="font-normal text-muted-foreground">(không bắt buộc)</span></legend>
          <ChipSelect label="Danh mục" value={prefs.categories} onChange={(v) => setPrefs({ ...prefs, categories: v })}
            options={(meta?.categories ?? []).map((c) => ({ value: c, label: c }))} />
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-medium">Mức giá</legend>
          <ChipSelect label="Mức giá" value={prefs.prices} onChange={(v) => setPrefs({ ...prefs, prices: v })}
            options={(meta?.prices ?? []).map((p) => ({ value: p.value, label: p.label }))} />
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-medium">Khu vực hay đến</legend>
          <ChipSelect label="Quận" value={prefs.districts} onChange={(v) => setPrefs({ ...prefs, districts: v })}
            options={(meta?.districts ?? []).map((d) => ({ value: d, label: d }))} />
        </fieldset>
        {m.isError && !errs.name && <p className="text-sm text-destructive" role="alert">Không tạo được người dùng. Thử lại sau.</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" className="h-10 px-5" disabled={m.isPending || !name.trim()}>
            {m.isPending ? "Đang tạo…" : "Tạo người dùng"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="h-10 px-5" disabled={m.isPending || !name.trim()} onClick={() => m.mutate(false)}>
            Bỏ qua sở thích
          </Button>
        </div>
      </form>
    </div>
  )
}
