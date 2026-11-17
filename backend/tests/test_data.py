from app import clock


def test_counts(conn):
    assert conn.execute("select count(*) from users").fetchone()[0] == 2696
    assert conn.execute("select count(*) from places").fetchone()[0] == 1698
    assert conn.execute("select count(*) from reviews").fetchone()[0] == 46548


def test_ids_are_model_indices(conn):
    assert [r[0] for r in conn.execute("select id from places order by id limit 3")] == [0, 1, 2]


def test_review_text_joined(conn):
    assert conn.execute("select count(*) from reviews where text is not null and text != ''").fetchone()[0] > 30000


def test_clock_starts_after_data(conn):
    end = int(conn.execute("select value from settings where key='data_end_ts'").fetchone()[0])
    assert end == conn.execute("select max(ts) from reviews").fetchone()[0]
    assert clock.now_ts(conn) >= end
