# Kế hoạch: tìm kiếm cá nhân hóa

## Mục tiêu

Gõ từ khóa, ví dụ "pizza": hệ thống lấy các quán có từ đó **trong tên**, rồi xếp chúng **theo gợi ý cá nhân hóa** của người đang chọn. Hai người cùng gõ "pizza" sẽ thấy cùng các quán nhưng theo thứ tự khác nhau. Cách xếp dùng **cả hai tầng** của mô hình, giống mục "Gợi ý cho bạn".

## Hiện trạng và chỗ cần sửa

| | Hiện tại (`GET /api/places`) | Sửa thành |
|---|---|---|
| Tìm theo | Tên và địa chỉ, không cần gõ dấu | **Giữ nguyên.** Không tìm trong mô tả hay đánh giá |
| Xếp "Phù hợp với bạn" | Chỉ dùng điểm tầng 1 (eᵤ·eᵢ) | Tầng 1 + tầng 2 (14 tiêu chí, LightGBM), cùng đường tính với "Gợi ý cho bạn" |
| Người dùng mới chưa có đánh giá | Không cá nhân hóa, xếp theo điểm quán | Mô hình đơn giản: độ phổ biến + khớp sở thích đã khai báo |
| Sắp xếp mặc định khi có từ khóa | Điểm cao | "Phù hợp với bạn" nếu đã chọn người dùng |

## Cách xếp

```
từ khóa ──► quán có từ khóa trong tên (hoặc địa chỉ) + bộ lọc quận, danh mục, giá, đang mở
                 │
người dùng u ──► Engine.search_scores(u, tập quán)
                 ├─ có vector:  tầng 1 eᵤ·eᵢ → tối đa 200 quán điểm cao nhất → tầng 2 (14 tiêu chí + LightGBM)
                 │              quán ngoài 200 quán đó xếp sau, theo điểm tầng 1
                 ├─ mới, chưa có đánh giá: cold.score (phổ biến + sở thích)
                 └─ chưa chọn người dùng: xếp theo điểm quán như hiện nay
```

- **Tầng 2 dùng lại hàm có sẵn:** `candidates(..., allow=tập quán khớp)`. Tham số `allow` đã có, chỉ cần truyền tập quán khớp vào.
- **Quán người dùng đã đánh giá vẫn hiện** (khác với mục gợi ý), kèm nhãn "Bạn đã đánh giá X" như hiện nay.

## Giao diện (trang Tìm kiếm)

- **Dòng tóm tắt** phía trên kết quả: "12 quán có "pizza" trong tên, xếp theo mức phù hợp với Nguyễn A".
- **Ô tìm kiếm trên header:** gõ rồi Enter sẽ đến trang tìm kiếm, giữ từ khóa trên URL (`?q=pizza`).
- **Thẻ kết quả có nút "Vì sao gợi ý?"**, mở popup trực quan hóa ([truc-quan-hoa.md](truc-quan-hoa.md)).

## Backend

| Việc | Nơi |
|---|---|
| `Engine.search_scores(user_id, ids) -> (score, nhánh)` | `engine.py` |
| `sort=personal` gọi `search_scores` thay cho `personal_scores` | `api/public.py` |

Hiệu năng: tầng 2 cho tối đa 200 quán của một người dùng mất vài chục ms.

## Kiểm thử (`tests/test_search.py`)

- "mi quang" và "Mì Quảng" cho cùng kết quả.
- Hai người dùng khác nhau cùng gõ "pizza": cùng tập quán, khác thứ tự.
- Với người dùng có vector, thứ tự các quán khớp mà nằm trong "Gợi ý cho bạn" giống thứ tự của chúng trong mục gợi ý.
- Người dùng mới chưa có đánh giá: thứ tự theo `cold.score`.
- Không có từ khóa và không chọn người dùng: kết quả giống hệt trước khi sửa.

## Các task

| # | Task | Ước lượng |
|---|---|---|
| S1 | `search_scores`, sửa API, test | nửa buổi |
| S2 | Trang Tìm kiếm: sắp xếp mặc định, dòng tóm tắt, ô tìm trên header, nút "Vì sao gợi ý?" | nửa buổi |

## Kịch bản demo

1. Chọn người dùng A, gõ "pizza".
2. Đổi sang người dùng B: cùng các quán, thứ tự khác.
3. Bấm "Vì sao gợi ý?" trên quán đầu danh sách để xem từng bước.
