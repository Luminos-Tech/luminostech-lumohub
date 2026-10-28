# Backend time: UTC+7

API responses, notification WebSockets, reminder text, LUMO prompt time and
the scheduler use Vietnam time (`Asia/Ho_Chi_Minh`, UTC+7). JSON timestamps
include the `+07:00` offset.

Input with an explicit offset (`Z`, `+07:00`, etc.) preserves the instant.
Input without an offset is interpreted as Vietnam local time. For example,
`2026-10-29T08:00:00` and `2026-10-29T01:00:00Z` both return as
`2026-10-29T08:00:00+07:00`.

The button's "today" status covers 00:00 inclusive to the next 00:00 exclusive
in Vietnam, including clicks after 17:00 UTC on the previous calendar date.

Database storage and JWT expiration remain UTC. Existing database columns
without timezone information are interpreted as UTC, consistent with the
frontend's existing `parseUTC` convention. No data migration or blanket
seven-hour shift is performed. PostgreSQL connections explicitly use UTC so
database defaults cannot change when the container timezone changes.

The backend Docker image and Compose configuration set `TZ=Asia/Ho_Chi_Minh`
for process time and logs. Rebuild and restart the backend to apply:

```powershell
docker compose -f docker-compose-vietfuture.yml up -d --build backend
```

Run regression checks from `backend-vietfuture`:

```powershell
.\.venv\Scripts\python.exe -X utf8 -m unittest discover -s tests -v
```
