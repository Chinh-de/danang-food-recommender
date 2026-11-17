import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, fieldErrors } from "@/lib/api"
import { fmtMinutes } from "@/lib/format"
import type { Meta, Place, PlaceInput } from "@/lib/types"
import { ChipSelect, NativeSelect } from "@/components/ChipSelect"
import { PlaceMap } from "@/components/PlaceMap"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

const EMPTY: PlaceInput = {
  name: "", address: "", district: "", lat: 16.0678, lon: 108.2208, categories: [], price: null, target_audience: [],
  delivery: false, image_url: null, description: null, phone: null, opening: [],
}

const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0) }

function Field({ label, id, error, children, hint }: { label: string; id: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-destructive" id={`${id}-err`}>{error}</p>}
    </div>
  )
}

export default function PlaceForm() {
  const params = useParams()
  const editId = params.id ? Number(params.id) : null
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") })
  const existing = useQuery({ queryKey: ["place", editId], queryFn: () => api.get<Place>(`/api/places/${editId}`), enabled: editId !== null })
  const [f, setF] = useState<PlaceInput>(EMPTY)
  const [open, setOpen] = useState({ from: "07:00", to: "22:00", on: true })
  useEffect(() => {
    const p = existing.data
    if (!p) return
    setF({ name: p.name, address: p.address ?? "", district: p.district ?? "", lat: p.lat, lon: p.lon, categories: p.categories,
      price: p.price, target_audience: p.target_audience, delivery: p.delivery, image_url: p.image_url, description: p.description,
      phone: p.phone, opening: p.opening })
    if (p.opening[0]) setOpen({ from: fmtMinutes(p.opening[0][1]), to: fmtMinutes(p.opening[0][2]), on: true })
    else setOpen((o) => ({ ...o, on: false }))
  }, [existing.data])

  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, opening: open.on ? [[2, toMin(open.from), toMin(open.to)]] : [] }
      return editId === null ? api.post<Place>("/api/admin/places", body) : api.put<Place>(`/api/admin/places/${editId}`, body)
    },
    onSuccess: (p) => {
      qc.invalidateQueries()
      toast.success(editId === null ? `Đã thêm “${p.name}”. Quán xuất hiện ở mục Quán mới.` : `Đã lưu “${p.name}”`)
      nav("/admin/quan")
    },
  })
  const errs = fieldErrors(m.error)
  const set = <K extends keyof PlaceInput>(k: K, v: PlaceInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate() }
  const opts = (xs: string[] = []) => xs.map((x) => ({ value: x, label: x }))

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{editId === null ? "Thêm quán" : "Sửa quán"}</h1>
      {editId === null && <p className="mt-1 text-sm text-muted-foreground">Quán mới chưa có đánh giá; mô hình đặt quán vào đồ thị qua danh mục, mức giá, quận và đối tượng khách.</p>}
      <form onSubmit={submit} className="mt-6 space-y-5 rounded-lg border bg-card p-5">
        <Field label="Tên quán *" id="name" error={errs.name && "Nhập tên quán."}>
          <Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} className="h-10" aria-invalid={!!errs.name} />
        </Field>
        <Field label="Địa chỉ *" id="address" error={errs.address && "Nhập địa chỉ."}>
          <Input id="address" value={f.address} onChange={(e) => set("address", e.target.value)} className="h-10" aria-invalid={!!errs.address} />
        </Field>
        <Field label="Quận *" id="district" error={errs.district && "Chọn quận."}>
          <NativeSelect label="Quận" value={f.district} onChange={(v) => set("district", v)} placeholder="Chọn quận" options={opts(meta?.districts)} className="w-full" />
        </Field>
        <div className="space-y-1.5">
          <Label>Danh mục * <span className="font-normal text-muted-foreground">(chọn ít nhất một)</span></Label>
          <ChipSelect label="Danh mục" value={f.categories} onChange={(v) => set("categories", v)} options={opts(meta?.categories)} />
          {errs.categories && <p className="text-sm text-destructive">Chọn ít nhất một danh mục.</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Mức giá</Label>
          <ChipSelect label="Mức giá" multiple={false} value={f.price ? [f.price] : []} onChange={(v) => set("price", v[0] ?? null)}
            options={(meta?.prices ?? []).map((p) => ({ value: p.value, label: p.label }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Đối tượng khách</Label>
          <ChipSelect label="Đối tượng khách" value={f.target_audience} onChange={(v) => set("target_audience", v)} options={opts(meta?.audiences)} />
        </div>
        <div className="space-y-2">
          <Label>Vị trí * <span className="font-normal text-muted-foreground">(bấm trên bản đồ để chọn)</span></Label>
          <PlaceMap lat={f.lat} lon={f.lon} height={240} onPick={(lat, lon) => setF((x) => ({ ...x, lat: +lat.toFixed(6), lon: +lon.toFixed(6) }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input aria-label="Vĩ độ" type="number" step="any" value={f.lat} onChange={(e) => set("lat", Number(e.target.value))} className="h-10" />
            <Input aria-label="Kinh độ" type="number" step="any" value={f.lon} onChange={(e) => set("lon", Number(e.target.value))} className="h-10" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={open.on} onCheckedChange={(c) => setOpen({ ...open, on: !!c })} /> Có giờ mở cửa
          </label>
          {open.on && (
            <div className="flex items-center gap-2">
              <Input aria-label="Giờ mở" type="time" value={open.from} onChange={(e) => setOpen({ ...open, from: e.target.value })} className="h-10 w-32" />
              <span>-</span>
              <Input aria-label="Giờ đóng" type="time" value={open.to} onChange={(e) => setOpen({ ...open, to: e.target.value })} className="h-10 w-32" />
            </div>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox checked={f.delivery} onCheckedChange={(c) => set("delivery", !!c)} /> Có giao hàng
        </label>
        <Field label="Ảnh (đường dẫn)" id="image" hint="Để trống thì hiển thị ảnh thay thế.">
          <Input id="image" value={f.image_url ?? ""} onChange={(e) => set("image_url", e.target.value || null)} className="h-10" />
        </Field>
        <Field label="Điện thoại" id="phone">
          <Input id="phone" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} className="h-10" />
        </Field>
        <Field label="Mô tả" id="desc">
          <Textarea id="desc" value={f.description ?? ""} onChange={(e) => set("description", e.target.value || null)} rows={3} />
        </Field>
        {m.isError && Object.keys(errs).length === 0 && <p className="text-sm text-destructive" role="alert">Không lưu được. Thử lại sau.</p>}
        <div className="flex gap-3">
          <Button type="submit" size="lg" className="h-10 px-5" disabled={m.isPending}>{m.isPending ? "Đang lưu…" : editId === null ? "Thêm quán" : "Lưu thay đổi"}</Button>
          <Button type="button" variant="outline" size="lg" className="h-10 px-5" onClick={() => nav("/admin/quan")}>Hủy</Button>
        </div>
      </form>
    </div>
  )
}
