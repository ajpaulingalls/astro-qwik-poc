# throughput — astro/index

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value              |
| --------------------- | ------------------ |
| target                | astro              |
| page                  | index              |
| durationMs            | 10000              |
| concurrency           | 4                  |
| actualDurationSeconds | 10.017             |
| totalRequests         | 1606               |
| errors                | 0                  |
| reqPerSecond          | 160.32744334631127 |
| latency p50 (ms)      | 23                 |
| latency p95 (ms)      | 34                 |
| latency n             | 1606               |
