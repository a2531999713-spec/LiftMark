// 构建信息统一访问入口。
// 真实值由 scripts/generate-build-info.js 在构建前写入 buildInfo.generated.ts。
// 这里只做类型收敛与只读导出，避免业务代码直接依赖生成文件结构。
import { BUILD_INFO as GENERATED_BUILD_INFO } from './buildInfo.generated';

export type BuildInfo = {
  /** 构建对应的 git commit 短哈希，未构建时为 'unknown' */
  commit: string;
  /** 构建对应的 git 分支，未构建时为 'unknown' */
  branch: string;
  /** 构建发生的 ISO 时间，未构建时为空串 */
  builtAt: string;
  /** App 版本号，与 package.json / android versionName 保持一致 */
  appVersion: string;
  /** 构建时确定的 API base url（非敏感，仅 host+path） */
  apiBaseUrl: string;
};

export const BUILD_INFO: Readonly<BuildInfo> = Object.freeze({ ...GENERATED_BUILD_INFO });

/** 是否已生成真实构建信息（用于区分开发态与已构建态） */
export const HAS_BUILD_INFO: boolean = BUILD_INFO.commit !== 'unknown' && BUILD_INFO.commit.length > 0;
