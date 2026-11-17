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
