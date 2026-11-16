#!/bin/sh
# Android 11+ 无线 ADB 调试一键连接脚本（方案 A：无需 USB 线）
#
# 用法:
#   sh scripts/adb-wifi.sh            # 常规：已配对则直接连，未配对则引导配对
#   sh scripts/adb-wifi.sh --reset    # 连接异常时：先重启 adb server 再执行
#
# 原理:
#   1) 通过 adb mDNS 自动发现手机的「无线调试」服务，省去手抄 IP 和端口
#   2) 局域网有多台设备时会列出清单让你确认，避免连到别人的手机
#   3) 用配对码完成一次配对（配对是持久的，之后同一网络下会自动重连）
#   4) 用 mDNS 发现的连接端口执行 adb connect，并校验设备状态为 device
#
# 前提:
#   - Mac 与手机连接同一个 WiFi（网络允许 mDNS / 5555 及动态端口通信）
#   - 手机已开启「开发者选项 → 无线调试」
#   - 本机 Android SDK platform-tools 中的 adb 可在 PATH 中找到
#
# 可配环境变量:
#   ADB_WIFI_PAIR_TIMEOUT     等待配对服务出现的最长秒数，默认 60
#   ADB_WIFI_CONNECT_TIMEOUT  等待连接服务出现的最长秒数，默认 15
#
# 说明: 全程使用 POSIX sh 语法，可直接用 sh 执行，不依赖 bash / zsh。

set -u

ADB=$(command -v adb 2>/dev/null || true)
PAIR_TIMEOUT=${ADB_WIFI_PAIR_TIMEOUT:-60}
CONNECT_TIMEOUT=${ADB_WIFI_CONNECT_TIMEOUT:-15}
WIRELESS_SERIAL=''
REPLY_VALUE=''

info() { printf '==> %s\n' "$1"; }
ok()   { printf '[OK] %s\n' "$1"; }
warn() { printf '[!]  %s\n' "$1"; }
err()  { printf '[x]  %s\n' "$1" >&2; }

# 读取一行输入。POSIX sh 的 read 没有 -p，提示信息必须写到 stderr，
# 否则在命令替换中会被当成返回值一起捕获。
read_value() {
    printf '%s' "$1" >&2
    read -r REPLY_VALUE || REPLY_VALUE=''
}

# 查询指定 mDNS 服务，输出所有匹配到的 IP:端口（每行一个）
mdns_addrs() {
    _svc="$1"
    "$ADB" mdns services 2>/dev/null | awk -v s="$_svc" '$2 == s { print $3 }'
}

# 取第一个匹配到的地址
mdns_addr() {
    mdns_addrs "$1" | sed -n '1p'
}

# 轮询等待某 mDNS 服务出现，最多等待若干秒；提示走 stderr，避免污染返回值。
# 第三个参数传入 IP 时只接受该 IP 的服务，用于锁定刚配对成功的那台手机。
wait_mdns() {
    _svc="$1"
    _timeout="$2"
    _ip="${3:-}"
    _elapsed=0
    _addr=''
    while [ "$_elapsed" -lt "$_timeout" ]; do
        if [ -n "$_ip" ]; then
            _addr=$(mdns_addrs "$_svc" | awk -v ip="$_ip" 'index($0, ip ":") == 1 { print; exit }')
        else
            _addr=$(mdns_addr "$_svc")
        fi
        if [ -n "$_addr" ]; then
            printf '%s' "$_addr"
            return 0
        fi
        printf '.' >&2
        sleep 2
        _elapsed=$((_elapsed + 2))
    done
    printf '\n' >&2
    return 1
}

# 等待设备状态变成 device，serial 写入 WIRELESS_SERIAL。
# 传入第二个参数时精确匹配该 serial，避免把局域网里其它已在线设备误判成目标。
# 无线设备的 serial 形如 192.168.x.x:端口，USB 设备和模拟器不含冒号。
wait_online() {
    _timeout="$1"
    _expect="${2:-}"
    _elapsed=0
    while [ "$_elapsed" -le "$_timeout" ]; do
        if [ -n "$_expect" ]; then
            WIRELESS_SERIAL=$("$ADB" devices -l 2>/dev/null | awk -v e="$_expect" 'NR > 1 && $2 == "device" && $1 == e { print $1; exit }')
        else
            WIRELESS_SERIAL=$("$ADB" devices -l 2>/dev/null | awk 'NR > 1 && $2 == "device" && $1 ~ /:/ { print $1; exit }')
        fi
        if [ -n "$WIRELESS_SERIAL" ]; then
            return 0
        fi
        sleep 1
        _elapsed=$((_elapsed + 1))
    done
    return 1
}

# 连接失败时打印排查建议
print_network_hint() {
    warn "排查建议:"
    warn "  1. 确认 Mac 与手机在同一个 WiFi，且没有 AP 隔离 / 公司防火墙拦截"
    warn "  2. 手机上「无线调试」保持开启，锁屏或切网后部分 ROM 会自动关闭"
    warn "  3. 部分网络不支持 mDNS 自动发现，可改用手动输入 IP:端口的模式"
    warn "  4. 强制切换新版 mDNS 后端: ADB_MDNS_OPENSCREEN=0 adb kill-server && adb start-server"
    warn "  5. 仍失败时重试: sh scripts/adb-wifi.sh --reset"
}

show_success() {
    printf '\n'
    ok "无线 ADB 已连接: $WIRELESS_SERIAL"
    "$ADB" devices -l
    printf '\n'
    info "启动 / 守护 Metro（项目脚本，已带 --host lan，并自动 unset NODE_OPTIONS）:"
    printf '  sh start_metro_mac.sh\n'
    if [ -n "$LAN_IP" ]; then
        printf '==> 真机 dev client 里填: http://%s:8081\n' "$LAN_IP"
    fi
    printf '\n'
    info "若 dev client 走 localhost:8081，设备重连后 reverse 会丢失，需重设:"
    printf '  adb -s %s reverse tcp:8081 tcp:8081\n' "$WIRELESS_SERIAL"
    printf '\n'
    info "需要重装 debug 包时（Metro 已单独启动加 --no-bundler；本环境不要用 npm / npx）:"
    printf '  node scripts/with-env.cjs test node node_modules/expo/bin/cli run:android --no-bundler --device %s\n' "$WIRELESS_SERIAL"
    printf '\n'
    printf '==> 断开连接: adb disconnect %s\n' "$WIRELESS_SERIAL"
}

# ---------- 0. 环境检查 ----------
if [ -z "$ADB" ]; then
    err "未找到 adb，请确认 Android SDK platform-tools 已加入 PATH"
    err "Mac 常见路径: \$HOME/Library/Android/sdk/platform-tools"
    exit 1
fi

if [ "${1:-}" = "--reset" ]; then
    info "重启 adb server ..."
    "$ADB" kill-server >/dev/null 2>&1
fi
"$ADB" start-server >/dev/null 2>&1

info "adb 版本: $("$ADB" version | head -1)"
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
if [ -n "$LAN_IP" ]; then
    info "本机局域网 IP: $LAN_IP （请确认手机在同一网段）"
fi

# ---------- 1. 快速路径：之前已经配对过 ----------
info "扫描局域网内已开启「无线调试」的设备 ..."
FAST_LIST=$(mdns_addrs "_adb-tls-connect._tcp")
FAST_ADDR=$(printf '%s\n' "$FAST_LIST" | sed -n '1p')
if [ -n "$FAST_ADDR" ]; then
    printf '%s\n' "$FAST_LIST" | awk '{ printf "     [%d] %s\n", NR, $0 }'
    read_value "连哪台？回车默认 [1]，也可输入序号 / IP:端口，输入 n 跳过并重新配对: "
    FAST_CHOICE=$REPLY_VALUE
    case "$FAST_CHOICE" in
        n|N)
            FAST_ADDR=''
            warn "跳过直连，进入配对流程"
            ;;
        '')
            FAST_ADDR=$(printf '%s\n' "$FAST_LIST" | sed -n '1p')
            ;;
        *:*)
            # 允许直接粘贴一个未被 mDNS 发现的地址
            FAST_ADDR=$FAST_CHOICE
            ;;
        *)
            if printf '%s' "$FAST_CHOICE" | grep -q '^[0-9][0-9]*$'; then
                FAST_ADDR=$(printf '%s\n' "$FAST_LIST" | sed -n "${FAST_CHOICE}p")
            else
                FAST_ADDR=''
            fi
            ;;
    esac
fi

if [ -n "$FAST_ADDR" ]; then
    info "尝试连接 $FAST_ADDR ..."
    "$ADB" connect "$FAST_ADDR" >/dev/null 2>&1
    if wait_online 6 "$FAST_ADDR"; then
        ok "设备此前已配对，无需重复配对"
        show_success
        exit 0
    fi
    warn "直连未就绪（尚未配对 / unauthorized / 端口已变），进入配对流程"
fi

# ---------- 2. 配对（只需做一次） ----------
printf '\n'
info "请在手机上操作:"
info "  设置 → 开发者选项 → 无线调试 → 开启（勾选「始终允许在此网络上进行调试」）"
info "  点击「使用配对码配对设备」，保持弹窗不要关闭"
printf '\n'
info "正在搜索配对服务（最多 $PAIR_TIMEOUT 秒）"
PAIR_ADDR=$(wait_mdns "_adb-tls-pairing._tcp" "$PAIR_TIMEOUT")
if [ -n "$PAIR_ADDR" ]; then
    printf '\n'
    ok "自动发现配对服务: $PAIR_ADDR"
else
    warn "未能自动发现配对服务（网络可能不支持 mDNS），改为手动输入"
    info "请读取手机弹窗里的「IP 地址和端口」"
    read_value "配对地址（如 192.168.1.23:37129）: "
    PAIR_ADDR=$REPLY_VALUE
fi

if [ -z "$PAIR_ADDR" ]; then
    err "没有拿到配对地址，已退出"
    exit 1
fi

read_value "请输入弹窗中的 6 位配对码: "
PAIR_CODE=$REPLY_VALUE
if [ -z "$PAIR_CODE" ]; then
    err "配对码不能为空，已退出"
    exit 1
fi

info "正在配对 $PAIR_ADDR ..."
PAIR_OUT=$("$ADB" pair "$PAIR_ADDR" "$PAIR_CODE" 2>&1)
printf '%s\n' "$PAIR_OUT"
case "$PAIR_OUT" in
    *Successfully*paired*)
        ok "配对成功，之后同一网络下会自动重连"
        ;;
    *)
        err "配对失败"
        warn "常见原因: 弹窗已关闭 / 配对码过期 / 抄成了连接端口 / 手机与 Mac 不在同一网段"
        print_network_hint
        exit 1
        ;;
esac

# ---------- 3. 连接 ----------
printf '\n'
# 配对端口和连接端口不同，但 IP 相同，据此精确锁定刚配对的那台手机
PAIR_IP=$(printf '%s' "$PAIR_ADDR" | sed 's/:.*//')
info "正在获取 $PAIR_IP 的无线调试连接端口（最多 $CONNECT_TIMEOUT 秒）"
CONNECT_ADDR=$(wait_mdns "_adb-tls-connect._tcp" "$CONNECT_TIMEOUT" "$PAIR_IP")
if [ -n "$CONNECT_ADDR" ]; then
    printf '\n'
    ok "发现连接服务: $CONNECT_ADDR"
else
    warn "未能自动发现连接服务，改为手动输入"
    info "注意：这里要用「无线调试」主页面上的 IP:端口，与刚才配对的端口不是同一个"
    read_value "设备地址（如 192.168.1.23:37895）: "
    CONNECT_ADDR=$REPLY_VALUE
fi

if [ -z "$CONNECT_ADDR" ]; then
    err "没有拿到连接地址，已退出"
    print_network_hint
    exit 1
fi

info "正在连接 $CONNECT_ADDR ..."
CONNECT_OUT=$("$ADB" connect "$CONNECT_ADDR" 2>&1)
printf '%s\n' "$CONNECT_OUT"

# ---------- 4. 校验 ----------
if wait_online 10 "$CONNECT_ADDR"; then
    show_success
    exit 0
fi

# 部分 adb / Android 版本在配对后会经 mDNS 自动连接，serial 未必等于连接地址，
# 此时放宽一次匹配，避免明明连上了却报失败。
if wait_online 1; then
    warn "设备已自动连接，但 serial 与连接地址 $CONNECT_ADDR 不同，以实际设备为准"
    show_success
    exit 0
fi

err "连接后设备仍未就绪，当前设备列表:"
"$ADB" devices -l
printf '\n'
print_network_hint
exit 1
