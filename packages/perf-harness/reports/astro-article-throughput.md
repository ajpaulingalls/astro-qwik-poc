# throughput — astro/article

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value              |
| --------------------- | ------------------ |
| target                | astro              |
| page                  | article            |
| durationMs            | 10000              |
| concurrency           | 4                  |
| actualDurationSeconds | 10.01              |
| totalRequests         | 2486               |
| errors                | 0                  |
| reqPerSecond          | 248.35164835164835 |
| latency p50 (ms)      | 15                 |
| latency p95 (ms)      | 22                 |
| latency n             | 2486               |
