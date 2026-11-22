import type { Criterion, TraceAny } from "@/lib/trace-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"
import { CheckLine, DistStrip, Formula, GROUP_COLOR, GROUP_LABEL, Histogram, MiniStrip, VectorStrip, Waterfall, fmt, maxAbs, relColor } from "./viz"
import { Chip, Table, dataStep, rankingStep, type Step } from "./steps-common"

function criterionText(c: Criterion): string {
  const d = c.detail as Record<string, never>
  const list = (x: unknown) => (Array.isArray(x) && x.length ? x.join(", ") : "-")
  switch (c.key) {
    case "gnn": return `điểm tầng 1 ŷ = ${fmt(d.score, 3)}`
    case "near": return `cách tâm vùng quen ${fmt(d.km, 2)} km, bán kính quen ${fmt(d.radius_km, 2)} km → −${fmt(d.km, 2)} / ${fmt(d.radius_km, 2)}`
    case "pop_all": return `${d.count} review trước mốc ${d.before} → log(1 + ${d.count})`
    case "cat_match": return `quán: ${list(d.place)} · gu của bạn: ${list(d.user_top)}`
    case "price_diff": return `mức giá quán ${fmt(d.place, 0)}, mức giá quen ${fmt(d.user, 2)} → −|chênh lệch|`
    case "item_rating": return `điểm quán ${fmt(d.stars10, 1)}/10`
    case "item_reviews": return `${d.count} review → log(1 + số review)`
    case "pop_recent": return `${d.count} review trong ${d.days} ngày trước mốc → log(1 + ${d.count})`
    case "sim_last": return `cosine với trung bình embedding của: ${list(d.last)}`
    case "covisit": return `${d.count} lượt người khác đến quán này ngay sau: ${list(d.last)}`
    case "near_last": return d.km === null ? "chưa có quán vừa đến" : `cách quán vừa đến (${list(d.last)}) ${fmt(d.km, 2)} km`
    case "asp_match": return `5 khía cạnh của quán: ${list((d.place as unknown as (number | null)[])?.map((x) => fmt(x, 1)))} so với hồ sơ khía cạnh của bạn`
    case "same_district": return `quận ${d.district ?? "-"}: tỷ lệ quán trong lịch sử của bạn ở cùng quận`
    case "aud_match": return `đối tượng khách: ${list(d.place)} so với hồ sơ của bạn`
  }
  return ""
}

const WEIGHT_FORMULA = {
  binary: { title: "Trọng số cạnh nhị phân", formula: () => "w = 1 cho mọi cạnh người dùng–quán", note: "Bản nhị phân chỉ biết u đã đến quán nào, không dùng điểm hay ngày đánh giá." },
  static: { title: "Trọng số cạnh theo điểm", formula: () => "w = r,  r = điểm / 10", note: "Bản theo điểm dùng điểm đánh giá làm trọng số, không xét đánh giá cũ hay mới." },
  dynamic: {
    title: "Trọng số cạnh động",
    formula: (floor: number, tau: number) => `w = r × (${fmt(floor, 1)} + ${fmt(1 - floor, 1)} · e^(−Δt / ${tau})),  r = điểm / 10`,
    note: "Đánh giá càng cũ, trọng số càng giảm nhưng không dưới mức sàn.",
  },
} as const

const BRANCH_COLD = "Người dùng chưa có nút trong đồ thị. Hệ thống dùng mô hình đơn giản cho tới đánh giá đầu tiên."

/** Các bước của GNN dị thể. full = mô hình chính hai tầng; ngược lại dừng ở tầng 1 rồi xếp hạng (gnn_bin, gnn_rating, gnn_dyn). */
export function gnnSteps(t: TraceAny, side: "place" | "user", setSide: (s: "place" | "user") => void, label: string): Step[] {
  const full = t.model === "full"
  const steps: Step[] = []
  if (full && t.search) {
    steps.push({
      key: "search", short: "Tìm kiếm", title: "Khớp từ khóa",
      flow: <>“{t.search.q}”: #{t.search.rank ?? "-"}/{t.search.matched}</>,
      output: <>{t.search.matched} quán khớp tên, xếp theo mô hình chính ở các bước sau</>,
      note: "Tìm kiếm chỉ lọc theo tên (và địa chỉ). Thứ tự các quán khớp do chính mô hình gợi ý quyết định.",
      body: (
        <div className="space-y-2 text-sm">
          <p>Từ khóa <b>“{t.search.q}”</b> khớp <b>{t.search.matched}</b> quán ({t.search.name_match ? "có trong tên quán này" : "khớp địa chỉ"}).</p>
          <p>Trong {t.search.matched} quán đó, “{t.place.name}” đứng thứ <b>{t.search.rank ?? "-"}</b> khi xếp theo mức phù hợp với {t.user.name}: tầng 1 rồi tầng 2 trên đúng tập quán khớp.</p>
        </div>
      ),
    })
  }
  steps.push(dataStep(t, `${label} dùng lịch sử đánh giá và thuộc tính dạng lựa chọn của quán (thành nút đồ thị)${full ? "; tầng 2 dùng thêm tọa độ, thời gian, khía cạnh" : ""}.`))

  if (full && t.cold) {
    const c = t.cold
    steps.push({
      key: "cold-pop", short: "Phổ biến", title: "Mô hình đơn giản: độ phổ biến",
      flow: <>phân vị {fmt(c.pop_pct, 3)}</>, inputs: [{ from: "data", text: <>số review của quán i</> }],
      output: <>Điểm phổ biến của quán i</>, note: BRANCH_COLD,
      body: (
        <div className="space-y-2 text-sm">
          <Formula>phổ biến = phân vị( log(1 + review {c.recent_days} ngày gần đây) + 0,25 · log(1 + tổng review) )</Formula>
          <p>Quán có <b>{c.pop_recent}</b> review trong {c.recent_days} ngày gần đây, <b>{c.pop_all}</b> review tổng cộng → phân vị <b>{fmt(c.pop_pct, 3)}</b> (0 = ít nhất, 1 = nhiều nhất).</p>
        </div>
      ),
    })
    const row = (name: string, chosen: unknown[] | undefined, hit: boolean, w: number) =>
      [name, chosen?.length ? chosen.join(", ") : "không chọn", hit ? "khớp" : "không", hit ? `+${fmt(w, 1)}` : "0"]
    const bonus = (c.match.category ? c.weights.category : 0) + (c.match.district ? c.weights.district : 0) + (c.match.price ? c.weights.price : 0)
    steps.push({
      key: "cold-match", short: "Sở thích", title: "Khớp sở thích đã khai báo",
      flow: <>+{fmt(bonus, 1)}</>, inputs: [{ from: "data", text: <>sở thích khai báo khi tạo tài khoản, thuộc tính quán i</> }],
      output: <>Điểm cộng do khớp sở thích</>,
      note: "Sở thích chọn khi tạo tài khoản được cộng điểm; danh mục được ưu tiên nhất.",
      body: <Table head={["Sở thích", "Bạn chọn", "Quán này", "Điểm cộng"]} rows={[
        row("Danh mục", c.prefs.categories, c.match.category, c.weights.category),
        row("Quận", c.prefs.districts, c.match.district, c.weights.district),
        row("Mức giá", c.prefs.prices, c.match.price, c.weights.price),
      ]} />,
    })
    steps.push({
      key: "cold-result", short: "Kết quả", title: "Điểm và thứ hạng",
      flow: <b>#{c.rank}</b>, inputs: [{ from: "cold-pop", text: <>phân vị {fmt(c.pop_pct, 3)}</> }, { from: "cold-match", text: <>điểm cộng {fmt(bonus, 1)}</> }],
      note: "Ngay sau đánh giá đầu tiên, người dùng được thêm vào đồ thị và chuyển sang mô hình chính.",
      body: (
        <div className="text-sm">
          <Formula>điểm = {fmt(c.pop_pct, 3)} + {c.match.category ? "1" : "0"} + {c.match.district ? "0,5" : "0"} + {c.match.price ? "0,5" : "0"} = <b>{fmt(c.score, 3)}</b></Formula>
          <p className="mt-2">Xếp thứ <b>{c.rank}</b> trong {c.pool} quán.</p>
          <CheckLine check={c.check} what="tổng các thành phần" />
        </div>
      ),
    })
    return steps
  }

  const N = t.nodes!, Wt = t.weights!, Nm = t.norm!, E0 = t.e0!, S1 = t.stage1!
  const mode = Wt.mode ?? "dynamic"
  const WF = WEIGHT_FORMULA[mode]
  steps.push({
    key: "nodes", short: "Số hóa", title: "Số hóa thành nút đồ thị", graph: { focus: "attrs" },
    flow: <>{N.n_nodes.toLocaleString("vi-VN")} nút · i nối {N.place_attrs.length} thuộc tính</>,
    inputs: [{ from: "data", text: <>lịch sử của u, thuộc tính dạng lựa chọn của quán i</> }],
    output: <>Đồ thị: cạnh u–quán đã đến, cạnh quán–thuộc tính</>,
    note: "Mỗi thuộc tính dạng lựa chọn trở thành một nút; quán nối với nút đó bằng một cạnh. Hai quán cùng danh mục được nối gián tiếp qua nút danh mục.",
    body: (
      <div className="space-y-3 text-sm">
        <p>Đồ thị có <b>{N.n_nodes.toLocaleString("vi-VN")}</b> nút. Người dùng u là nút <b>#{N.user_node.node}</b> nối với {N.n_places_of_user} quán; quán i là nút <b>#{N.place_node.node}</b> nối với {N.n_users_of_place} người dùng.</p>
        <Table head={["Quan hệ", "Thuộc tính", "Nút"]} rows={N.place_attrs.map((a) => [<Chip color={relColor(a.rel)}>{a.rel}</Chip>, a.label, `#${a.node}`])} />
        <p className="text-xs text-muted-foreground">Không thành nút{full ? " (dùng ở tầng 2)" : " (mô hình này không dùng)"}: {N.not_nodes.join(", ")}.</p>
      </div>
    ),
  })
  const ws = Wt.edges.map((e) => e.w)
  steps.push({
    key: "weights", short: "Trọng số", title: WF.title, graph: { focus: "weights" },
    flow: mode === "binary" ? <>w = 1 · {Wt.edges.length} cạnh</> : <>{Wt.edges.length} cạnh, w {fmt(Math.min(...ws), 2)}–{fmt(Math.max(...ws), 2)}</>,
    inputs: [{ from: "nodes", text: <>{Wt.edges.length} cạnh người dùng–quán của u</> }, { from: "data", text: mode === "dynamic" ? <>điểm và ngày đánh giá</> : mode === "static" ? <>điểm đánh giá</> : <>chỉ việc đã đến</> }],
    output: <>Trọng số w của từng cạnh u–quán</>,
    note: mode === "dynamic" ? `${WF.note} Δt tính từ đánh giá mới nhất của chính người dùng (${Wt.t_ref}).` : WF.note,
    body: (
      <div className="space-y-2">
        <Formula>{WF.formula(Wt.floor, Wt.tau)}</Formula>
        <Table head={mode === "dynamic" ? ["Quán", "Điểm", "r", "Δt (ngày)", "hệ số thời gian", "w"] : ["Quán", "Điểm", "r", "w"]}
          rows={Wt.edges.slice(0, 12).map((e) => mode === "dynamic"
            ? [e.name, fmt(e.rating, 1), fmt(e.r, 2), fmt(e.dt_days, 0), fmt(e.decay, 3), <b>{fmt(e.w, 3)}</b>]
            : [e.name, fmt(e.rating, 1), fmt(e.r, 2), <b>{fmt(e.w, 3)}</b>])} />
        <CheckLine check={Wt.check} what={mode === "binary" ? "w = 1" : mode === "static" ? "w = r" : "w = r × hệ số thời gian"} />
      </div>
    ),
  })
  steps.push({
    key: "norm", short: "Chuẩn hóa", title: "Chuẩn hóa ma trận kề", graph: { focus: "norm" },
    flow: <>Â u–quán ≈ {fmt(Nm.ui[0]?.a_hat, 3)}</>,
    inputs: [{ from: "weights", text: <>w của từng cạnh</> }, { from: "nodes", text: <>cạnh quán–thuộc tính (w = 1)</> }],
    output: <>Ma trận Â: hệ số mỗi hàng xóm đóng góp khi lan truyền</>,
    note: "Chuẩn hóa để nút có nhiều cạnh (quán đông khách, danh mục phổ biến) không lấn át khi cộng thông tin.",
    body: (
      <div className="space-y-2">
        <Formula>Â[a, b] = w / √(d_a · d_b),  d = tổng trọng số các cạnh của nút</Formula>
        <Table head={["Cạnh u–quán", "w", "d_u", "d_quán", "Â"]} rows={Nm.ui.map((r) => [r.name, fmt(r.w, 3), fmt(r.d_u, 2), fmt(r.d_i, 2), <b>{fmt(r.a_hat, 4)}</b>])} />
        <Table head={["Cạnh quán–thuộc tính", "d_quán", "d_thuộc tính", "Â"]} rows={Nm.attrs.map((r) => [`${r.rel}: ${r.label}`, r.d_place, r.d_attr, <b>{fmt(r.a_hat, 4)}</b>])} />
        <CheckLine check={Nm.check} what="Â tính lại" />
      </div>
    ),
  })
  const sc0 = maxAbs(E0.user, E0.place)
  steps.push({
    key: "e0", short: "E⁽⁰⁾", title: "Embedding ban đầu E⁽⁰⁾", graph: { focus: "e0" },
    flow: <MiniStrip v={E0.place} />,
    inputs: [{ from: "nodes", text: <>mỗi nút một vector {E0.dim} chiều (tham số đã huấn luyện)</> }],
    output: <>E⁽⁰⁾ của mọi nút, đầu vào của lớp 1</>,
    note: "Mỗi nút có một vector 64 chiều học được khi huấn luyện. Đỏ là giá trị dương, xanh là âm.",
    body: (
      <div className="space-y-2">
        <VectorStrip v={E0.user} scale={sc0} label="E⁽⁰⁾[u]" sub={E0.user_is_new_node ? "nút mới = 0" : t.user.name} />
        <VectorStrip v={E0.place} scale={sc0} label="E⁽⁰⁾[i]" sub={E0.place_is_new_node ? "nút mới = 0" : t.place.name} />
        <p className="text-xs text-muted-foreground">{E0.dim} chiều. Nút mới (người dùng hoặc quán thêm trên FoodGo) có E⁽⁰⁾ = 0 và nhận vector qua lan truyền.</p>
      </div>
    ),
  })
  for (const L of t.layers!) {
    const S = L[side]
    const prev = L.l === 1 ? "e0" : `layer${L.l - 1}`
    steps.push({
      key: `layer${L.l}`, short: `Lớp ${L.l}`, title: `Lan truyền lớp ${L.l}`, graph: { focus: "layer", layer: L.l },
      flow: <MiniStrip v={L.place.result} />,
      inputs: [{ from: prev, text: <>E⁽{L.l - 1}⁾ của các hàng xóm</> }, { from: "norm", text: <>hệ số Â</> }],
      output: <>E⁽{L.l}⁾ của mọi nút{L.l < t.layers!.length ? `, sang lớp ${L.l + 1}` : ""}</>,
      note: "Mỗi quan hệ gom thông tin của các hàng xóm (nhân Â), nhân hệ số học được α, rồi cộng lại. Không có ma trận W, không có hàm kích hoạt.",
      body: (
        <div className="space-y-3">
          <Formula>E⁽{L.l}⁾[{side === "place" ? "i" : "u"}] = Σᵣ αᵣ · Σⱼ Âᵣ[{side === "place" ? "i" : "u"}, j] · E⁽{L.l - 1}⁾[j]</Formula>
          <div className="flex gap-1" role="tablist">
            {(["place", "user"] as const).map((s) => (
              <Button key={s} size="sm" variant={side === s ? "default" : "outline"} onClick={() => setSide(s)} role="tab" aria-selected={side === s}>
                {s === "place" ? "Quán i" : "Người dùng u"}
              </Button>
            ))}
          </div>
          {S.rels.map((r) => (
            <div key={r.rel} className="rounded-md border p-2">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <Chip color={relColor(r.rel)}>{r.rel}</Chip><span>{r.rel_label}</span>
                <span className="text-muted-foreground">· {r.n} hàng xóm · α = {fmt(r.alpha, 3)}</span>
              </div>
              <p className="mb-1 text-xs text-muted-foreground">
                {r.neighbors.map((n) => `${n.label} (Â ${fmt(n.a_hat, 3)})`).join(" · ")}{r.others > 0 ? ` · + ${r.others} nút khác` : ""}
              </p>
              <VectorStrip v={r.weighted} scale={maxAbs(r.weighted)} label={`α·Σ ${r.rel}`} sub={`độ lớn ${fmt(r.norm, 3)}`} />
            </div>
          ))}
          <VectorStrip v={S.result} scale={maxAbs(S.result)} label={<b>⊕ E⁽{L.l}⁾</b>} className="border-t pt-2" />
          <CheckLine check={S.check} what={`tổng đóng góp các quan hệ = E⁽${L.l}⁾`} />
        </div>
      ),
    })
  }
  const nL = t.layers!.length
  const sc1 = maxAbs(...S1.layers_user, ...S1.layers_place)
  steps.push({
    key: "stage1", short: full ? "Tầng 1" : "Điểm", title: full ? "Gộp lớp và điểm tầng 1" : "Gộp lớp và điểm", graph: { focus: "score" },
    flow: <>ŷ = {fmt(S1.y, 3)}{!S1.seen && <> · #{S1.rank}</>}</>,
    inputs: [{ from: `layer${nL}`, also: ["e0", ...Array.from({ length: nL - 1 }, (_, k) => `layer${k + 1}`)], text: <>E⁽⁰⁾ … E⁽{nL}⁾ của u và i (các bước E⁽⁰⁾ và lớp 1–{nL})</> }],
    output: full ? <>ŷ và 200 ứng viên điểm cao nhất, sang tầng 2</> : <>ŷ của quán i và mọi quán khác, để xếp hạng</>,
    note: `Embedding cuối là trung bình ${nL + 1} lớp. Điểm phù hợp là tích vô hướng${full ? "; 200 quán điểm cao nhất (chưa đến) được chuyển sang tầng 2" : ""}.`,
    body: (
      <div className="space-y-2">
        <Formula>e = (E⁽⁰⁾ + … + E⁽{nL}⁾) / {nL + 1},   ŷ = eᵤ · eᵢ = <b>{fmt(S1.y, 4)}</b></Formula>
        <div className="grid gap-1">
          {S1.layers_user.map((v, k) => <VectorStrip key={`u${k}`} v={v} scale={sc1} label={`E⁽${k}⁾[u]`} />)}
          <VectorStrip v={S1.e_user} scale={sc1} label={<b>eᵤ</b>} className="mb-2" />
          {S1.layers_place.map((v, k) => <VectorStrip key={`p${k}`} v={v} scale={sc1} label={`E⁽${k}⁾[i]`} />)}
          <VectorStrip v={S1.e_place} scale={sc1} label={<b>eᵢ</b>} />
        </div>
        <Histogram counts={S1.hist.counts} edges={S1.hist.edges} mark={S1.y} />
        <p className="text-sm">
          {S1.seen ? "Bạn đã đánh giá quán này nên nó không được gợi ý lại (vẫn tính để minh họa)." : <>Đứng thứ <b>{S1.rank}</b> trong {S1.pool} quán bạn chưa đến{full && <> · {S1.in_top200 ? <b className="text-rating">vào top-{S1.n_cand}, sang tầng 2</b> : <b className="text-destructive">không vào top-{S1.n_cand}</b>}</>}</>}
        </p>
        <CheckLine check={S1.check_y} what="ŷ tính lại" />
      </div>
    ),
  })
  if (!full) {
    steps.push(rankingStep(t, t.ranking!, "stage1", "ŷ", "ŷ tính lại từ các lớp"))
    return steps
  }

  const C = t.criteria!, G = t.lgbm!, R = t.result!
  steps.push({
    key: "criteria", short: "14 tiêu chí", title: "14 tiêu chí của tầng 2",
    flow: <>{C.criteria.length} tiêu chí × 2 dạng</>,
    inputs: [{ from: "stage1", text: <>ŷ = {fmt(S1.y, 3)} và {C.n_cand} ứng viên</> }, { from: "data", text: <>tọa độ, ngày đánh giá, khía cạnh, quận…</> }],
    output: <>28 đặc trưng của quán i (giá trị gốc và z-score)</>,
    note: "Mỗi tiêu chí lấy 2 dạng: giá trị gốc và z-score trong danh sách ứng viên của chính người dùng. Dải chấm là 200 ứng viên, vạch đỏ là quán này.",
    body: (
      <div className="space-y-1.5">
        {!C.real && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Quán không nằm trong {C.n_cand - 1} ứng viên thật; được thêm vào để tính minh họa.</p>}
        {C.criteria.map((c) => (
          <div key={c.key} className="grid grid-cols-[9.5rem_1fr_7.5rem] items-center gap-2 border-b pb-1.5 text-xs last:border-0">
            <div><span className="font-semibold" style={{ color: GROUP_COLOR[c.group] }}>{c.label}</span><div className="font-mono text-[10px] text-muted-foreground">{c.key}</div></div>
            <div><p className="mb-0.5 leading-snug">{criterionText(c)}</p><DistStrip dist={c.dist} value={c.raw} color={GROUP_COLOR[c.group]} /></div>
            <div className="text-right tabular-nums">gốc <b>{fmt(c.raw, 3)}</b><br />z <b>{fmt(c.z, 2)}</b>{c.percentile !== null && <span className="text-muted-foreground"> · hơn {fmt(c.percentile * 100, 0)}%</span>}</div>
          </div>
        ))}
      </div>
    ),
  })
  steps.push({
    key: "lgbm", short: "LightGBM", title: "LightGBM chấm điểm",
    flow: <>s = {fmt(G.score, 3)}</>,
    inputs: [{ from: "criteria", text: <>28 đặc trưng của quán i</> }],
    output: <>Điểm s của quán i, so với s của các ứng viên khác</>,
    note: `Điểm = giá trị nền + đóng góp của từng tiêu chí (gộp dạng gốc và z-score), tách ra từ ${G.n_trees} cây quyết định.`,
    body: (
      <div className="space-y-2">
        <Waterfall base={G.base} items={G.contributions} score={G.score} />
        <div className="flex flex-wrap gap-3 text-xs">{(["static", "dynamic", "extra"] as const).map((g) => <span key={g} className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: GROUP_COLOR[g] }} />{GROUP_LABEL[g]}</span>)}</div>
        <CheckLine check={G.check} what="nền + tổng đóng góp" />
      </div>
    ),
  })
  const reasons = G.contributions.filter((c) => c.total > 0).slice(0, 3)
  steps.push({
    key: "result", short: "Kết quả", title: "Thứ hạng cuối",
    flow: <b className={R.in_topk && R.real ? "text-rating" : undefined}>{R.real ? `#${R.rank}` : "-"}{R.in_topk && R.real ? ` · top-${R.topk}` : ""}</b>,
    inputs: [{ from: "lgbm", text: <>s = {fmt(G.score, 3)} của quán i và s của các ứng viên khác</> }],
    note: "Sắp xếp các ứng viên theo điểm LightGBM. Thứ hạng ở đây trùng với vị trí của quán trong mục “Gợi ý cho bạn”.",
    body: (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border px-4 py-2 text-center"><div className="text-xs text-muted-foreground">Sau tầng 1</div><div className="text-2xl font-bold tabular-nums">{R.stage1_rank ?? "-"}</div></div>
          <ChevronRight className="text-muted-foreground" aria-hidden />
          <div className={cn("rounded-lg border px-4 py-2 text-center", R.in_topk && R.real ? "border-rating bg-rating/10" : "")}><div className="text-xs text-muted-foreground">Sau tầng 2</div><div className="text-2xl font-bold tabular-nums">{R.real ? R.rank : "-"}</div></div>
          <p>{!R.real ? "Quán không vào tầng 2 nên không được gợi ý." : R.in_topk ? <b className="text-rating">Nằm trong top-{R.topk} gợi ý.</b> : `Ngoài top-${R.topk}.`}</p>
        </div>
        {reasons.length > 0 && <div><h4 className="mb-1 font-semibold">Lý do chính</h4><ul className="list-inside list-disc text-sm">{reasons.map((r) => <li key={r.key}>{r.label} (+{fmt(r.total, 3)})</li>)}</ul></div>}
        <div><h4 className="mb-1 font-semibold">Top-{R.topk} của {t.user.name}</h4>
          <ol className="grid grid-cols-1 gap-x-4 text-xs sm:grid-cols-2">{R.top.map((p, k) => <li key={p.id} className={cn("truncate py-0.5", p.id === t.place.id && "font-bold text-brand")}>{k + 1}. {p.name}</li>)}</ol>
        </div>
        <CheckLine check={R.check} what="thứ hạng tính lại so với danh sách gợi ý của engine" />
      </div>
    ),
  })
  return steps
}
