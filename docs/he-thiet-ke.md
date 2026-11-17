# Hệ thiết kế FoodGo

Nguồn: skill `ui-ux-pro-max` (`--design-system "restaurant food discovery directory listing"`), điều chỉnh theo yêu cầu phong cách Foody.

**Giữ từ gợi ý của skill**
- Mẫu bố cục "danh bạ / chợ": ô tìm kiếm là hành động chính, có danh mục và lưới quán.
- Phong cách phẳng: không gradient, bóng đổ rất nhẹ chỉ khi rê chuột, chuyển trạng thái 150–200 ms.
- Biểu tượng SVG Lucide, không dùng emoji.

**Không dùng từ gợi ý của skill**
- Bảng màu xanh lá: trái yêu cầu màu nhấn đỏ kiểu Foody.
- Phông Karla và Playfair: không có bộ ký tự tiếng Việt.

## Màu (token trong `frontend/src/index.css`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--brand` / `--primary` | `#d0021b` | Logo, nút chính, liên kết đang chọn, điểm nhấn |
| `--brand-soft` | `#fdecee` | Nền chip đang chọn, nhãn "Mới" |
| `--background` | `#ffffff` | Nền trang |
| `--surface` | `#f4f4f5` | Nền khối phụ, khung ảnh khi chưa tải |
| `--foreground` | `#1f1f22` | Chữ chính |
| `--muted-foreground` | `#5f5f66` | Chữ phụ: địa chỉ, ngày; tương phản 6,4:1 trên nền trắng |
| `--border` | `#e4e4e7` | Viền thẻ, đường kẻ bảng |
| `--rating` / `--rating-mid` / `--rating-low` | `#1a8a3a` / `#c27803` / `#b42318` | Ô điểm: ≥ 7,5 / 5–7,5 / < 5 |

Chỉ có giao diện sáng.

## Chữ

- Phông: **Be Vietnam Pro** (400, 500, 600, 700), cài qua `@fontsource`, không phụ thuộc mạng.
- Cỡ chữ: 12 (nhãn nhỏ), 14 (chữ phụ, bảng), 16 (chữ thường), 18 (tên quán ở trang chi tiết), 20–24 (tiêu đề mục), 28–32 (tiêu đề trang).
- Tiêu đề mục: 600, chữ thường (không viết hoa toàn bộ).

## Hình khối

- Bo góc: 8 px (thẻ, ô nhập, nút), 6 px (chip, nhãn), tròn (ảnh đại diện).
- Khoảng cách lưới 16 px; lề trang 16 px trên điện thoại, nội dung tối đa 1200 px.
- Điểm ngắt: 375, 768, 1024, 1280 px. Lưới thẻ quán: 2 cột (điện thoại), 3 (768), 4 (1024), 5 (1280).

## Thẻ quán

- Ảnh tỉ lệ 4:3 phía trên, ô điểm thang 10 đè ở góc trên phải (màu theo ngưỡng).
- Tên quán tối đa 2 dòng, đậm 600; địa chỉ 1 dòng, chữ phụ; 1–2 danh mục dạng chip nhỏ; số đánh giá.
- Nhãn trên ảnh: "Mới" (nền `--brand-soft`), "Bạn đã đánh giá 8,5" (nền tối mờ, chữ trắng).
- Toàn bộ thẻ là một liên kết; viền đậm hơn và ảnh phóng nhẹ khi rê chuột.
- Ảnh lỗi thì hiện khối `--surface` kèm biểu tượng.

## Admin

- Thanh bên trái cố định (thu gọn thành thanh trên ở điện thoại), nội dung bên phải.
- Bảng: chữ 14 px, dòng 44 px, số căn phải dùng `tabular-nums`, tiêu đề cột dính khi cuộn.
- Ô số liệu tổng quan: số lớn 28 px, nhãn 14 px phía trên.

## Kiểm tra trước khi giao

Tương phản chữ ≥ 4,5:1; vòng focus nhìn thấy được; vùng bấm ≥ 44 px trên điện thoại; `cursor-pointer` cho phần tử bấm được; tôn trọng `prefers-reduced-motion`; không cuộn ngang ở 375 px.
