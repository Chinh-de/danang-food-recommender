import { cn } from "@/lib/utils"

/** Nhóm chip chọn nhiều (hoặc một) giá trị; dùng cho sở thích, bộ lọc, form admin. */
export function ChipSelect<T extends string | number>({ options, value, onChange, multiple = true, label }: {
  options: { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
  multiple?: boolean
  label: string
}) {
  const toggle = (v: T) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v))
    else onChange(multiple ? [...value, v] : [v])
  }
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button key={String(o.value)} type="button" aria-pressed={on} onClick={() => toggle(o.value)}
            className={cn("min-h-9 cursor-pointer rounded-md border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-brand bg-brand-soft font-medium text-accent-foreground" : "bg-background hover:bg-muted")}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function NativeSelect({ value, onChange, options, label, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label: string
  placeholder?: string
  className?: string
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className={cn("h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
