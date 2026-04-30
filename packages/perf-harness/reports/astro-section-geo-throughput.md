# throughput — astro/section-geo

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value             |
| --------------------- | ----------------- |
| target                | astro             |
| page                  | section-geo       |
| durationMs            | 10000             |
| concurrency           | 4                 |
| actualDurationSeconds | 10.005            |
| totalRequests         | 4875              |
| errors                | 0                 |
| reqPerSecond          | 487.2563718140929 |
| latency p50 (ms)      | 8                 |
| latency p95 (ms)      | 11                |
| latency n             | 4875              |
