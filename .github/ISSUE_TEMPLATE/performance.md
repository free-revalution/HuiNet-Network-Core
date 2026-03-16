---
name: Performance
about: Report performance-related issues or suggest optimizations
title: '[PERF] '
labels: performance
assignees: ''
---

## Performance Issue

Describe the performance problem you've encountered.

## Performance Metrics

**Expected Performance:**
[What performance were you expecting? e.g., 1000 msg/s, <10ms latency]

**Actual Performance:**
[What are you actually seeing? Include measurements if possible]

- **Throughput**: [messages per second]
- **Latency**: [milliseconds or seconds]
- **Memory Usage**: [MB/GB]
- **CPU Usage**: [percentage]

## Environment

- **OS**: [e.g., macOS, Linux, Windows]
- **Node.js version**: [run `node -v`]
- **Hardware**: [CPU, RAM if relevant]
- **Network**: [Local, WAN, specific conditions]

## Reproduction

Describe how to reproduce the performance issue:

```typescript
// Code sample that demonstrates the performance issue
import { HuiNet } from '@huinet/network';

// Your code here
```

## Profiling Data

If you have profiling data, CPU snapshots, or memory dumps, please share them:

```
// Paste profiling data here or attach files
```

## Suggested Optimization

Do you have any ideas on what could be causing the issue or how to fix it?

- [ ] I've profiled the code and identified a bottleneck
- [ ] I have a proposed solution
