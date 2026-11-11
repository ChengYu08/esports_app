#!/usr/bin/env bash
# 测试环境 Metro server 启动与守护脚本（macOS）
#
# 用法：
#   ./start_metro_mac.sh                                   # 前台运行，Ctrl+C 退出
#   nohup ./start_metro_mac.sh >/dev/null 2>&1 &          # 后台常驻
#
# 行为：
#   1. 单实例锁，避免多个守护进程互相抢占 8081；
#   2. 启动前检查 8081 端口，被占用则先终止占用进程；
#   3. 按测试环境 .env.development 启动 Metro 到 8081（--host lan，真机可连）；
#   4. 每 10 秒检查服务可用性，端口/接口失联立即拉起（带重启退避）；
#   5. 每 30 分钟体检一次：内存占用超上限则自动重启。
#
# 可覆盖的环境变量：
#   METRO_PORT=8081              监听端口
#   METRO_HOST=lan               dev server host 类型（lan / localhost / tunnel）
#   METRO_CHECK_INTERVAL=1800    体检间隔（秒，默认 30 分钟）
#   METRO_MEM_LIMIT_MB=3072      内存上限（MB，超过即重启）
#   METRO_CI=1                   设为 1 使用 CI 模式（关闭文件监听/热更新）
#   METRO_LOG_FILE=/path/log     日志路径
#   METRO_LOCK_FILE=/path/pid    单实例锁文件路径

# 允许 `sh start_metro_mac.sh` 调用：脚本用到 BASH_SOURCE / local / pipefail，
# 非 bash 时重新用 bash 执行自身（PID 不变，不影响单实例锁）
if [ -z "${BASH_VERSION:-}" ]; then
  exec /bin/bash "$0" "$@"
fi

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

PORT="${METRO_PORT:-8081}"
HOST="${METRO_HOST:-lan}"
CHECK_INTERVAL="${METRO_CHECK_INTERVAL:-1800}"
MEM_LIMIT_MB="${METRO_MEM_LIMIT_MB:-3072}"
KEEPALIVE_INTERVAL=10
LOG_FILE="${METRO_LOG_FILE:-$SCRIPT_DIR/.expo/start_metro_mac.log}"
LOCK_FILE="${METRO_LOCK_FILE:-$SCRIPT_DIR/.expo/start_metro_mac.pid}"
CLI="$SCRIPT_DIR/node_modules/expo/bin/cli"
ENV_RUNNER="$SCRIPT_DIR/scripts/with-env.cjs"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE"
}

# 部分 IDE 会注入 NODE_OPTIONS 预加载脚本，它会让 Expo CLI / npm 在解析模块时
# 挂起，长跑后还会因 broker.sock 断开直接崩溃，这里必须清掉。
unset NODE_OPTIONS
export EXPO_NO_TELEMETRY=1
if [ "${METRO_CI:-0}" = "1" ]; then
  export CI=1
else
  # 保留文件监听（热更新）；stdin 已指向 /dev/null，不会出现交互阻塞
  unset CI
fi

# 前置检查放在任何 trap / 锁之前，避免检查失败时留下脏状态
if [ ! -f "$CLI" ]; then
  echo "缺少 ${CLI}，请先在项目根目录执行 npm install" >&2
  exit 1
fi
if [ ! -f "$ENV_RUNNER" ] || [ ! -f "$SCRIPT_DIR/.env.development" ]; then
  echo "缺少 scripts/with-env.cjs 或 .env.development" >&2
  exit 1
fi

# 单实例锁：两个守护实例会互相 kill 对方的 8081 进程，必须挡住
acquire_lock() {
  local old
  if [ -f "$LOCK_FILE" ]; then
    old="$(cat "$LOCK_FILE" 2>/dev/null)"
    case "$old" in
      ''|*[!0-9]*) ;;
      *)
        if kill -0 "$old" 2>/dev/null; then
          echo "已有守护实例在运行（PID ${old}）。请先停掉它：kill ${old}（或在它的终端按 Ctrl+C）。" >&2
          echo "若确认该进程已不存在（仅 PID 被复用），再删除 ${LOCK_FILE} 后重试。" >&2
          exit 1
        fi
        ;;
    esac
  fi
  printf '%s\n' "$$" > "$LOCK_FILE"
}
acquire_lock

# 本机 http_proxy 会拦截 127.0.0.1，自检必须绕过代理，否则拿到的是代理错误页
status_ok() {
  curl --noproxy '*' -fsS --max-time 5 "http://127.0.0.1:${PORT}/status" 2>/dev/null | grep -q 'running'
}

# 取端口上真正监听的进程（Metro 本体，而不是 with-env 包装进程）
port_pids() {
  lsof -nP -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | sort -u
}

kill_port() {
  local pids pid
  pids="$(port_pids)"
  [ -z "$pids" ] && return 0
  log "端口 ${PORT} 被占用（PID: $(echo "$pids" | tr '\n' ' ')），准备终止"
  for pid in $pids; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for _ in 1 2 3 4 5; do
    pids="$(port_pids)"
    [ -z "$pids" ] && return 0
    sleep 1
  done
  for pid in $pids; do
    log "进程 ${pid} 未退出，强制终止"
    kill -KILL "$pid" 2>/dev/null || true
  done
}

METRO_PID=""

stop_metro() {
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill -TERM "$METRO_PID" 2>/dev/null || true
  fi
  kill_port
  METRO_PID=""
}

start_metro() {
  stop_metro
  log "启动 Metro：端口 ${PORT}，host=${HOST}，环境 .env.development（test）"
  node "$ENV_RUNNER" test node "$CLI" start --port "$PORT" --host "$HOST" < /dev/null >> "$LOG_FILE" 2>&1 &
  METRO_PID=$!
  local i
  for i in $(seq 1 60); do
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
      log "Metro 启动失败：进程提前退出，详见 ${LOG_FILE}"
      return 1
    fi
    if status_ok; then
      local ip
      ip="$(ipconfig getifaddr en0 2>/dev/null)"
      [ -z "$ip" ] && ip="$(ipconfig getifaddr en1 2>/dev/null)"
      log "Metro 已就绪（包装进程 PID ${METRO_PID}）"
      if [ -n "$ip" ]; then
        log "真机连接地址：http://${ip}:${PORT} （手机需与本机同一局域网）"
      fi
      return 0
    fi
    sleep 2
  done
  log "Metro 启动超时（120 秒未就绪）"
  return 1
}

# 服务可用性以「端口有监听 + /status 正常」为准，而不是包装进程 PID。
# with-env 包装进程退出后 CLI 子进程可能仍存活，只盯 PID 会误判并反复重启。
metro_alive() {
  local pid
  pid="$(port_pids | head -1)"
  [ -n "$pid" ] && status_ok
}

RAPID_RESTARTS=0
LAST_RESTART=0

restart_metro() {
  local now
  now="$(date +%s)"
  if [ $((now - LAST_RESTART)) -lt 120 ]; then
    RAPID_RESTARTS=$((RAPID_RESTARTS + 1))
  else
    RAPID_RESTARTS=1
  fi
  LAST_RESTART="$now"
  if [ "$RAPID_RESTARTS" -ge 5 ]; then
    log "2 分钟内已连续重启 ${RAPID_RESTARTS} 次，冷却 60 秒（避免重启风暴）"
    sleep 60
    RAPID_RESTARTS=0
  fi
  log "正在重启 Metro ..."
  if start_metro; then
    log "重启完成"
  else
    log "重启失败，${KEEPALIVE_INTERVAL} 秒后由保活逻辑重试"
    stop_metro
  fi
}

# 读取 Metro 进程内存占用（MB）
# 优先使用 ps 的 RSS；部分 IDE 内置终端禁止执行 ps/top，改用 macOS 自带 footprint
read_rss_mb() {
  local pid="$1" rss_kb mb
  rss_kb="$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')"
  case "$rss_kb" in
    ''|*[!0-9]*) ;;
    *) echo $((rss_kb / 1024)); return 0 ;;
  esac
  if [ -x /usr/bin/footprint ]; then
    mb="$(/usr/bin/footprint "$pid" 2>/dev/null | awk '/Footprint:/ {
      for (i = 1; i < NF; i++) {
        if ($i == "Footprint:") {
          v = $(i + 1) + 0; u = $(i + 2);
          if (u == "GB") v *= 1024;
          else if (u == "KB") v /= 1024;
          printf "%d", v;
          exit
        }
      }
    }')"
    case "$mb" in
      ''|*[!0-9]*) ;;
      *) echo "$mb"; return 0 ;;
    esac
  fi
  return 1
}

# 每 30 分钟一次的资源/健康体检
health_check() {
  local pid rss_mb
  pid="$(port_pids | head -1)"
  if [ -z "$pid" ]; then
    log "体检：端口 ${PORT} 无监听，判定 Metro 失联"
    restart_metro
    return
  fi
  if ! status_ok; then
    log "体检：Metro 接口无响应"
    restart_metro
    return
  fi
  if ! rss_mb="$(read_rss_mb "$pid")"; then
    log "体检：进程 ${pid} 内存读取失败（ps/footprint 均不可用），仅做存活检查"
    return
  fi
  if [ "$rss_mb" -gt "$MEM_LIMIT_MB" ]; then
    log "体检：内存占用 ${rss_mb}MB 超过上限 ${MEM_LIMIT_MB}MB，自动重启"
    restart_metro
  else
    log "体检：正常（Metro PID ${pid}，内存 ${rss_mb}MB / 上限 ${MEM_LIMIT_MB}MB，${CHECK_INTERVAL}s 后复检）"
  fi
}

cleanup() {
  trap - INT TERM
  log "收到退出信号，停止 Metro"
  stop_metro
  # 清空锁文件内容即可，不用 rm（部分受限终端禁止执行 rm）
  : > "$LOCK_FILE"
  exit 0
}

# 注意：绝不能 trap EXIT。命令替换 / 管道会创建子 shell，子 shell 正常退出时
# 会继承并触发 EXIT trap，导致 cleanup 在子 shell 里杀掉刚启动的 Metro，
# 主循环随后又拉起，形成「自己不断重启自己」（v1 的 bug）。
trap cleanup INT TERM

log "==== 守护启动（端口 ${PORT}，host=${HOST}，体检间隔 ${CHECK_INTERVAL}s，内存上限 ${MEM_LIMIT_MB}MB）===="
if ! start_metro; then
  log "首次启动未成功，进入保活重试循环"
fi

last_check="$(date +%s)"
while true; do
  sleep "$KEEPALIVE_INTERVAL"
  now="$(date +%s)"

  # 保活：以服务可用性为准，失联立刻拉起，不等 30 分钟
  if ! metro_alive; then
    log "检测到 Metro 服务不可用，立即拉起"
    restart_metro
    last_check="$now"
    continue
  fi

  if [ $((now - last_check)) -ge "$CHECK_INTERVAL" ]; then
    last_check="$now"
    health_check
  fi
done
