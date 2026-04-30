# throughput — qwik/index

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value             |
| --------------------- | ----------------- |
| target                | qwik              |
| page                  | index             |
| durationMs            | 10000             |
| concurrency           | 4                 |
| actualDurationSeconds | 10.026            |
| totalRequests         | 654               |
| errors                | 0                 |
| reqPerSecond          | 65.23040095751047 |
| latency p50 (ms)      | 63                |
| latency p95 (ms)      | 70                |
| latency n             | 654               |
