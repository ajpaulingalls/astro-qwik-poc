# throughput — astro/section-topic

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value            |
| --------------------- | ---------------- |
| target                | astro            |
| page                  | section-topic    |
| durationMs            | 10000            |
| concurrency           | 4                |
| actualDurationSeconds | 10.011           |
| totalRequests         | 2789             |
| errors                | 0                |
| reqPerSecond          | 278.593547098192 |
| latency p50 (ms)      | 14               |
| latency p95 (ms)      | 19               |
| latency n             | 2789             |
