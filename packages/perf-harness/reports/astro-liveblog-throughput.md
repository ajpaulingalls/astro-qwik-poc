# throughput — astro/liveblog

> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.
> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.

| metric                | value              |
| --------------------- | ------------------ |
| target                | astro              |
| page                  | liveblog           |
| durationMs            | 10000              |
| concurrency           | 4                  |
| actualDurationSeconds | 10.011             |
| totalRequests         | 4618               |
| errors                | 0                  |
| reqPerSecond          | 461.29257816401963 |
| latency p50 (ms)      | 9                  |
| latency p95 (ms)      | 11                 |
| latency n             | 4618               |
