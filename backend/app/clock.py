"""Đồng hồ hệ thống: nối tiếp ngày cuối dữ liệu, trôi theo thời gian thật. Chỉ dùng cho phần gợi ý."""
import time


def now_ts(conn) -> int:
    s = dict(conn.execute("select key, value from settings").fetchall())
    return int(float(s["data_end_ts"]) + max(time.time() - float(s["db_created_real"]), 0)) + 1
