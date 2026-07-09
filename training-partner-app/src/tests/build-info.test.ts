import { describe, expect, it } from '@jest/globals';

import { BUILD_INFO, HAS_BUILD_INFO } from '@/config/buildInfo';

describe('BUILD_INFO accessor', () => {
  it('exposes all required build traceability fields', () => {
    // 确保构建信息包含 AGENTS.md / 任务要求的所有字段：commit/branch/builtAt/appVersion/apiBaseUrl
    expect(BUILD_INFO).toHaveProperty('commit');
    expect(BUILD_INFO).toHaveProperty('branch');
    expect(BUILD_INFO).toHaveProperty('builtAt');
    expect(BUILD_INFO).toHaveProperty('appVersion');
    expect(BUILD_INFO).toHaveProperty('apiBaseUrl');
  });

  it('is frozen and cannot be mutated at runtime', () => {
    expect(Object.isFrozen(BUILD_INFO)).toBe(true);
  });

  it('appVersion matches the expected semver format', () => {
    expect(BUILD_INFO.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('apiBaseUrl is a non-secret http(s) URL without credentials', () => {
    const url = BUILD_INFO.apiBaseUrl;
    expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
    // 不应包含敏感信息：无 token、无手机号、无密码
    expect(url).not.toMatch(/token|password|secret/i);
  });

  it('HAS_BUILD_INFO reflects whether a real commit was generated', () => {
    // 开发态下 generated 文件为占位值 'unknown'，HAS_BUILD_INFO 应为 false；
    // 构建后 generated 文件被真实 git 信息覆盖，HAS_BUILD_INFO 应为 true。
    expect(HAS_BUILD_INFO).toBe(BUILD_INFO.commit !== 'unknown' && BUILD_INFO.commit.length > 0);
  });
});
