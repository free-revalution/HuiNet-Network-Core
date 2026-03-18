# HuiNet Agent 管理平台 - 故障排除指南

本指南提供常见问题的解决方案和调试技巧。

## 目录

- [常见问题](#常见问题)
- [守护进程问题](#守护进程问题)
- [Agent 启动问题](#agent-启动问题)
- [P2P 连接问题](#p2p-连接问题)
- [性能问题](#性能问题)
- [调试技巧](#调试技巧)

---

## 常见问题

### Q: 守护进程无法启动

**症状：** 运行 `huinet daemon start` 后立即退出

**可能原因和解决方案：**

1. **端口被占用**
   ```bash
   # 检查端口占用
   lsof -i :8000  # P2P 端口
   lsof -i :3000  # API 端口

   # 使用其他端口
   huinet daemon start --port 9000 --api-port 4000
   ```

2. **权限不足**
   ```bash
   # 确保 Node.js 有权限绑定端口
   sudo huinet daemon start
   ```

3. **配置文件错误**
   ```bash
   # 验证配置文件
   cat ~/.huinet/daemon.json | jq .

   # 重置配置
   rm ~/.huinet/daemon.json
   huinet daemon start
   ```

### Q: Agent 无法注册

**症状：** `huinet launch` 显示 "Failed to register agent"

**解决方案：**

```bash
# 1. 确认守护进程运行中
huinet daemon status

# 2. 检查 API 连接
curl http://127.0.0.1:3000/api/status

# 3. 查看守护进程日志
huinet daemon logs

# 4. 手动测试注册
curl -X POST http://127.0.0.1:3000/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"agentType":"test","agentName":"Test","pid":12345}'
```

### Q: 其他机器无法被发现

**症状：** `huinet topology` 只显示本地机器

**解决方案：**

```bash
# 1. 检查 mDNS 是否启用
huinet daemon start  # 默认启用 mDNS

# 2. 检查防火墙设置
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/huinet

# Linux
sudo ufw allow 8000/tcp
sudo ufw allow from 192.168.0.0/16

# 3. 检查网络连接
ping <其他机器的IP>
nc -zv <其他机器的IP> 8000

# 4. 使用静态引导节点
huinet daemon start --bootstrap <IP>:8000
```

---

## 守护进程问题

### 守护进程崩溃

**诊断步骤：**

```bash
# 1. 查看详细日志
export HUINET_LOG_LEVEL=debug
huinet daemon start

# 2. 检查系统日志
macOS: log show --predicate 'process == "huinet"'
Linux: journalctl -u huinet -n 50

# 3. 检查核心转储
# 启用核心转储
ulimit -c unlimited

# 运行守护进程
huinet daemon start

# 如果崩溃，分析转储
gdb $(which huinet) core
```

### 守护进程内存泄漏

**症状：** 内存使用持续增长

**解决方案：**

```bash
# 1. 监控内存使用
watch -n 5 'ps aux | grep huinet'

# 2. 生成内存快照
kill -USR1 $(pgrep huinet)

# 3. 重启守护进程
huinet daemon restart
```

### 守护进程无法停止

**解决方案：**

```bash
# 1. 强制停止
huinet daemon stop --force

# 2. 手动终止进程
kill -9 $(pgrep -f "huinet daemon")

# 3. 清理 PID 文件
rm -f ~/.huinet/daemon.pid
```

---

## Agent 启动问题

### Agent 启动失败

**诊断步骤：**

```bash
# 1. 测试 Agent 命令
claude --version
cursor --version

# 2. 检查启动器输出
huinet launch claude-code --verbose

# 3. 验证环境变量
env | grep HUINET

# 4. 测试代理端口
curl http://127.0.0.1:<proxy-port>/test
```

### Agent 无响应

**解决方案：**

```bash
# 1. 检查 Agent 进程
ps aux | grep claude

# 2. 查看 Agent 日志
# Claude Code 日志位置
~/.claude/logs/

# Cursor 日志位置
~/Library/Application Support/Cursor/logs/

# 3. 重启 Agent
huinet restart <agent-id>
```

### Agent 代理问题

**症状：** Agent 无法通过代理访问网络

**解决方案：**

```bash
# 1. 测试代理连接
curl -x http://127.0.0.1:<proxy-port> https://api.anthropic.com

# 2. 检查代理配置
huinet agent <agent-id> --show-proxy

# 3. 禁用代理
HTTP_PROXY= HTTPS_PROXY= huinet launch claude-code
```

---

## P2P 连接问题

### 机器无法连接

**诊断步骤：**

```bash
# 1. 检查网络可达性
ping <remote-machine>
traceroute <remote-machine>

# 2. 测试 P2P 端口
nc -zv <remote-machine> 8000

# 3. 检查 TLS/SSL 证书
# 如使用 TLS，验证证书
openssl s_client -connect <remote-machine>:8000

# 4. 查看 P2P 日志
huinet p2p --log-level=debug
```

### 消息传递失败

**症状：** Agent 之间无法发送消息

**解决方案：**

```bash
# 1. 检查网络拓扑
huinet topology --verbose

# 2. 测试消息路由
huinet send <agent-id> --test

# 3. 检查防火墙规则
iptables -L -n | grep 8000

# 4. 重启 P2P 连接
huinet p2p --reconnect
```

### mDNS 发现失败

**解决方案：**

```bash
# 1. 检查 mDNS 服务
macOS: brew services list | grep mdns
Linux: systemctl status avahi-daemon

# 2. 禁用 mDNS 使用静态配置
huinet daemon start --no-mdns

# 3. 手动添加机器
huinet topology add <machine-id> <ip>:<port>
```

---

## 性能问题

### 高 CPU 使用率

**诊断步骤：**

```bash
# 1. 分析 CPU 使用
top -p $(pgrep huinet)

# 2. CPU 性能分析
perf top -p $(pgrep huinet)

# 3. 检查心跳频率
huinet config show | grep heartbeatInterval

# 4. 减少心跳频率
huinet config set heartbeatInterval 10000
```

### 高内存使用

**解决方案：**

```bash
# 1. 检查内存使用
ps aux | grep huinet | awk '{print $6}'

# 2. 分析内存泄漏
node --heap-prof huinet daemon start

# 3. 调整连接池大小
huinet config set maxConnections 25

# 4. 定期重启守护进程
crontab -e
# 添加: 0 3 * * * huinet daemon restart
```

### 网络延迟

**诊断步骤：**

```bash
# 1. 测试网络延迟
ping -c 10 <remote-machine>

# 2. 测试 P2P 消息延迟
huinet ping <machine-id>

# 3. 检查消息队列
huinet queue --stats

# 4. 优化网络配置
huinet config set connectionTimeout 5000
```

---

## 调试技巧

### 启用调试日志

```bash
# 临时启用
HUINET_LOG_LEVEL=debug huinet daemon start

# 永久启用
huinet config set logLevel debug
huinet daemon restart
```

### 捕获网络流量

```bash
# 使用 tcpdump
sudo tcpdump -i any -w huinet.pcap port 8000

# 使用 Wireshark 分析
wireshark huinet.pcap
```

### 监控文件描述符

```bash
# 检查打开的文件描述符
lsof -p $(pgrep huinet) | wc -l

# 增加文件描述符限制
ulimit -n 4096
```

### 性能分析

```bash
# 使用 Node.js 性能分析
node --prof huinet daemon start
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > profile.txt

# 使用 clinic.js
npm install -g clinic
clinic doctor -- huinet daemon start
```

### 崩溃转储分析

```bash
# 启用核心转储
echo "/tmp/core.%e.%p" | sudo tee /proc/sys/kernel/core_pattern
ulimit -c unlimited

# 运行守护进程
huinet daemon start

# 如果崩溃，分析转储
ls -l /tmp/core.huinet.*
gdb $(which huinet) /tmp/core.huinet.*
```

---

## 获取帮助

### 社区支持

- GitHub Issues: https://github.com/huinet/agent-platform/issues
- Discord: https://discord.gg/huinet
- 邮件列表: huinet@googlegroups.com

### 报告问题

提交问题时，请包含：

1. HuiNet 版本：`huinet --version`
2. Node.js 版本：`node --version`
3. 操作系统：`uname -a`
4. 错误日志
5. 复现步骤

### 日志收集

```bash
# 收集所有日志
huinet logs --collect > huinet-logs.tar.gz

# 查看最近的错误
huinet logs --errors --tail 50
```
