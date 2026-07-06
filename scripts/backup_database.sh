#!/bin/bash
set -euo pipefail

# LiftMark PostgreSQL 定时备份脚本
# 用法：由 cron 每日调用，或手动执行 ./scripts/backup_database.sh

PROJECT_DIR="/home/deploy/liftmark"
BACKUP_DIR="${PROJECT_DIR}/backups"
LOG_DIR="${PROJECT_DIR}/logs"
ENV_FILE="${PROJECT_DIR}/apps/liftmark-api/.env"
KEEP_DAYS=14

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/liftmark_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"

mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

exec > >(tee -a "${LOG_FILE}") 2>&1

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[ERROR] 环境变量文件不存在: ${ENV_FILE}"
  exit 1
fi

DATABASE_URL=$(grep '^DATABASE_URL=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
if [[ -z "${DATABASE_URL}" ]]; then
  echo "[ERROR] 无法从 ${ENV_FILE} 读取 DATABASE_URL"
  exit 1
fi

echo "[INFO] 开始备份: ${TIMESTAMP}"
echo "[INFO] 备份文件: ${COMPRESSED_FILE}"

# 使用 pg_dump 备份；要求服务器已安装 postgresql-client
if ! command -v pg_dump &>/dev/null; then
  echo "[ERROR] 未找到 pg_dump，请先安装 postgresql-client"
  exit 1
fi

pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges > "${BACKUP_FILE}"
gzip -9 "${BACKUP_FILE}"
BACKUP_SIZE=$(du -h "${COMPRESSED_FILE}" | cut -f1)

echo "[INFO] 备份完成: ${COMPRESSED_FILE} (${BACKUP_SIZE})"

# 清理过期备份
DELETED_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'liftmark_*.sql.gz' -mtime +${KEEP_DAYS} | wc -l)
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'liftmark_*.sql.gz' -mtime +${KEEP_DAYS} -delete
echo "[INFO] 清理 ${DELETED_COUNT} 个过期备份（保留最近 ${KEEP_DAYS} 天）"

# 输出当前备份列表
BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'liftmark_*.sql.gz' | wc -l)
echo "[INFO] 当前共有 ${BACKUP_COUNT} 个备份文件"
