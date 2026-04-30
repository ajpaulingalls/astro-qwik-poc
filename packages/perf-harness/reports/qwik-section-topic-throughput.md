# throughput — qwik/section-topic

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value              |
| --------------------- | ------------------ |
| target                | qwik               |
| page                  | section-topic      |
| durationMs            | 10000              |
| concurrency           | 4                  |
| actualDurationSeconds | 10.012             |
| totalRequests         | 2197               |
| errors                | 0                  |
| reqPerSecond          | 219.43667598881342 |
| latency p50 (ms)      | 17                 |
| latency p95 (ms)      | 24                 |
| latency n             | 2197               |
