# throughput — qwik/section-geo

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value             |
| --------------------- | ----------------- |
| target                | qwik              |
| page                  | section-geo       |
| durationMs            | 10000             |
| concurrency           | 4                 |
| actualDurationSeconds | 10.005            |
| totalRequests         | 5972              |
| errors                | 0                 |
| reqPerSecond          | 596.9015492253873 |
| latency p50 (ms)      | 7                 |
| latency p95 (ms)      | 8                 |
| latency n             | 5972              |
