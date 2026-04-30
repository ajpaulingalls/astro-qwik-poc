# throughput — qwik/article

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value              |
| --------------------- | ------------------ |
| target                | qwik               |
| page                  | article            |
| durationMs            | 10000              |
| concurrency           | 4                  |
| actualDurationSeconds | 10.026             |
| totalRequests         | 1633               |
| errors                | 0                  |
| reqPerSecond          | 162.87652104528226 |
| latency p50 (ms)      | 26                 |
| latency p95 (ms)      | 33                 |
| latency n             | 1633               |
