# Search, Token Optimization, and AI Agent Notes

Tài liệu này gom 4 chủ đề:

1. Linear Search DSA với Java
2. Search trong Artificial Intelligence với Python
3. Kỹ thuật tối ưu token, skill và context theo từng dạng bài toán
4. Trick dùng 9Router để giảm gián đoạn khi dùng AI Agent

---

## 1. Linear Search DSA With Java

### Ý tưởng

Linear Search duyệt từng phần tử từ trái sang phải cho tới khi tìm thấy giá trị cần tìm hoặc duyệt hết mảng.

Phù hợp khi:

- Dữ liệu ít.
- Dữ liệu chưa được sắp xếp.
- Cần thuật toán đơn giản, dễ hiểu.

Độ phức tạp:

- Best case: `O(1)` khi phần tử nằm đầu mảng.
- Worst case: `O(n)` khi phần tử nằm cuối mảng hoặc không tồn tại.
- Space: `O(1)`.

### Java Code Cơ Bản

```java
public class LinearSearch {
    public static int linearSearch(int[] arr, int target) {
        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == target) {
                return i;
            }
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] numbers = {5, 12, 7, 20, 3};
        int target = 20;

        int index = linearSearch(numbers, target);

        if (index != -1) {
            System.out.println("Found at index: " + index);
        } else {
            System.out.println("Not found");
        }
    }
}
```

### Tìm Tất Cả Vị Trí

```java
import java.util.ArrayList;
import java.util.List;

public class LinearSearchAll {
    public static List<Integer> findAllIndexes(int[] arr, int target) {
        List<Integer> indexes = new ArrayList<>();

        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == target) {
                indexes.add(i);
            }
        }

        return indexes;
    }

    public static void main(String[] args) {
        int[] numbers = {4, 2, 7, 2, 9, 2};
        System.out.println(findAllIndexes(numbers, 2));
    }
}
```

### Khi Nào Không Nên Dùng

Nếu dữ liệu đã được sắp xếp và cần search nhiều lần, ưu tiên Binary Search:

- Linear Search: `O(n)`
- Binary Search: `O(log n)`

---

## 2. Search In Artificial Intelligence With Python

Trong AI, "search" thường không chỉ là tìm một giá trị trong mảng. Nó là tìm đường đi hoặc chuỗi hành động từ trạng thái bắt đầu tới trạng thái mục tiêu.

Ví dụ:

- Robot tìm đường trong mê cung.
- Game AI tìm nước đi.
- GPS tìm tuyến đường.
- Puzzle như 8-puzzle, Sudoku, planning.

Một bài toán search thường có:

- `initial_state`: trạng thái ban đầu.
- `actions(state)`: các hành động có thể làm.
- `result(state, action)`: trạng thái mới sau hành động.
- `goal_test(state)`: kiểm tra đã tới đích chưa.
- `cost`: chi phí đường đi, nếu có.

### Breadth-First Search

BFS tìm theo từng lớp, phù hợp khi mọi cạnh có cùng chi phí và cần đường đi ngắn nhất theo số bước.

```python
from collections import deque


def bfs(graph, start, goal):
    queue = deque([(start, [start])])
    visited = set()

    while queue:
        node, path = queue.popleft()

        if node == goal:
            return path

        if node in visited:
            continue

        visited.add(node)

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                queue.append((neighbor, path + [neighbor]))

    return None


graph = {
    "A": ["B", "C"],
    "B": ["D", "E"],
    "C": ["F"],
    "D": [],
    "E": ["F"],
    "F": [],
}

print(bfs(graph, "A", "F"))
```

Kết quả:

```txt
['A', 'C', 'F']
```

### Depth-First Search

DFS đi sâu trước, tiết kiệm bộ nhớ hơn BFS trong một số bài toán, nhưng không đảm bảo đường đi ngắn nhất.

```python
def dfs(graph, start, goal):
    stack = [(start, [start])]
    visited = set()

    while stack:
        node, path = stack.pop()

        if node == goal:
            return path

        if node in visited:
            continue

        visited.add(node)

        for neighbor in reversed(graph.get(node, [])):
            if neighbor not in visited:
                stack.append((neighbor, path + [neighbor]))

    return None
```

### Uniform Cost Search

UCS chọn node có tổng chi phí thấp nhất trước. Dùng khi cạnh có trọng số khác nhau.

```python
import heapq


def uniform_cost_search(graph, start, goal):
    priority_queue = [(0, start, [start])]
    visited_cost = {}

    while priority_queue:
        cost, node, path = heapq.heappop(priority_queue)

        if node == goal:
            return cost, path

        if node in visited_cost and visited_cost[node] <= cost:
            continue

        visited_cost[node] = cost

        for neighbor, edge_cost in graph.get(node, []):
            heapq.heappush(
                priority_queue,
                (cost + edge_cost, neighbor, path + [neighbor]),
            )

    return None


weighted_graph = {
    "A": [("B", 2), ("C", 5)],
    "B": [("D", 4), ("E", 1)],
    "C": [("F", 2)],
    "D": [("F", 1)],
    "E": [("F", 7)],
    "F": [],
}

print(uniform_cost_search(weighted_graph, "A", "F"))
```

### A* Search

A* dùng:

```txt
f(n) = g(n) + h(n)
```

Trong đó:

- `g(n)`: chi phí đã đi từ start tới node hiện tại.
- `h(n)`: ước lượng chi phí từ node hiện tại tới goal.

Nếu heuristic tốt, A* nhanh hơn UCS rất nhiều.

```python
import heapq


def a_star(graph, start, goal, heuristic):
    priority_queue = [(heuristic[start], 0, start, [start])]
    best_cost = {}

    while priority_queue:
        _, cost, node, path = heapq.heappop(priority_queue)

        if node == goal:
            return cost, path

        if node in best_cost and best_cost[node] <= cost:
            continue

        best_cost[node] = cost

        for neighbor, edge_cost in graph.get(node, []):
            new_cost = cost + edge_cost
            estimated_total = new_cost + heuristic[neighbor]
            heapq.heappush(
                priority_queue,
                (estimated_total, new_cost, neighbor, path + [neighbor]),
            )

    return None


heuristic = {
    "A": 6,
    "B": 4,
    "C": 2,
    "D": 1,
    "E": 6,
    "F": 0,
}

print(a_star(weighted_graph, "A", "F", heuristic))
```

### Bảng Chọn Thuật Toán Search

| Bài toán | Thuật toán nên dùng |
| --- | --- |
| Mảng nhỏ, chưa sort | Linear Search |
| Mảng đã sort | Binary Search |
| Đồ thị không trọng số, cần ít bước nhất | BFS |
| Đồ thị lớn, cần duyệt sâu | DFS |
| Đồ thị có trọng số, cần đường rẻ nhất | UCS / Dijkstra |
| Có heuristic tốt | A* |
| Game nhiều nước đi | Minimax / Alpha-Beta |

---

## 3. Tối Ưu Token, Skill Và Context Theo Dạng Bài Toán

### Nguyên Tắc Chung

AI Agent mạnh nhất khi context có cấu trúc. Đừng đưa mọi thứ vào prompt. Hãy đưa đúng thứ cần cho bước hiện tại.

Checklist context gọn:

- Mục tiêu cuối cùng.
- Trạng thái hiện tại.
- Ràng buộc quan trọng.
- File hoặc dữ liệu liên quan.
- Điều không được làm.
- Output mong muốn.

Template ngắn:

```txt
Goal:
- ...

Current state:
- ...

Relevant files/data:
- ...

Constraints:
- ...

Expected output:
- ...
```

### Dạng 1: Debug Lỗi Code

Context nên có:

- Lệnh đã chạy.
- Error log ngắn nhất nhưng đủ stack trace.
- File nghi ngờ.
- Expected behavior và actual behavior.

Prompt mẫu:

```txt
Goal: Fix this bug with the smallest safe change.

Expected behavior:
- ...

Actual behavior:
- ...

Command/error:
- Paste the shortest useful stack trace here.

Relevant files:
- path/to/file
- path/to/test

Constraints:
- Do not refactor unrelated code.
- Keep existing API behavior.
```

Token tip:

- Không gửi toàn bộ log nếu chỉ 30 dòng cuối có lỗi thật.
- Không gửi cả repo; gửi tree ngắn và file liên quan.
- Sau khi AI hiểu lỗi, yêu cầu nó tạo "bug hypothesis" trước khi sửa.

### Dạng 2: Implement Feature

Context nên có:

- User story.
- Acceptance criteria.
- Existing pattern trong repo.
- API/schema nếu có.

Prompt mẫu:

```txt
Implement feature:
- As a user, I can ...

Acceptance criteria:
- ...
- ...

Use existing pattern from:
- ...

Do not change:
- ...

Verify by:
- ...
```

Token tip:

- Đưa 1 đến 3 file mẫu tốt nhất, không đưa 20 file tương tự.
- Nếu feature lớn, chia thành backend contract, UI state, UI rendering, tests.

### Dạng 3: Refactor

Context nên có:

- Vì sao refactor.
- Hành vi phải giữ nguyên.
- Test hoặc command xác nhận.
- Phạm vi được phép thay đổi.

Prompt mẫu:

```txt
Refactor target:
- ...

Reason:
- Reduce duplication in ...

Behavior must stay the same:
- ...

Allowed files:
- ...

Verification:
- ...
```

Token tip:

- Refactor dễ lan rộng. Ghi rõ "allowed files" để agent không đụng quá nhiều.
- Bắt agent mô tả risk trước khi sửa nếu code shared.

### Dạng 4: Học DSA / Algorithm

Context nên có:

- Level hiện tại.
- Ngôn ngữ lập trình.
- Muốn giải thích bằng ví dụ hay chứng minh.
- Muốn bài tập hay code hoàn chỉnh.

Prompt mẫu:

```txt
Teach me [algorithm] in [language].

My level:
- ...

I want:
- Intuition
- Code
- Complexity
- 3 practice problems

Avoid:
- Too much math notation
```

Token tip:

- Đừng hỏi cùng lúc 10 thuật toán. Học từng thuật toán, rồi yêu cầu so sánh.
- Yêu cầu output cố định: intuition, code, dry run, complexity.

### Dạng 5: AI / Machine Learning / Search

Context nên có:

- Bài toán là search, classification, generation, ranking hay planning.
- State/action/cost nếu là search.
- Dataset shape nếu là ML.
- Metric đánh giá.

Prompt mẫu:

```txt
Problem type:
- Search / planning

State:
- ...

Actions:
- ...

Goal:
- ...

Cost:
- ...

Need:
- Pick the algorithm
- Explain tradeoffs
- Provide Python implementation
```

Token tip:

- Với AI search, mô tả state/action quan trọng hơn mô tả chung chung.
- Với ML, gửi schema/sample nhỏ thay vì toàn bộ dataset.

### Dạng 6: Viết Tài Liệu / Course Content

Context nên có:

- Đối tượng học.
- Mục tiêu sau buổi học.
- Format: slide, markdown, script, bài tập.
- Độ dài.

Prompt mẫu:

```txt
Create lesson notes for:
- Topic: ...
- Audience: beginner/intermediate
- Duration: 45 minutes

Include:
- Concept
- Code demo
- Common mistakes
- Practice exercises

Tone:
- Vietnamese, friendly, concise
```

Token tip:

- Cho outline trước, sau đó mở rộng từng phần.
- Lưu lesson template thành skill/context reusable.

### Skill Là Gì Và Dùng Khi Nào

Trong workflow với AI Agent, "skill" có thể hiểu là bộ hướng dẫn tái sử dụng cho một loại việc.

Một skill tốt nên có:

- Khi nào dùng skill.
- Quy trình từng bước.
- Convention của repo/team.
- Output format.
- Những điều không được làm.

Template skill:

```md
# Skill: Backend Bug Fix

Use when:
- The task is about fixing backend runtime or API bugs.

Workflow:
1. Reproduce or inspect the failing path.
2. Read route, schema, CRUD/service, and model.
3. Make the smallest safe fix.
4. Run focused tests or type checks.

Context to request/read:
- Error log
- API route
- Schema/model
- Related test

Output:
- Files changed
- Verification command
- Remaining risk

Do not:
- Rewrite unrelated modules.
- Change public API without explicit reason.
```

### Context Nên Chia Theo Layer

Với project full-stack như LumoHub, context nên chia theo layer:

| Việc cần làm | Context nên đọc/gửi |
| --- | --- |
| Auth bug | route auth, security, session CRUD, frontend auth store |
| Event/reminder | events route, reminder CRUD, scheduler, calendar UI |
| LUMO AI | lumo route, websocket manager, env keys, audio pipeline |
| Device/WebSocket | websocket routes, manager, device CRUD, ESP32 client code |
| Frontend UI | page, component, store, feature API, design pattern hiện có |

---

## 4. Trick Dùng 9Router Để Dùng AI Agent Ít Gián Đoạn

Theo tài liệu hiện tại của 9Router, công cụ này chạy như một gateway/proxy OpenAI-compatible ở local, thường là:

```txt
http://localhost:20128/v1
```

Nó định tuyến request từ tool như Codex, Claude Code, Cursor, Cline hoặc Continue sang nhiều provider/model, có fallback khi quota/rate limit xảy ra.

Nguồn chính:

- https://9router.com/
- https://github.com/decolua/9router
- https://github.com/decolua/9router/blob/master/i18n/README.vi.md

### Cài Đặt Nhanh

```bash
npm install -g 9router
9router
```

Sau khi chạy, dashboard thường mở ở:

```txt
http://localhost:20128
```

API endpoint thường dùng:

```txt
http://localhost:20128/v1
```

### Cấu Hình Provider

Trong dashboard:

1. Mở `Providers`.
2. Kết nối provider bằng OAuth hoặc API key.
3. Tạo combo fallback.
4. Lấy API key của 9Router để cấu hình vào tool AI Agent.

Combo nên có 3 tầng:

```txt
Tier 1: model/subscription chính, chất lượng cao
Tier 2: model rẻ, dùng khi hết quota
Tier 3: model miễn phí hoặc dự phòng
```

Ví dụ tư duy combo:

```txt
coding-main:
1. Model mạnh nhất bạn có quota
2. Model rẻ, đủ tốt cho code
3. Model miễn phí/dự phòng cho tác vụ nhẹ
```

Không nên hardcode tên model từ bài viết này. Hãy lấy model đang available trong dashboard vì tên model/provider có thể đổi.

### Cấu Hình Cho Tool OpenAI-Compatible

Với các tool có lựa chọn `OpenAI Compatible`, thường nhập:

```txt
Base URL: http://localhost:20128/v1
API Key: key lấy từ dashboard 9Router
Model: tên model hoặc combo trong dashboard
```

Với Codex CLI, README 9Router hiện đưa ví dụ:

```bash
export OPENAI_BASE_URL="http://localhost:20128"
export OPENAI_API_KEY="your-9router-api-key"

codex "prompt của bạn"
```

Nếu tool của bạn yêu cầu endpoint có `/v1`, dùng:

```txt
http://localhost:20128/v1
```

Nếu tool tự thêm `/v1`, dùng:

```txt
http://localhost:20128
```

### Trick Để Agent Không Bị Đứt Mạch

1. Tạo ít nhất một combo fallback.

```txt
primary-strong -> cheap-stable -> free-backup
```

2. Tách model theo loại task.

```txt
planning-heavy:
- model suy luận mạnh

code-editing:
- model code tốt, latency ổn

quick-qa:
- model rẻ/nhanh

long-context-summary:
- model context dài hoặc giá rẻ
```

3. Dùng token saver/compression cho output lớn.

Các output như `rg`, tree thư mục, diff dài và log dài rất tốn token. Nếu 9Router có token saver đang bật trong phiên bản bạn dùng, hãy bật cho workflow coding.

4. Ghi lại "handoff summary" sau mỗi bước lớn.

Prompt:

```txt
Summarize the current task state in 10 bullets:
- goal
- decisions
- files changed
- commands run
- remaining work
```

Nếu model fallback đổi giữa chừng, summary này giúp model mới tiếp tục mạch tốt hơn.

5. Đừng để agent đọc lại cả repo nhiều lần.

Thay vào đó:

```txt
Use these files as current context:
- ...

Do not re-scan unrelated folders unless needed.
```

6. Với tác vụ dài, chia session thành checkpoint.

```txt
Checkpoint 1: understand code path
Checkpoint 2: implement focused change
Checkpoint 3: run verification
Checkpoint 4: summarize handoff
```

### Cảnh Báo Quan Trọng

- Không commit API key, OAuth token hoặc file config chứa secret.
- Nếu deploy 9Router lên VPS, bật xác thực và dùng HTTPS/reverse proxy.
- Kiểm tra điều khoản sử dụng của từng provider. Fallback không có nghĩa là bỏ qua quota hoặc policy của provider.
- Với code nhạy cảm, ưu tiên local instance và provider đáng tin cậy.
- Log request/response có thể chứa code hoặc secret; chỉ bật debug log khi cần.

---

## Practice Checklist

### Java Linear Search

- Viết hàm tìm index đầu tiên.
- Viết hàm tìm tất cả index.
- Viết hàm tìm object theo field, ví dụ `Student.id`.
- So sánh với Binary Search.

### Python AI Search

- Implement BFS cho maze 2D.
- Implement DFS và so sánh path với BFS.
- Implement UCS cho graph có trọng số.
- Implement A* với Manhattan distance.

### Token/Context

- Viết 3 prompt template: debug, feature, refactor.
- Tạo 1 skill cho project backend.
- Tạo 1 skill cho project frontend.
- Tạo context summary dưới 200 token cho một issue.

### 9Router

- Cài 9Router.
- Kết nối ít nhất 2 provider.
- Tạo 1 combo fallback.
- Test bằng một tool OpenAI-compatible.
- Ghi lại config không chứa secret trong docs nội bộ.
