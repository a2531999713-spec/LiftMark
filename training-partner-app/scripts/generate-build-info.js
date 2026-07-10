// 构建前生成 src/config/buildInfo.generated.ts，让 App 内 / 日志能看到当前 commit / branch / build time。
// 只写入非敏感信息：commit、branch、builtAt、appVersion、apiBaseUrl。
// 严禁写入 token、密钥、手机号。
//
// 用法：node scripts/generate-build-info.js
// 由 package.json 的 android:apk* 脚本作为 prebuild 步骤调用。
/* global __dirname */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_VERSION = '0.2.0';
const DEFAULT_API_BASE_URL = 'http://47.100.239.29/api';

function runGit(args, fallback) {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}

function safeShortCommit(raw) {
  if (!raw) return 'unknown';
  return raw.slice(0, 12);
}

function sanitizeBranch(raw) {
  if (!raw) return 'unknown';
  // 去掉可能的换行/引号，保留常见字符
  return raw.replace(/[\r\n"]/g, '').slice(0, 80);
}

const commit = safeShortCommit(runGit('rev-parse HEAD', ''));
const branch = sanitizeBranch(runGit('rev-parse --abbrev-ref HEAD', ''));
const builtAt = new Date().toISOString();
// 与 src/config/api.ts 保持一致：env 优先，去掉尾部斜杠
const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

const content = `// 此文件由 scripts/generate-build-info.js 自动生成，请勿手动编辑。
// 占位值在未构建时（开发/测试）使用，构建时会被真实 git 信息覆盖。
export const BUILD_INFO = {
  commit: ${JSON.stringify(commit)},
  branch: ${JSON.stringify(branch)},
  builtAt: ${JSON.stringify(builtAt)},
  appVersion: ${JSON.stringify(APP_VERSION)},
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
};
`;

const targetDir = path.resolve(__dirname, '..', 'src', 'config');
const targetPath = path.join(targetDir, 'buildInfo.generated.ts');

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetPath, content, 'utf8');

// 仅输出摘要，避免在 CI 日志泄露完整路径细节
console.log(`[build-info] generated: commit=${commit || 'unknown'} branch=${branch || 'unknown'}`);
