# Kế hoạch: trực quan hóa từng bước tính gợi ý

## Mục tiêu

Khi hệ thống gợi ý một quán cho một người dùng, người xem bấm vào để đi qua **từng bước tính toán** của mô hình, từ dữ liệu thô đến thứ hạng cuối. Mục đích là chứng minh với giảng viên rằng mô hình chạy thật, đúng như kiến trúc trong báo cáo.

Nguyên tắc:

1. **Số thật, không minh họa.** Mọi con số lấy từ chính engine đang phục vụ gợi ý.
2. **Mỗi lần bấm là một bước.** Mỗi bước có một công thức, một hình và một bảng số.
3. **Có kiểm chứng.** Bước nào có kết quả thì ghi "tính lại = giá trị engine dùng", kèm sai số.

## Điểm vào: popup

Phần trực quan hóa là **một popup** (hộp thoại lớn), mở bằng nút ở hai nơi. Người dùng là **người đang chọn** trên header, quán là **quán có nút vừa bấm**, nên trong popup không có ô chọn nào.

| Nơi | Nút | Ghi chú |
|---|---|---|
| Thẻ quán trong "Gợi ý cho bạn" (trang chủ) | Biểu tượng nhỏ góc thẻ, chữ "Vì sao gợi ý?" | Bấm nút chỉ mở popup, không mở trang quán (chặn sự kiện click của thẻ) |
| Trang chi tiết quán | Nút "Vì sao gợi ý cho bạn?" cạnh tên quán | Luôn hiện khi đã chọn người dùng, kể cả quán không nằm trong gợi ý. Popup sẽ nói rõ quán dừng ở bước nào |

**Quy tắc hiển thị:**
- **Chưa chọn người dùng:** không hiện nút.
- **Người dùng mới chưa có đánh giá:** nút vẫn hiện; popup hiển thị nhánh mô hình đơn giản (xem "Trường hợp đặc biệt").

Popup là một component dùng chung, `TraceDialog`, nhận `userId` và `placeId`. Về sau, trang admin "Kiểm tra gợi ý" có thể mở cùng popup này từ mỗi dòng mà không phải làm thêm trang.

## Bố cục popup

Popup gần toàn màn hình: rộng tối đa khoảng 1.200 px, cao 90% màn hình. Trên điện thoại, popup chiếm toàn màn hình.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Vì sao gợi ý  Bánh Xèo Bà Dưỡng  cho  Trần Việt Anh    Mô hình [Hai tầng (đề xuất)▾] [✕] │
├──────────────────────┬────────────────────────────────────────────────────────────┤
│ LUỒNG TÍNH           │  Bước 7/12 · Lan truyền lớp 2                               │
│ ① Dữ liệu  18 đ.giá  │  ↳ Đầu vào từ bước 6 · Lớp 1: E⁽¹⁾ của các hàng xóm          │
│      ↓               │  ↳ Đầu vào từ bước 4 · Chuẩn hóa: hệ số Â                    │
│ ② Số hóa  4.462 nút  │  ┌ đồ thị con (chỉ ở các bước dùng đồ thị) ┐                 │
│      ↓               │  └─────────────────────────────────────────┘                 │
│ ④ Chuẩn hóa [đầu vào]│  công thức, bảng số, dải vector                              │
│      ↓               │  ✔ Kiểm chứng: … khớp giá trị engine, sai số …               │
│ ⑥ Lớp 1     [đầu vào]│  Đầu ra → bước 8 · Lớp 3: E⁽²⁾ của mọi nút                   │
│ ⑦ Lớp 2  ◀ đang xem  │                                                            │
│ ⑧ Lớp 3   …          │                                                            │
├──────────────────────┴────────────────────────────────────────────────────────────┤
│ [◀ Trước]   [Bước tiếp ▶]   [▶ Tự chạy]   phím ← →        Giải thích 1–2 câu cho bước │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- **Nút chuyển mô hình** (đầu popup): mặc định mô hình chính hai tầng. Chọn mô hình khác thì popup tải các bước của mô hình đó cho cùng cặp người dùng–quán:
  - nhóm A: Phổ biến, Gần vùng quen, Dựa trên nội dung, User-kNN, Item-kNN, PureSVD;
  - GNN: GCN, Dị thể nhị phân, Dị thể theo điểm, Dị thể động, Hai tầng.
  - Mô hình chưa có tham số (GCN khi thiếu `gcn.npz`) bị làm mờ. Người dùng chưa có đánh giá chỉ xem được Phổ biến và mô hình chính.
- **Cột luồng (trái):** mỗi bước một ô, ghi giá trị bước đó tính ra (số đánh giá, w, Â, dải vector E⁽ˡ⁾, ŷ, s, thứ hạng). Bước đang xem viền đỏ; các bước cấp dữ liệu cho nó viền xanh, ghi "đầu vào"; bước chưa tới để trống. Bấm ô để nhảy tới bước.
- **Vùng phải:** đầu vào (bấm để quay về bước cung cấp), đồ thị con nếu bước dùng đồ thị, công thức, số liệu, dòng kiểm chứng, rồi đầu ra và bước nhận nó.
- **Màn hình hẹp:** cột luồng thành dải ngang cuộn được ở trên, nội dung bước ở dưới.
- **Mở và đóng popup:**
  - Mở luôn bắt đầu từ bước 1, với mô hình đang dùng để gợi ý (chọn ở trang chủ hoặc trang tìm kiếm); đổi mô hình trong popup cũng về bước 1.
  - Dữ liệu mọi bước của một mô hình tải một lần, trong lúc chờ hiện khung xương (skeleton).
  - Đóng bằng Esc, nút ✕ hoặc bấm ra ngoài.
  - Đang mở thì phím ← → dùng để chuyển bước.

### Các bước của từng mô hình

| Mô hình | Các bước | Kiểm chứng |
|---|---|---|
| Phổ biến | Dữ liệu → Đếm số đánh giá → Xếp hạng | số đánh giá đếm lại |
| Gần vùng quen | Dữ liệu → Tâm vùng quen (bản đồ điểm) → Khoảng cách → Xếp hạng | tâm và điểm tính lại |
| Dựa trên nội dung | Dữ liệu → Vector quán (5 khối) → Hồ sơ u → Cosine (đóng góp từng khối) → Xếp hạng | tổng đóng góp các khối |
| User-kNN | Dữ liệu → 50 láng giềng (sim, quán chung) → Láng giềng bỏ phiếu (sim × r) → Xếp hạng | tổng các phiếu |
| Item-kNN | Dữ liệu → Độ giống quán i với từng quán đã đến → Tổng r × sim → Xếp hạng | tổng có trọng số |
| PureSVD | Dữ liệu → Ma trận R → Phân rã (aᵤ, vᵢ) → Tích vô hướng (các chiều đóng góp nhiều) → Xếp hạng | tổng các tích |
| GCN | Dữ liệu → Â và E⁽⁰⁾ → Lớp 1–3 (gom hàng xóm, nhân W, ReLU) → Điểm → Xếp hạng | từng lớp và ŷ |
| Dị thể nhị phân / theo điểm / động | như tầng 1 của mô hình chính, trọng số cạnh theo đúng biến thể → Xếp hạng | Â, từng lớp, ŷ |
| Hai tầng | 12 bước dưới đây | |

Bước Xếp hạng dùng đúng `World.topk` của trang So sánh mô hình, nên top-K trong popup trùng cột của mô hình đó.

### Đồ thị con

- **Vị trí nút:** u ở bên trái, i ở bên phải.
- **Quanh i:** các nút thuộc tính (danh mục, mức giá, tiện ích, quận, đối tượng khách) và vài người dùng khác đã đánh giá i.
- **Quanh u:** các quán u đã đánh giá.
- **Màu:** người dùng xanh dương, quán đỏ, thuộc tính chung xám, thuộc tính đặc thù Đà Nẵng cam. Dùng đúng màu của các sơ đồ trong báo cáo.
- **Hàng xóm:** mỗi quan hệ chỉ vẽ **tối đa 5 hàng xóm đóng góp nhiều nhất**. Số còn lại gộp thành một nút "+ 34 nút khác", để hình không rối nhưng phép cộng vẫn đủ.

### Hiển thị vector 64 chiều

- **Dải màu (heatmap):** một hàng 64 ô, thang màu phân kỳ xanh–trắng–đỏ (âm, 0, dương).
- **Thang màu cố định cho mọi lớp,** để so được độ lớn giữa các lớp.
- **Đặt chồng nhiều dải** khi cần so sánh: đóng góp của từng quan hệ, rồi tổng ⊕ ở dưới cùng.
- **Rê chuột vào một ô:** hiện chỉ số chiều và giá trị.

## 12 bước

### Tầng 1: GNN dị thể

| # | Bước | Vùng trái (đồ thị) | Vùng phải (số liệu) | Kiểm chứng |
|---|---|---|---|---|
| 1 | **Dữ liệu thô** | Chỉ u và i | Bảng thuộc tính quán (danh mục, giá, giao hàng, quận, đối tượng khách, 5 khía cạnh, tọa độ). Lịch sử của u: quán, điểm, ngày | |
| 2 | **Số hóa thành nút** | Nút thuộc tính hiện quanh i, quán đã đến hiện quanh u | Mỗi thuộc tính thành chỉ số nút trong đồ thị 4.462 nút. Ví dụ "Món Quảng → nút #2.712 (IC)". Tọa độ, 5 khía cạnh không thành nút mà để dành cho tầng 2 | Số nút, số cạnh của u và i khớp đồ thị |
| 3 | **Trọng số cạnh động** | Cạnh u–quán dày theo w | Mỗi cạnh: r = điểm/10; Δt = ngày từ đánh giá đó tới đánh giá mới nhất của u; w = r·(0,2 + 0,8·e^(−Δt/180)). Có biểu đồ nhỏ đường e^(−Δt/180) và vị trí của từng cạnh trên đó | w = giá trị trong ma trận kề |
| 4 | **Chuẩn hóa** | Nhãn hệ số trên cạnh | Âᵣ[i,j] = wᵢⱼ / √(dᵢ·dⱼ), với d là tổng trọng số cạnh của mỗi nút. Bảng theo quan hệ | = phần tử ma trận Âᵣ của engine |
| 5 | **E⁽⁰⁾** | Mọi nút có dải màu nhỏ | Dải 64 chiều của u và i: embedding đã học, tham số học được (viền vàng) | = dòng trong `gnn.npz` |
| 6–8 | **Lớp 1, 2, 3** | Hoạt ảnh luồng từ hàng xóm vào i (rồi vào u) | Dưới mỗi quan hệ r: các dải Âᵣ[i,j]·E⁽ˡ⁾[j] của hàng xóm, tổng theo r, nhân αᵣ. Cuối cùng là dải ⊕ = E⁽ˡ⁺¹⁾[i]. Có công tắc chuyển qua xem u | Tổng = E⁽ˡ⁺¹⁾ của engine |
| 9 | **Kết quả tầng 1** | u và i nối bằng một cạnh mang giá trị ŷ | e = (E⁽⁰⁾ + E⁽¹⁾ + E⁽²⁾ + E⁽³⁾)/4 cho u và i (4 dải chồng, dải trung bình ở dưới). ŷ = eᵤ·eᵢ. Thứ hạng của i trong các quán u chưa đến, kèm histogram điểm và vạch của i. Có vào top-200 không | ŷ = điểm `gnn` engine dùng |

### Tầng 2: xếp hạng lại

| # | Bước | Vùng trái | Vùng phải | Kiểm chứng |
|---|---|---|---|---|
| 10 | **14 tiêu chí** | Đồ thị mờ đi. Hiện sơ đồ 14 tiêu chí (hồ sơ u ↔ ứng viên i), đường nối sáng theo nhóm | Mỗi tiêu chí: cách tính bằng số của chính cặp này (ví dụ near = −1,2 km / 2,8 km = −0,43), giá trị gốc, z-score, và dải phân bố của 200 ứng viên kèm vạch vị trí của i | = hàng của i trong ma trận 200 × 28 |
| 11 | **LightGBM** | Biểu tượng các cây | Biểu đồ thác nước: giá trị nền → từng đặc trưng cộng hoặc trừ → điểm s. Gộp gốc và z của cùng tiêu chí, xếp theo độ lớn đóng góp. Kèm số cây đã dùng | Nền + Σ đóng góp = s của engine |
| 12 | **Kết quả** | Danh sách top-20 có i được tô sáng | Thứ hạng sau tầng 1 và sau tầng 2 (mũi tên lên/xuống). Có trong top-20 không. Ba lý do chính, lấy từ 3 đóng góp dương lớn nhất. Ví dụ: "gần vùng quen", "người khác hay đi tiếp từ quán vừa đến", "khớp đối tượng khách" | Thứ hạng = vị trí trong `recommend()` |

### Trường hợp đặc biệt

- **Quán không vào top-200:** bước 9 ghi rõ "không vào tầng 2". Bước 10–11 vẫn tính để minh họa, kèm nhãn "giả định, thực tế quán bị loại ở tầng 1".
- **Quán u đã đánh giá:** thông báo quán bị loại khỏi gợi ý. Vẫn cho xem bước 1–9.
- **Người dùng mới chưa có đánh giá (nhánh đơn giản):** thay bằng 3 bước:
  1. phân vị độ phổ biến;
  2. điểm khớp danh mục, quận, mức giá đã chọn;
  3. tổng điểm và thứ hạng.

  Đầu trang có nhãn "Nhánh: mô hình đơn giản".
- **Quán mới chưa có đánh giá:** bước 5 ghi "E⁽⁰⁾ = 0 (nút mới)". Bước 9 lấy trung bình lớp 1..3.

## Backend

**Hàm mới `Engine.trace(user_id, place_id) -> dict`** trong `app/recsys/trace.py`. Hàm chỉ đọc trạng thái engine, không tính lại cả đồ thị.

| Phần | Cách lấy |
|---|---|
| Đồ thị, Âᵣ, w | `build_graph` đã có; lưu thêm ma trận kề `g` và trọng số cạnh vào `State` khi reload |
| E⁽ˡ⁾ từng lớp | Sửa `propagate()` để trả thêm danh sách 4 lớp, lưu vào `State` (4 × 4.462 × 64 float32, khoảng 4,6 MB) |
| Đóng góp hàng xóm lớp l | Với nút v: Âᵣ[v,j]·E⁽ˡ⁾[j] cho mọi j có cạnh. Sắp theo độ lớn, lấy 5 hàng xóm lớn nhất mỗi quan hệ, phần còn lại cộng gộp |
| 14 tiêu chí | `candidates(..., allow=...)`. Nếu i không có trong 200 ứng viên thì thêm i vào danh sách để tính, đánh dấu `in_top200=false` |
| Đóng góp LightGBM | `booster.predict(X, pred_contrib=True)`, có sẵn trong LightGBM, không cần thư viện mới |
| Kiểm chứng | Mỗi bước trả cặp `{tính_lại, engine, sai_số}` |

API:
- `GET /api/trace?user_id=&place_id=&model=` (trong `api/public.py`, vì popup nằm ở trang người dùng): trả mọi bước của một mô hình trong một lần gọi (khoảng vài chục KB). Đổi bước không cần gọi lại server; đổi mô hình thì gọi lại. `model` mặc định `full`; các mô hình khác do `app/recsys/trace_models.py` tính.
- Kết quả lưu cache theo cặp (người dùng, quán) bằng TanStack Query. Sau khi người dùng viết đánh giá mới, cache bị xóa vì trọng số đã đổi.

## Frontend

| Thành phần | Việc |
|---|---|
| `components/trace/TraceDialog.tsx` | Popup chính: nút chuyển mô hình, cột luồng, ô đầu vào/đầu ra, nút trước/sau, phím ← →, tự chạy (2,5 giây mỗi bước) |
| `components/trace/steps-common.tsx` | Kiểu `Step` (giá trị cột luồng, đầu vào, đầu ra, đồ thị), bước Dữ liệu và bước Xếp hạng dùng chung |
| `components/trace/steps-main.tsx` | Các bước của GNN dị thể: mô hình chính hai tầng và ba biến thể tầng 1 |
| `components/trace/steps-classic.tsx` | Các bước của Phổ biến, Gần vùng quen, Dựa trên nội dung, User-kNN, Item-kNN, PureSVD, GCN |
| `components/trace/viz.tsx` | Đồ thị con, dải vector, bản đồ điểm, biểu đồ thác nước, histogram, dòng kiểm chứng |
| `components/trace/WhyButton.tsx` | Nút "Vì sao gợi ý?" (bản nhỏ cho thẻ quán, bản thường cho trang chi tiết); ẩn khi chưa chọn người dùng |
| Sửa `components/common.tsx` (thẻ quán), `pages/Home.tsx`, `pages/PlaceDetail.tsx` | Thẻ quán nhận thêm tùy chọn hiện nút; mục "Gợi ý cho bạn" bật tùy chọn này; trang chi tiết thêm nút cạnh tên quán |

Không thêm thư viện vẽ: SVG viết tay, giống cách vẽ sơ đồ trong báo cáo.

## Kiểm thử

Thêm `tests/test_trace.py`, chạy trên DB sạch:
- Tổng đóng góp hàng xóm ở mỗi lớp bằng E⁽ˡ⁺¹⁾ của engine (sai số < 1e-5).
- ŷ bằng tích vô hướng eᵤ·eᵢ, và bằng cột `gnn` trong ma trận đặc trưng.
- Nền + Σ đóng góp LightGBM bằng điểm s.
- Thứ hạng ở bước 12 bằng vị trí của quán trong `recommend()`.
- Ba trường hợp đặc biệt trả đúng nhánh.

## Các task

| # | Task | Ước lượng |
|---|---|---|
| 1 | Lưu lớp E⁽ˡ⁾, ma trận kề, trọng số vào `State`; viết `trace.py` cho bước 1–9 | 1 buổi |
| 2 | Bước 10–12 (tiêu chí, `pred_contrib`, thứ hạng), các trường hợp đặc biệt, API, test | 1 buổi |
| 3 | `TraceDialog`, `WhyButton`, Stepper, bố cục popup, bước 1–5 | 1 buổi |
| 4 | SubGraph và VectorStrip, hoạt ảnh lớp 6–8, bước 9 | 1 buổi |
| 5 | Bước 10–12 (FeatureRow, Waterfall), gắn nút vào thẻ gợi ý và trang chi tiết, kiểm tra popup trên điện thoại | 1 buổi |
| 6 | Chạy thử với 3 cặp mẫu, chụp ảnh, cập nhật README và báo cáo | nửa buổi |

## Kịch bản trình bày (khoảng 3 phút)

1. Trang chủ, người dùng có nhiều đánh giá. Ở một thẻ trong "Gợi ý cho bạn", bấm "Vì sao gợi ý?" để mở popup.
2. **Bước 1–4:** quán và người dùng trở thành đồ thị; cạnh có trọng số theo điểm và độ mới.
3. **Bước 6–8:** thông tin từ danh mục, quận và người dùng khác chảy vào quán qua 3 lớp. Chỉ vào dòng kiểm chứng.
4. **Bước 9:** điểm tầng 1, quán đứng thứ mấy, vào top-200.
5. **Bước 10–11:** 14 tiêu chí bằng số thật; thác nước cho thấy tiêu chí nào đẩy quán lên.
6. **Bước 12:** thứ hạng cuối khớp đúng vị trí trên trang chủ.
7. Đổi sang người dùng mới chưa có đánh giá để thấy nhánh mô hình đơn giản.
8. Mở trang chi tiết của một quán **không** nằm trong gợi ý, bấm nút: popup cho thấy quán bị dừng ở bước 9 (không vào top-200) hoặc xếp thấp ở bước 12.
