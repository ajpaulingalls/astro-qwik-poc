# throughput — qwik/liveblog

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value              |
| --------------------- | ------------------ |
| target                | qwik               |
| page                  | liveblog           |
| durationMs            | 10000              |
| concurrency           | 4                  |
| actualDurationSeconds | 10.008             |
| totalRequests         | 4367               |
| errors                | 0                  |
| reqPerSecond          | 436.35091926458836 |
| latency p50 (ms)      | 9                  |
| latency p95 (ms)      | 12                 |
| latency n             | 4367               |
