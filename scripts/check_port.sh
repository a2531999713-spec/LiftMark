#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/.env" 2>/dev/null || true
set +a

if [[ -z "${SUDO_PASSWORD:-}" ]]; then
  echo "错误：请在 scripts/.env 中设置 SUDO_PASSWORD" >&2
  echo "参考：cp scripts/.env.example scripts/.env" >&2
  exit 1
fi

echo "=== current 3000 ==="
echo "$SUDO_PASSWORD" | sudo -S lsof -i:3000 2>/dev/null
ROOTPID=$(echo "$SUDO_PASSWORD" | sudo -S lsof -i:3000 -t 2>/dev/null | head -1)
echo "root pid on 3000: $ROOTPID"
if [ -n "$ROOTPID" ]; then
  echo "=== process info ==="
  echo "$SUDO_PASSWORD" | sudo -S ps -o pid,ppid,user,etime,cmd -p "$ROOTPID" 2>/dev/null
  PPID=$(echo "$SUDO_PASSWORD" | sudo -S ps -o ppid= -p "$ROOTPID" 2>/dev/null | tr -d ' ')
  echo "parent pid: $PPID"
  if [ -n "$PPID" ] && [ "$PPID" != "0" ] && [ "$PPID" != "1" ]; then
    echo "=== parent info ==="
    echo "$SUDO_PASSWORD" | sudo -S ps -o pid,ppid,user,cmd -p "$PPID" 2>/dev/null
  fi
fi
echo "=== systemd liftmark ==="
echo "$SUDO_PASSWORD" | sudo -S systemctl list-units --type=service --all 2>/dev/null | grep -iE 'lift|node'
echo "=== pm2 dump ==="
cat /home/deploy/.pm2/dump.pm2 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); [print(a.get('name'),'->',a.get('pm_exec_path') or a.get('script')) for a in d]" 2>/dev/null
echo "=== deploy.sh head ==="
head -20 /home/deploy/liftmark/apps/liftmark-api/deploy.sh 2>/dev/null
