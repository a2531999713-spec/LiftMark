# AI 开发规则
## 2026-06-14 品牌与运行规则

- 当前品牌统一为“练刻 LiftMark”。
- Android package 统一使用 `com.liftmark.app`，`android:open` 脚本必须同步该包名。
- 计划文件推荐 `.liftmark.json`，格式为 `liftmark-plan`，不得包含成员 1RM、身体数据或训练记录。
- 当前真实项目路径为 `C:\Users\zhw\Documents\LiftMark\training-partner-app`；执行命令前必须先进入该路径并确认 `Get-Location`。


更新时间：2026-06-11

## 1. 修改代码前

1. 必须先阅读 `docs/README.md`。
2. 必须阅读 `docs/project-overview.md`。
3. 必须阅读 `docs/development-roadmap.md`。
4. 必须根据任务判断涉及模块。
5. 必须阅读相关模块的 `overview.md`、`design.md`、`implementation.md`。
6. 架构、数据或业务流任务必须阅读相关 `technical-architecture.md`、`database/schema.md`、`api/local-repository-api.md` 或 `flows/` 文档。
7. 不得只根据文档直接修改代码，必须阅读相关源码确认。

## 2. 修改代码时

1. 优先小步修改。
2. 不做无关重构。
3. 不随意修改公共接口。
4. 不删除未理解的兼容逻辑。
5. 不擅自修改数据库结构。
6. 不把业务逻辑写到页面文件。
7. Domain 层不得依赖 UI。
8. Repository 层不得假设永远只有本地 SQLite，需保留后续同步边界。
9. 除成员编辑、计划编辑、历史补录等真实输入流程外，普通功能页禁止做成表单。
10. 设置页、计划页、记录页、探索页、训练页弹框必须使用 App 风格卡片、列表、标签、底部弹层或分组操作。
11. 新增 `Alert` 只能用于危险确认、系统错误或极轻量输入错误，不得承载复杂选择流程。

## 3. 项目专属禁止事项

1. 严禁把训练计划写死在 React 组件里。
2. 严禁只做单人训练逻辑。
3. 严禁用 AsyncStorage 保存训练记录。
4. 严禁计划修改时破坏历史记录。
5. 严禁训练中必须联网。
6. 严禁把训练执行页做成 Excel 表格。
7. 严禁所有逻辑都写在页面文件里。
8. 严禁没有 Repository 抽象。
9. 严禁没有本地数据导出。
10. 严禁没有错误处理和空状态。
11. 严禁重新引入用户可见的 `Training Partner` 品牌文案。
12. 严禁把“复制方案”“切换计划”“导入计划”这类流程做成大面积输入框或系统默认弹窗。

## 4. 修改代码后

1. 必须说明修改了哪些文件。
2. 必须说明影响了哪些模块。
3. 必须说明是否修改了公共接口。
4. 必须说明是否需要更新测试。
5. 必须说明是否更新了文档。
6. 必须列出已更新的文档。
7. 如未更新某些文档，必须说明原因。

## 5. 文档同步要求

1. 新增功能：必须检查 `development-roadmap.md`。
2. 修改模块职责：必须检查模块 `design.md` 和 `overview.md`。
3. 修改核心函数：必须检查模块 `implementation.md`。
4. 修改业务流程：必须检查 `flows/` 下对应流程文档。
5. 修改 Repository 接口：必须检查 `api/local-repository-api.md`。
6. 修改数据表：必须检查 `database/schema.md`。
7. 修改架构：必须检查 `technical-architecture.md` 和 `adr/`。

## 6. Excel 计划处理规则

Excel 训练计划只作为 seed 数据设计来源。

允许：

- 把 Sheet 结构整理为 seed 文件、领域类型和数据库记录。
- 把 Excel 公式转为可测试的 Domain 函数。
- 在文档中说明字段映射和训练周期结构。

禁止：

- 把 Excel 行直接硬编码进页面组件。
- 让 UI 依赖 Excel Sheet 名。
- 把训练记录继续做成表格搬运。

## 7. Android 本地 APK 预览规则

1. 本地 Android 预览 APK：`npm run android:preview`。
2. 推荐安装命令是 `adb install -r android/app/build/outputs/apk/release/app-release.apk`。
3. 不依赖 Expo Go 自动下载。
4. 本地预览 APK 不依赖 Metro；development build 仍可选保留，但需要 `npm run start:dev-client`。
5. 保留 `expo-sqlite` 作为 Android / iOS / Web 的本地数据库方案。
8. Windows 本机构建应使用 Node.js 22.13.0+、64-bit JDK 17；当前验证环境为 Node.js v24.16.0 / npm 11.13.0 / Microsoft OpenJDK 17.0.19。
9. 项目统一使用 JDK 17，不升级到 Java 24。
10. Gradle toolchain 只从 `JAVA_HOME` 发现本机 JDK，关闭自动下载，不设置 vendor 限制，不使用 `JvmVendorSpec.IBM_SEMERU`。
11. 本地 release APK 可以临时使用 debug keystore 签名，仅用于本机安装预览；正式发布前必须更换生产签名配置。
12. 遇到项目内 native/CMake 缓存类失败时，先运行 `npm run android:apk:clean`，不要修改 `node_modules`。
13. 原生 `gradlew clean` 若清理到 `node_modules` 下的 CMake 生成缓存并失败，不应为了通过 clean 手动删除或修改 `node_modules`；本阶段以 APK 构建、安装和首屏启动为验收。
14. Android package 统一使用 `com.liftmark.app`，`android:open` 脚本必须同步该包名。

## 8. 品牌和中文化规则

1. 用户可见品牌统一为中文名“练刻”和英文名“LiftMark”。
2. App 显示名称使用“练刻”。
3. 代码变量、类型名、数据库字段名保持英文。
4. 用户可见文案优先中文；内部枚举如 `increase`、`maintain` 只能通过 label 映射展示给用户。
5. 计划文件第一版推荐 `.liftmark.json`，并预留 `.json`、`.liftmark`、`.liftmark.zip`；计划文件不得包含成员 1RM、身体数据或训练记录。
6. 系统方案不是用户计划；用户必须点击“使用此方案”后才生成自己的计划，训练记录不能直接绑定系统方案。
