import type { ClassicContent, ClassicGcn, ClassicItemKnn, ClassicNear, ClassicPop, ClassicSvd, ClassicUserKnn, TraceAny } from "@/lib/trace-types"
import { Button } from "@/components/ui/button"
import { CheckLine, Formula, GeoScatter, MiniStrip, VectorStrip, fmt, maxAbs } from "./viz"
import { Table, dataStep, rankingStep, type Step } from "./steps-common"

/** Các bước của mô hình so sánh (nhóm A và GCN): dữ liệu → các bước riêng → xếp hạng. */
export function classicSteps(t: TraceAny, side: "place" | "user", setSide: (s: "place" | "user") => void): Step[] {
  const R = t.ranking!
  const check = R.check
  switch (t.model) {
    case "pop": {
      const d = t.classic as ClassicPop
      return [
        dataStep(t, "Mô hình Phổ biến chỉ dùng số đánh giá của quán; không dùng gì về người dùng, nên ai cũng nhận cùng một danh sách."),
        {
          key: "count", short: "Đếm", title: "Đếm số đánh giá của quán",
          flow: <>{d.count} đánh giá</>, inputs: [{ from: "data", text: <>toàn bộ {d.n_reviews.toLocaleString("vi-VN")} đánh giá trong hệ thống</> }],
          output: <>Điểm = số đánh giá của quán i</>,
          note: "Không cá nhân hóa: điểm của quán giống nhau với mọi người dùng.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>điểm(i) = số đánh giá của quán i = <b>{d.count}</b></Formula>
              <div><h4 className="mb-1 font-semibold">Quán nhiều đánh giá nhất</h4>
                <Table head={["Quán", "Số đánh giá"]} rows={d.most.map((m) => [m.name, m.count])} /></div>
              <CheckLine check={check} what="số đánh giá đếm lại" />
            </div>
          ),
        },
        rankingStep(t, R, "count", "Số đánh giá", "điểm đếm lại"),
      ]
    }
    case "near": {
      const d = t.classic as ClassicNear
      return [
        dataStep(t, "Mô hình Gần vùng quen chỉ dùng tọa độ các quán u đã đến và tọa độ quán i."),
        {
          key: "center", short: "Tâm", title: "Tâm vùng quen của u",
          flow: <>{fmt(d.center.lat, 4)}, {fmt(d.center.lon, 4)}</>,
          inputs: [{ from: "data", text: <>tọa độ {d.n_rows} quán trong lịch sử của u</> }],
          output: <>Tâm vùng quen (vĩ độ, kinh độ)</>,
          note: "Tâm vùng quen là trung bình tọa độ các quán u đã đánh giá.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>tâm = trung bình (vĩ độ, kinh độ) của {d.n_rows} quán đã đến = ({fmt(d.center.lat, 5)}, {fmt(d.center.lon, 5)})</Formula>
              <GeoScatter points={d.points} center={d.center} place={d.place} km={d.km} />
              <CheckLine check={d.check_center} what="tâm tính lại" />
            </div>
          ),
        },
        {
          key: "dist", short: "Khoảng cách", title: "Khoảng cách tới quán i",
          flow: <>{fmt(d.km, 2)} km</>,
          inputs: [{ from: "center", text: <>tâm vùng quen</> }, { from: "data", text: <>tọa độ quán i</> }],
          output: <>Điểm = −khoảng cách (gần hơn thì điểm cao hơn)</>,
          note: "Khoảng cách theo đường tròn lớn (haversine). Cộng thêm một lượng rất nhỏ theo điểm quán để phân thứ tự khi hai quán cách bằng nhau.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>điểm(i) = −khoảng cách(tâm, i) + 0,001 × điểm quán/10 = −{fmt(d.km, 4)} + {fmt(d.bonus, 4)} = <b>{fmt(R.score, 4)}</b></Formula>
              <p>Quán i cách tâm vùng quen <b>{fmt(d.km, 2)} km</b>; điểm quán {fmt(d.rating10, 1)}/10.</p>
              <CheckLine check={check} what="điểm tính lại" />
            </div>
          ),
        },
        rankingStep(t, R, "dist", "Điểm", "điểm tính lại"),
      ]
    }
    case "content": {
      const d = t.classic as ClassicContent
      const list = (xs: { label: string; value: number }[]) => (xs.length ? xs.map((x) => `${x.label} (${fmt(x.value, 2)})`).join(" · ") : "-")
      return [
        dataStep(t, "Mô hình Dựa trên nội dung chỉ dùng thuộc tính quán (danh mục, giá, quận, đối tượng khách, khía cạnh) và điểm u đã chấm."),
        {
          key: "item", short: "Vector quán", title: "Vector đặc trưng của quán i",
          flow: <>{d.dim} chiều, 5 khối</>,
          inputs: [{ from: "data", text: <>thuộc tính của quán i</> }],
          output: <>Vector đặc trưng F[i]</>,
          note: "Mỗi khối thuộc tính được chuẩn hóa độ dài riêng rồi ghép lại, để khối nhiều cột (danh mục) không lấn át khối ít cột (mức giá).",
          body: <Table head={["Khối", "Giá trị khác 0 của quán i"]} rows={d.blocks.map((b) => [b.name, list(b.place)])} />,
        },
        {
          key: "profile", short: "Hồ sơ u", title: "Hồ sơ sở thích của u",
          flow: <>từ {d.n_history} quán đã đến</>,
          inputs: [{ from: "data", text: <>các quán u đã chấm và điểm r</> }, { from: "item", text: <>cách tạo vector đặc trưng cho mỗi quán</> }],
          output: <>Vector hồ sơ hᵤ, cùng {d.dim} chiều với F[i]</>,
          note: "Quán u chấm điểm cao đóng góp nhiều hơn vào hồ sơ.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>hᵤ = Σⱼ rⱼ · F[j] / Σⱼ rⱼ   (j = quán u đã chấm)</Formula>
              <Table head={["Quán u đã chấm", "r"]} rows={d.history.map((h) => [h.name, fmt(h.r, 2)])} />
              <Table head={["Khối", "Nổi bật trong hồ sơ của u"]} rows={d.blocks.map((b) => [b.name, list(b.user)])} />
            </div>
          ),
        },
        {
          key: "cosine", short: "Cosine", title: "Độ khớp hồ sơ với quán",
          flow: <>cos = {fmt(R.score, 3)}</>,
          inputs: [{ from: "profile", text: <>hồ sơ hᵤ</> }, { from: "item", text: <>vector F[i]</> }],
          output: <>Điểm = cosine(hᵤ, F[i])</>,
          note: "Cosine gần 1: quán giống gu của u; gần 0: không liên quan.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>điểm(i) = hᵤ · F[i] / ‖hᵤ‖ = Σ đóng góp từng khối = <b>{fmt(R.score, 4)}</b></Formula>
              <Table head={["Khối", "Đóng góp"]} rows={d.blocks.map((b) => [b.name, <b>{fmt(b.contrib, 4)}</b>])} />
              <CheckLine check={check} what="tổng đóng góp các khối" />
            </div>
          ),
        },
        rankingStep(t, R, "cosine", "Cosine", "cosine tính lại"),
      ]
    }
    case "userknn": {
      const d = t.classic as ClassicUserKnn
      return [
        dataStep(t, "User-kNN chỉ dùng ma trận ai đã chấm quán nào, bao nhiêu điểm. Không dùng thuộc tính quán, tọa độ hay thời gian."),
        {
          key: "neighbors", short: "Láng giềng", title: `Tìm ${d.k} người dùng giống u nhất`,
          flow: <>{d.k} láng giềng</>,
          inputs: [{ from: "data", text: <>hàng điểm của u và của {d.n_users.toLocaleString("vi-VN")} người dùng khác</> }],
          output: <>{d.k} láng giềng và độ giống sim(u, v)</>,
          note: "Hai người giống nhau khi cùng chấm điểm cao cho những quán giống nhau (cosine giữa hai hàng điểm).",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>sim(u, v) = cosine(hàng điểm của u, hàng điểm của v)</Formula>
              <Table head={["Láng giềng", "sim", "Quán chung", "Đã chấm quán i"]} rows={d.neighbors.map((n) => [n.name, fmt(n.sim, 3), n.common, n.r === null ? "-" : <b>r = {fmt(n.r, 2)}</b>])} />
            </div>
          ),
        },
        {
          key: "vote", short: "Cộng phiếu", title: "Láng giềng bỏ phiếu cho quán i",
          flow: <>{d.n_contrib} phiếu · {fmt(R.score, 3)}</>,
          inputs: [{ from: "neighbors", text: <>{d.k} láng giềng và sim</> }, { from: "data", text: <>điểm láng giềng chấm quán i</> }],
          output: <>Điểm = tổng sim × điểm của láng giềng đã chấm quán i</>,
          note: "Chỉ láng giềng đã chấm quán i mới góp điểm; láng giềng càng giống u, phiếu càng nặng.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>điểm(i) = Σ_v sim(u, v) · r(v, i) = <b>{fmt(R.score, 4)}</b></Formula>
              {d.n_contrib === 0 ? <p>Không láng giềng nào chấm quán i nên điểm bằng 0.</p> : (
                <Table head={["Láng giềng đã chấm i", "sim", "r", "sim × r"]} rows={[...d.contributors.map((c) => [c.name, fmt(c.sim, 3), fmt(c.r, 2), <b>{fmt(c.prod, 4)}</b>]),
                  ...(d.n_contrib > d.contributors.length ? [[`… ${d.n_contrib - d.contributors.length} láng giềng khác`, "", "", fmt(d.rest, 4)]] : [])]} />
              )}
              <CheckLine check={check} what="tổng các phiếu" />
            </div>
          ),
        },
        rankingStep(t, R, "vote", "Tổng phiếu", "tổng phiếu tính lại"),
      ]
    }
    case "itemknn": {
      const d = t.classic as ClassicItemKnn
      return [
        dataStep(t, "Item-kNN chỉ dùng ma trận ai đã chấm quán nào, bao nhiêu điểm."),
        {
          key: "sim", short: "Độ giống", title: "Quán i giống các quán u đã đến tới đâu",
          flow: <>{d.n_history} cặp quán</>,
          inputs: [{ from: "data", text: <>cột điểm của quán i ({d.n_raters} người chấm) và của các quán u đã đến</> }],
          output: <>sim(j, i) cho từng quán j u đã đến</>,
          note: "Hai quán giống nhau khi được cùng những người chấm điểm cao (cosine giữa hai cột điểm).",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>sim(j, i) = cosine(cột điểm của j, cột điểm của i)</Formula>
              <Table head={["Quán u đã đến (j)", "Người chấm chung với i", "sim(j, i)"]} rows={d.rows.map((r) => [r.name, r.common, fmt(r.sim, 4)])} />
            </div>
          ),
        },
        {
          key: "sum", short: "Tổng", title: "Cộng theo điểm u đã chấm",
          flow: <>{fmt(R.score, 3)}</>,
          inputs: [{ from: "sim", text: <>sim(j, i)</> }, { from: "data", text: <>điểm r u chấm từng quán j</> }],
          output: <>Điểm = Σ r(u, j) · sim(j, i)</>,
          note: "Quán i được điểm cao khi giống những quán u chấm cao.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>điểm(i) = Σⱼ r(u, j) · sim(j, i) = <b>{fmt(R.score, 4)}</b></Formula>
              <Table head={["Quán j", "r(u, j)", "sim(j, i)", "tích"]} rows={[...d.rows.map((r) => [r.name, fmt(r.r, 2), fmt(r.sim, 4), <b>{fmt(r.prod, 4)}</b>]),
                ...(d.n_history > d.rows.length ? [[`… ${d.n_history - d.rows.length} quán khác`, "", "", fmt(d.rest, 4)]] : [])]} />
              <CheckLine check={check} what="tổng có trọng số" />
            </div>
          ),
        },
        rankingStep(t, R, "sum", "Điểm", "tổng tính lại"),
      ]
    }
    case "svd": {
      const d = t.classic as ClassicSvd
      const sc = maxAbs(d.a, d.v)
      return [
        dataStep(t, "PureSVD chỉ dùng ma trận điểm người dùng–quán."),
        {
          key: "matrix", short: "Ma trận R", title: "Ma trận điểm R",
          flow: <>{d.shape[0].toLocaleString("vi-VN")} × {d.shape[1].toLocaleString("vi-VN")}</>,
          inputs: [{ from: "data", text: <>mọi đánh giá, mỗi ô r = điểm / 10</> }],
          output: <>Ma trận R thưa, {d.nnz.toLocaleString("vi-VN")} ô có giá trị</>,
          note: "Ô trống (chưa đánh giá) coi như 0.",
          body: (
            <div className="space-y-2 text-sm">
              <Formula>R[u, j] = điểm u chấm quán j / 10, ô trống = 0</Formula>
              <p>{d.shape[0].toLocaleString("vi-VN")} người dùng × {d.shape[1].toLocaleString("vi-VN")} quán, {d.nnz.toLocaleString("vi-VN")} ô có giá trị (mật độ {fmt(d.density * 100, 3)}%). Hàng của u có {d.n_history} ô.</p>
            </div>
          ),
        },
        {
          key: "factor", short: "Phân rã", title: `Phân rã R ≈ U Σ Vᵀ (${d.k} chiều)`,
          flow: <MiniStrip v={d.a} />,
          inputs: [{ from: "matrix", text: <>ma trận R</> }],
          output: <>Vector aᵤ = (UΣ)[u] và vᵢ = Vᵀ[:, i], {d.k} chiều</>,
          note: `SVD rút gọn giữ ${d.k} thành phần lớn nhất: mỗi người dùng và mỗi quán thành một vector ${d.k} chiều.`,
          body: (
            <div className="space-y-2">
              <Formula>R ≈ U Σ Vᵀ,   aᵤ = U[u] Σ,   vᵢ = Vᵀ[:, i]</Formula>
              <VectorStrip v={d.a} scale={sc} label="aᵤ" sub={t.user.name} />
              <VectorStrip v={d.v} scale={sc} label="vᵢ" sub={t.place.name} />
            </div>
          ),
        },
        {
          key: "dot", short: "Tích", title: "Tích vô hướng",
          flow: <>{fmt(R.score, 4)}</>,
          inputs: [{ from: "factor", text: <>aᵤ và vᵢ</> }],
          output: <>Điểm = aᵤ · vᵢ (giá trị R dự đoán cho ô u, i)</>,
          note: "Điểm là ô (u, i) của ma trận R dựng lại từ các thành phần chính.",
          body: (
            <div className="space-y-3 text-sm">
              <Formula>điểm(i) = Σₖ aᵤ[k] · vᵢ[k] = <b>{fmt(R.score, 5)}</b></Formula>
              <VectorStrip v={d.prod} scale={maxAbs(d.prod)} label="aᵤ[k] · vᵢ[k]" />
              <Table head={["Chiều k", "aᵤ[k]", "vᵢ[k]", "tích"]} rows={d.top.map((x) => [x.dim, fmt(x.a, 4), fmt(x.v, 4), <b>{fmt(x.prod, 5)}</b>])} />
              <CheckLine check={check} what="tổng các tích" />
            </div>
          ),
        },
        rankingStep(t, R, "dot", "Điểm", "tích vô hướng tính lại"),
      ]
    }
    case "gcn": {
      const d = t.classic as ClassicGcn
      const sc0 = maxAbs(d.e0.user, d.e0.place)
      const steps: Step[] = [
        dataStep(t, "GCN chỉ dùng đồ thị người dùng–quán với cạnh nhị phân (đã đến hay chưa); không có nút thuộc tính."),
        {
          key: "e0", short: "E⁽⁰⁾", title: "Đồ thị và embedding ban đầu",
          flow: <MiniStrip v={d.e0.place} />,
          inputs: [{ from: "data", text: <>cạnh u–quán đã đến</> }],
          output: <>Â (có vòng tự thân) và E⁽⁰⁾ của mọi nút</>,
          note: "Đồ thị chỉ có nút người dùng và quán; mỗi nút thêm cạnh nối với chính nó.",
          body: (
            <div className="space-y-2">
              <Formula>Â = D^(−½) (A + I) D^(−½),  A[u, j] = 1 nếu u đã đến j</Formula>
              <VectorStrip v={d.e0.user} scale={sc0} label="E⁽⁰⁾[u]" sub={t.user.name} />
              <VectorStrip v={d.e0.place} scale={sc0} label="E⁽⁰⁾[i]" sub={t.place.name} />
            </div>
          ),
        },
      ]
      for (const L of d.layers) {
        const S = L[side]
        steps.push({
          key: `layer${L.l}`, short: `Lớp ${L.l}`, title: `Lớp GCN ${L.l}`,
          flow: <MiniStrip v={L.place.out} />,
          inputs: [{ from: L.l === 1 ? "e0" : `layer${L.l - 1}`, text: <>E⁽{L.l - 1}⁾ của các hàng xóm</> }],
          output: <>E⁽{L.l}⁾{L.l < d.layers.length ? `, sang lớp ${L.l + 1}` : ", embedding cuối"}</>,
          note: "Khác GNN dị thể: mỗi lớp GCN nhân thêm ma trận W và (trừ lớp cuối) qua ReLU; embedding cuối là lớp cuối cùng, không lấy trung bình.",
          body: (
            <div className="space-y-2">
              <Formula>E⁽{L.l}⁾[{side === "place" ? "i" : "u"}] = {S.relu ? "ReLU( " : ""}(Σⱼ Â[·, j] E⁽{L.l - 1}⁾[j]) Wᵀ + b{S.relu ? " )" : ""}</Formula>
              <div className="flex gap-1" role="tablist">
                {(["place", "user"] as const).map((s) => <Button key={s} size="sm" variant={side === s ? "default" : "outline"} onClick={() => setSide(s)} role="tab" aria-selected={side === s}>{s === "place" ? "Quán i" : "Người dùng u"}</Button>)}
              </div>
              <p className="text-xs text-muted-foreground">{S.n} hàng xóm (kể cả chính nó): {S.neighbors.map((n) => `${n.label} (Â ${fmt(n.a_hat, 3)})`).join(" · ")}</p>
              <VectorStrip v={S.agg} scale={maxAbs(S.agg)} label="Σ Â·E" sub="gom hàng xóm" />
              <VectorStrip v={S.lin} scale={maxAbs(S.lin)} label="· Wᵀ + b" sub="biến đổi tuyến tính" />
              <VectorStrip v={S.out} scale={maxAbs(S.out)} label={<b>E⁽{L.l}⁾</b>} sub={S.relu ? `ReLU: ${S.n_zero} chiều về 0` : "lớp cuối, không ReLU"} />
              <CheckLine check={S.check} what={`E⁽${L.l}⁾ tính lại`} />
            </div>
          ),
        })
      }
      const sc = maxAbs(d.e_user, d.e_place)
      steps.push({
        key: "score", short: "Điểm", title: "Điểm phù hợp",
        flow: <>ŷ = {fmt(d.y, 3)}</>,
        inputs: [{ from: `layer${d.layers.length}`, text: <>E⁽{d.layers.length}⁾[u] và E⁽{d.layers.length}⁾[i]</> }],
        output: <>ŷ của quán i và mọi quán khác</>,
        note: "Điểm là tích vô hướng embedding lớp cuối của u và i.",
        body: (
          <div className="space-y-2">
            <Formula>ŷ = eᵤ · eᵢ = <b>{fmt(d.y, 4)}</b></Formula>
            <VectorStrip v={d.e_user} scale={sc} label="eᵤ" />
            <VectorStrip v={d.e_place} scale={sc} label="eᵢ" />
            <CheckLine check={check} what="ŷ tính lại" />
          </div>
        ),
      })
      steps.push(rankingStep(t, R, "score", "ŷ", "ŷ tính lại"))
      return steps
    }
  }
  return [dataStep(t, "")]
}
