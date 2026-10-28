from collections import OrderedDict, deque
from datetime import datetime, timezone
import re
import time
from uuid import uuid4


class DeviceLogBuffer:
    """Bounded, short-lived technical logs; never written to the database."""

    def __init__(self, clock=time.monotonic, enabled=None):
        self.clock = clock
        self.enabled = enabled or (lambda: True)
        self.stream_id = uuid4().hex
        self.sequence = 0
        self.buffers: OrderedDict[str, deque] = OrderedDict()
        self.rates: dict[str, tuple[int, int]] = {}

    def _available(self):
        if self.enabled():
            return True
        if self.buffers or self.rates:
            self.buffers.clear()
            self.rates.clear()
            self.sequence = 0
            self.stream_id = uuid4().hex
        return False

    def _prune(self):
        cutoff = self.clock() - 900
        for code, entries in list(self.buffers.items()):
            while entries and entries[0][0] < cutoff:
                entries.popleft()
            if not entries:
                self.buffers.pop(code, None)
                self.rates.pop(code, None)

    def expire(self):
        if self._available():
            self._prune()

    def append(self, code: str, level: str, tag: str, message: str, uptime_ms: int | None = None):
        if not self._available():
            return
        if level not in {"I", "W", "E"} or not isinstance(tag, str) or not isinstance(message, str):
            return
        self._prune()
        # Defense in depth even though firmware only sends explicit technical events.
        message = message[:320]
        tag = tag[:32]
        if re.search(r"password|passwd|passphrase|authorization|bearer|api[_ -]?key|secret|token|ssid", message, re.I):
            message = "[sensitive log content hidden]"
        message = re.sub(r"[\x00-\x1f\x7f]", " ", message)
        tag = re.sub(r"[^A-Za-z0-9_.-]", "", tag)
        if not message.strip() or not tag:
            return
        if code not in self.buffers:
            if len(self.buffers) >= 64:
                oldest, _ = self.buffers.popitem(last=False)
                self.rates.pop(oldest, None)
            self.buffers[code] = deque(maxlen=200)
        self.buffers.move_to_end(code)
        self.sequence += 1
        self.buffers[code].append((self.clock(), {
            "sequence": self.sequence,
            "received_at": datetime.now(timezone.utc),
            "level": level, "tag": tag, "message": message, "uptime_ms": uptime_ms,
        }))

    def append_batch(self, code: str, entries):
        if not self._available():
            return
        if not isinstance(entries, list):
            return
        second = int(self.clock())
        window, count = self.rates.get(code, (second, 0))
        if window != second:
            count = 0
        for entry in entries[:8]:
            if count >= 10:
                break
            if not isinstance(entry, dict):
                continue
            uptime = entry.get("uptime_ms")
            if uptime is not None and (type(uptime) is not int or not 0 <= uptime <= 0xFFFFFFFF):
                continue
            level = entry.get("level")
            if not isinstance(level, str):
                continue
            self.append(code, level, entry.get("tag"), entry.get("message"), uptime)
            count += 1
        if code in self.buffers:
            self.rates[code] = (second, count)

    def read(self, code: str, after: int = 0, limit: int = 100):
        if not self._available():
            return {"stream_id": self.stream_id, "entries": [], "cursor": 0}
        self._prune()
        entries = [item for _, item in self.buffers.get(code, ()) if item["sequence"] > after][:limit]
        return {
            "stream_id": self.stream_id,
            "entries": entries,
            "cursor": entries[-1]["sequence"] if entries else max(after, self.sequence),
        }
