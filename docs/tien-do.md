# Tiến độ FoodGo

Cách thực hiện: Native (làm lần lượt 12 task trong `ke-hoach.md`). Cập nhật file này sau mỗi task.

## Bổ sung đã thống nhất sau khi viết kế hoạch

- "Gợi ý cho bạn" vẫn bỏ quán đã đánh giá.
- Thêm mục **"Ghé lại quán quen"** trên trang chủ: quán người dùng đã chấm từ 7 điểm trở lên, xếp theo điểm và độ gần đây, lấy thẳng từ lịch sử (không qua mô hình). `GET /api/home` trả thêm `revisit: PlaceCard[]` (Task 6, 9).
- Thẻ quán ở tìm kiếm và "Quán tương tự" có nhãn "Bạn đã đánh giá X" khi người dùng đang chọn đã đánh giá quán đó: `PlaceCard` thêm `my_rating: number | null` (Task 6, 8).

## Trạng thái task

| Task | Trạng thái | Ghi chú |
|---|---|---|
| 1 Khung backend và dữ liệu | xong | DB 2.696/1.698/46.548; 100% đánh giá nối được nội dung |
| 2 Đồ thị và lan truyền GNN | xong | vector khớp notebook < 1e-4 |
| 3 Tiêu chí tầng 2 | xong | NDCG@20 0,1277, Recall@20 0,2363: khớp notebook |
| 4 Engine | xong | reload 0,23 s |
| 5 Khởi đầu lạnh | xong |  |
| 6 API người dùng | xong |  |
| 7 API admin | xong |  |
| 8 Khung frontend | xong | build sạch; chọn/tạo người dùng chạy trên Chrome |
| 9 Trang chủ, tìm kiếm | xong | kiểm tra 1280 px và 390 px |
| 10 Chi tiết quán, đánh giá, hồ sơ | xong | viết đánh giá -> quán rời khỏi gợi ý |
| 11 Admin UI | xong | thêm quán qua form -> mục Quán mới, quán lạnh +1 |
| 12 Rà soát, chạy thử, README | xong | 32/32 test; check_notebook khớp; DB sạch |

## Việc sau khi xong 12 task: báo cáo .docx

Tạo file báo cáo Word ở thư mục gốc dự án (`D:\Study_space\Ki9\DSS\CuoiKi\`), bìa và định dạng tham khảo `BaoCao_fomat_tham_khao.docx` (báo cáo môn khác). Nội dung:

1. Kiến trúc mô hình, baseline (GCN), các cải tiến, các đề xuất; tự vẽ sơ đồ minh họa khi cần.
2. Quá trình crawl Foody, tiền xử lý dữ liệu, các thay đổi khi chuyển sang dữ liệu local Đà Nẵng.
3. Kết quả huấn luyện trên tập nghiên cứu (Yelp Philadelphia) và dữ liệu local (Foody Đà Nẵng); nhận xét, giải thích kết quả.
4. Trình bày phần demo FoodGo (kèm ảnh chụp màn hình).
5. Kết luận và hướng phát triển.

Nguồn số liệu: `notebooks/yelp_eda_huan_luyen.ipynb`, `notebooks/foody_huan_luyen.ipynb`, `notebooks/foody_tien_xu_ly.ipynb`, `notebooks/crawl_foody.ipynb`, `khao-sat-foody.md`, hình trong `notebooks/ket_qua_chay/`. Dùng skill `anthropic-skills:docx`.

## Ruling

- Task 1: `places.stars` giữ thang 5 như dữ liệu đã xử lý (= điểm Foody / 2); `upsert_review` cộng `rating / 2`; API trả `stars` thang 10. Sai thì chỉ lệch hiển thị.
- Task 2: thêm `app/recsys/loader.py` (đọc DB, chạy tầng 1) để Engine, script kiểm tra và test dùng chung, thay cho hàm trợ giúp trong `check_notebook.py`.
- Task 2: IF chỉ có cột giao hàng; cột đặt bàn luôn rỗng (dữ liệu 0%), giống notebook.
- Task 4–5: viết chung một lượt vì cùng file `engine.py`; test riêng `test_engine.py`, `test_cold.py`.
- Task 6: giờ mở cửa: toàn bộ 1.802 khung giờ có DayOfWeek = 2 nên coi là áp dụng mỗi ngày.
- Task 6–7: gộp route vào `api/public.py`, `api/admin.py`, `api/deps.py` thay cho 5 file; `schemas.py` chứa cả hàm chuyển dòng DB sang JSON.
- Task 6: `GET /api/places/{id}` nhận thêm `user_id` để trả `my_rating`.
- Task 8: shadcn bản hiện hành dùng style `base-nova` (Base UI). Ô chọn dùng `<select>` gốc (`NativeSelect`) thay cho Select của shadcn, để đơn giản và chắc chắn truy cập được bằng bàn phím.
- Task 8: skill `ui-ux-pro-max` gợi ý màu xanh lá và phông Karla; không dùng vì trái yêu cầu màu đỏ và Karla thiếu chữ tiếng Việt. Dùng Be Vietnam Pro (xem `docs/he-thiet-ke.md`).
- Task 10: bản đồ dùng `CircleMarker` thay cho marker ảnh để khỏi phụ thuộc file icon của Leaflet.
- Task 12: rà soát bằng `design-taste-frontend`: phần lớn quy tắc dành cho landing page; áp dụng mục hợp với giao diện sản phẩm. Đã đổi mọi en-dash/em-dash thành gạch nối. Giữ Lucide (dự án đã dùng, `ui-ux-pro-max` khuyên dùng) và chỉ giao diện sáng (phong cách Foody, ghi trong thiết kế).
- Final review: self-review (quy định phiên không cho tự tạo subagent khi người dùng chưa yêu cầu). Đối chiếu 5 mục Review Focus: cả 5 có test hoặc đã kiểm tra trên trình duyệt.

- Báo cáo/demo: dữ liệu Foody chỉ có 4 đánh giá trong 180 ngày cuối (586 trong 365 ngày). Mô hình đơn giản cho người dùng mới dùng cửa sổ "phổ biến gần đây" 365 ngày (`COLD_RECENT_DAYS`); tầng 2 giữ 180 ngày như notebook nên `pop_recent` của đánh giá mới gần bằng 0. Sai thì chỉ ảnh hưởng thứ tự gợi ý cho người dùng mới chưa có đánh giá.
- Task 5 (sau): độ phổ biến của mô hình đơn giản dùng phân vị [0, 1] thay cho z-score, vì với cửa sổ 365 ngày z-score đuôi dài lấn át điểm sở thích (chọn Café chỉ ra 2/20 quán café).

## Báo cáo .docx: xong

`bao_cao/BaoCao_CuoiKi_GNN_FoodGo.docx` (44 trang, 26 hình, 20 bảng) và bản PDF. Dựng từ file mẫu `BaoCao_fomat_tham_khao.docx` (giữ bìa, style, header/footer); mã dựng lại trong `bao_cao/nguon/` (`content.py` là nội dung).
Còn để trống cho người dùng điền: tên CBHD trên bìa, cột "Người thực hiện" trong bảng phân công.

## Đợt 2: tìm kiếm cá nhân hóa, "Vì sao gợi ý?", so sánh mô hình: xong

Kế hoạch: [tim-kiem-ca-nhan-hoa.md](tim-kiem-ca-nhan-hoa.md), [truc-quan-hoa.md](truc-quan-hoa.md), [so-sanh-mo-hinh.md](so-sanh-mo-hinh.md).

| Phần | Trạng thái | Kiểm chứng |
|---|---|---|
| Tìm kiếm cá nhân hóa (`Engine.search_order`) | xong | `test_search.py` 5 test |
| Popup "Vì sao gợi ý?" (`recsys/trace.py`, `GET /api/trace`, `components/trace/`) | xong | `test_trace.py` 4 test; mọi bước kiểm chứng sai số < 1e-4; thứ hạng bước 12 = vị trí trong `recommend()` |
| So sánh mô hình (`recsys/zoo.py`, `recsys/compare.py`, `/api/admin/compare*`, `admin/Compare.tsx`) | xong, trừ GCN | `test_compare.py` 5 test; NDCG@20 tính lại của dị thể nhị phân / theo điểm / động / hai tầng = 0,0955 / 0,1066 / 0,0976 / 0,1277, khớp `results.csv` |
| GCN trong trang so sánh | chờ chạy Kaggle | Ô cuối `notebooks/foody_huan_luyen.ipynb` đã lưu thêm `gcn.pt`. Sau khi chạy: copy vào `notebooks/ket_qua_chay/`, chạy `scripts/export_model.py` |

Ruling đợt 2:
- Tìm kiếm chỉ theo tên và địa chỉ (người dùng chốt bỏ phần tìm trong mô tả và đánh giá). Tầng 2 chạy trên tối đa 200 quán khớp có điểm tầng 1 cao nhất; z-score tính trong tập khớp nên thứ tự có thể khác chút so với "Gợi ý cho bạn" khi cùng quán. Quán đã đánh giá vẫn hiện trong tìm kiếm.
- Popup mở từ thẻ trong "Gợi ý cho bạn", kết quả tìm kiếm và trang chi tiết quán (người dùng chốt dạng popup, không làm trang admin riêng). Quán không có trong 200 ứng viên được thêm vào cuối danh sách để tính 14 tiêu chí, có nhãn "minh họa".
- Bước lan truyền: mỗi dải vector dùng thang màu riêng, ghi độ lớn bên cạnh (quan hệ UI lớn hơn hẳn các quan hệ khác).
- Mô hình cổ điển học từ train + valid ở chế độ quá khứ (nhiều dữ liệu hơn GNN). Kết quả đáng chú ý: User-kNN (NDCG@20 0,0856) cao hơn GCN của notebook (0,0734), thấp hơn hai tầng (0,1277).
- `tests/test_data.py::test_clock_starts_after_data` cần DB sạch: DB hiện có 1 đánh giá thử nghiệm nên test này báo lỗi. Đã kiểm tra trên DB sạch tạo trong thư mục tạm: điều kiện đúng.
- Bản đồ khóa trong địa bàn Đà Nẵng (`maxBounds`, `minZoom` 11), không hiển thị được khu vực Hoàng Sa, Trường Sa.

## Trực quan hóa: luồng tính và mọi mô hình

- Người dùng thấy popup cũ không thể hiện luồng tính toán; chọn phương án cột luồng bên trái (người dùng chốt), và yêu cầu trực quan hóa cả các mô hình khác qua nút chuyển mô hình ở đầu popup.
- Backend: `recsys/trace_models.py` (các bước của 10 mô hình so sánh, điểm tính lại khớp điểm mô hình dùng); `Tracer` nhận `GnnView` để dùng cho cả ba biến thể GNN dị thể; `GET /api/trace` thêm tham số `model`.
- Frontend: `components/trace/` tách thành `steps-common.tsx`, `steps-main.tsx`, `steps-classic.tsx`; `TraceDialog.tsx` có cột luồng, ô đầu vào/đầu ra, nút chuyển mô hình.
- Chọn mô hình gợi ý cho cả trang (người dùng yêu cầu: danh sách gợi ý phải đổi theo mô hình): `GET /api/recommendations?model=`, `GET /api/places?sort=personal&model=`, `GET /api/models?user_id=`; mô hình khác `full` lấy đúng `World.topk` của trang so sánh. Frontend: `ModelPicker` ở trang chủ và trang tìm kiếm, lưu trong `localStorage`; popup mở với mô hình đang chọn.
- Kiểm thử: `tests/test_trace_models.py` (14 test). GCN được kiểm bằng tham số giả vì chưa có `gcn.npz`. Toàn bộ: 59/60 qua; test còn lại là `test_clock_starts_after_data` cần DB sạch (đã ghi ở trên).

## So sánh với paper LightGCN trên bộ chuẩn Yelp2018

- Notebook mới `notebooks/yelp2018_benchmark.ipynb`. Notebook Yelp Philadelphia giữ nguyên (người dùng chốt thêm notebook mới, không thay).
- **Phạm vi so sánh:** mô hình của đề tài cải tiến từ LightGCN, nên so với LightGCN và các phương pháp trong paper LightGCN (NGCF, Mult-VAE), lấy nguyên số ở bảng 3 và bảng 4 của paper (đã đối chiếu với PDF), không chạy lại (người dùng chốt).
- **Dữ liệu:** train.txt, test.txt, user_list.txt, item_list.txt của repo LightGCN (`kuandeng/LightGCN/Data/yelp2018`), nối với Yelp gốc qua `org_id` để lấy ngày, điểm, thuộc tính quán, bạn bè. Notebook tự chọn phiên bản Yelp nối được nhiều quán nhất; bản dùng trên Kaggle nối được 100% quán và tương tác.
- **Giao thức như paper LightGCN:**
  - GNN học trên toàn bộ `train.txt`;
  - chọn epoch theo `test.txt`: đánh giá mỗi 10 epoch, dừng sau 50 epoch không tăng;
  - 64 chiều, 3 lớp, lr 1e-3, L2 1e-4.
- **Chống quá khớp theo cấu hình của mô hình** như notebook Yelp chính: DropEdge 0,1, batch 4096. Với batch 1024, không DropEdge, Recall@20 đạt đỉnh ở epoch 20 rồi giảm (0,0625 / 0,0515).
- **Tầng 2** học nhãn từ 10% tách trong train: một GNN phụ học trên 90% train sinh ứng viên và nhãn. LightGBM không thấy test.
- **Chạy trên Kaggle (GPU T4 x2):** GNN chính và GNN phụ học song song, mỗi mô hình một GPU; khoảng 27 giây mỗi epoch, ba GNN học xong trong khoảng 1 giờ.
- **Kết quả (Recall@20 / NDCG@20):**

| Phương pháp | Recall@20 | NDCG@20 |
|---|---|---|
| NGCF (paper) | 0,0579 | 0,0477 |
| Mult-VAE (paper) | 0,0584 | 0,0450 |
| LightGCN 3 lớp (paper) | 0,0639 | 0,0525 |
| LightGCN 4 lớp (paper) | 0,0649 | 0,0530 |
| GNN dị thể (nhị phân) | 0,0649 | 0,0539 |
| GNN dị thể (động) | 0,0648 | 0,0536 |
| **GNN dị thể (động) + xếp hạng lại** | **0,0670** | **0,0559** |

- **Nhận xét:** tầng 1 tương đương LightGCN (+1,4% / +2,1% so với 3 lớp, một seed). Mô hình đầy đủ vượt LightGCN 3 lớp 4,9% / 6,5%. Bản động bằng bản nhị phân: chia ngẫu nhiên nên trọng số thời gian không thêm thông tin (khác Philadelphia, chia theo thời gian). Tầng 2 tăng 3,4% / 4,3%; 26,7% quán đúng nằm trong 200 ứng viên. Quan hệ bạn bè gần như không được dùng (α khoảng 0,03–0,04).
- **Hạn chế:** chọn epoch theo test như paper; một seed; LightGCN không chạy lại bằng cùng code.
