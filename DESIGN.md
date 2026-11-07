# 剧本杀 / 桌游约车平台 · 设计文档兼需求文档

> 本文档同时承担「设计文档」与「需求文档」职责：前半部分说明架构与数据模型（设计），后半部分以需求清单形式逐条记录已实现的功能与对应代码位置（需求 + 实现映射）。
> 项目路径：`table-top/`（React 19 + TypeScript + Vite + Tailwind CSS 4 前端；`backend/` 为 Java 21 + Spring Boot 服务端）。

---

## 一、产品定位

面向剧本杀 / 桌游 / 跑团玩家的「约车」（发起与参加活动）平台。核心场景：

1. 车头发布活动（选本、定时间地点、设置人数与角色）；
2. 玩家浏览日历 / 仓库 / 榜单，搜索本子与玩家，关注感兴趣的人；
3. 玩家上车、候补、做心测，车头根据心测结果手动分配角色；
4. 玩家点赞喜欢的用户主页、提交反馈 / issue；
5. 管理员 / 站长维护条目、榜单、地点、权限、心测题库，并导出运营数据。

---

## 二、技术架构

| 层 | 方案 |
|---|---|
| 视图 | React 18 + Taro 4.3.2；同一套业务页面支持浏览器、Taro H5 和微信小程序，路由在 `src/lib/router.ts` |
| 状态 | `useSyncExternalStore` 外部状态；唯一写入入口 `mutate(fn)`，内部自动 `diffState` 生成 op 并 `buildLogs` 记日志 |
| 存储 | 三层可迁移架构：`Backend` 接口（local / rest 两种适配器）；本地为 `localStorage`，服务端为 MySQL 8，表结构由 Liquibase 管理 |
| 样式 | Tailwind CSS 4，主题色在 `src/index.css` 的 `@theme` 中定义（墨黑底 + 纸白字 + 黄铜 / 印泥红 / 青瓷绿点缀） |
| 服务端 | `backend/`：Java 21 + Spring Boot + MyBatis；Fastjson2 处理业务 JSON，Spring Mail 转发反馈邮件 |
| 缓存 | Spring Cache 的进程内 `ConcurrentMapCacheManager`；写入后清理状态缓存，不依赖 Redis 或分布式 Session |
| 拖拽 | `useDragScroll` hook（鼠标拖拽横向滚动）+ `DragRow` 组件 |

### 状态写入与日志
所有写操作统一走 `mutate`，保证关注、点赞、心测、候补、评价、配置等变更都被记录为操作日志，供后台「日志」分页查看与审计。服务端 `/api/sync` 在单个事务中执行一批 insert/update/delete，任一操作失败则整批回滚，并再次校验数据归属与权限。

### 后端启动与旧库迁移

1. 执行 `docker compose up -d mysql` 启动开发 MySQL；开发账号仅用于本机。
2. 执行 `npm run server`（等价于 `cd backend && ./mvnw spring-boot:run`），服务监听 8787；另开终端执行 `npm run dev` 可使用 Vite 代理。
3. 数据库连接通过 `MYSQL_URL`、`MYSQL_USER`、`MYSQL_PASSWORD` 配置；生产环境必须设置高强度 `AUTH_SECRET`。未设置时，开发环境会生成密钥并存入 MySQL `app_meta`。
4. 首次迁移旧数据时，在空 MySQL 业务库上设置 `SQLITE_IMPORT_PATH=../data/table-top.db` 后启动后端。导入器保留原 SQLite 文件，成功后移除该环境变量再正常启动；非空库会拒绝导入。
5. 后端测试：`cd backend && ./mvnw test`。测试使用 Testcontainers 启动独立的 MySQL 8.4，需要 Docker。

MySQL 中 `users` 保存账号与资料，`documents` 保存各业务集合的 JSON 聚合，`app_meta` 保存少量服务端元数据。当前图片仍使用 data URL 或外链，不引入分布式文件存储；后续根据真实 QPS 和数据规模再评估缓存、索引与集合拆分。

生产镜像由根目录 `Dockerfile` 构建，编排文件为 `deploy/compose.yaml`。服务器以 `/srv/table-top` 为部署根目录，MySQL 数据绑定到其中的 `mysql/`，密钥保存在权限为 600 的 `.env`。两个容器均配置 `unless-stopped` 重启策略，重建容器不会删除绑定目录中的数据库。

本机通过 `~/.ssh/table-top-deploy-v2` 专用密钥连接生产机，不在脚本或环境变量中保存服务器密码。服务器已关闭密码和键盘交互登录，root 仅允许密钥登录。日常操作：

- `npm run image:build`：使用 Docker 完成前端检查、后端测试、打包和镜像构建，无需安装本机 Node/Java/Maven；`SKIP_TESTS=1` 仅用于明确需要跳过测试的构建。
- `npm run deploy`：上传镜像和编排、复用服务器数据与密钥、启动容器并检查公网健康接口。
- 可通过 `IMAGE_TAG`、`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_DIR`、`APP_URL` 环境变量覆盖默认值；全新主机恢复旧库时使用 `MIGRATE_SQLITE=1 npm run deploy`，脚本会校验恢复结果。

### 浏览器与微信小程序

- 浏览器沿用 `npm run dev` / `npm run build`，产物为 `dist/`。
- 微信开发者工具导入项目根目录，先执行 `npm run build:weapp`，产物为 `dist-weapp/`；`project.config.json` 已配置正式 AppID。
- `npm run dev:weapp` 监听编译；`npm run build:h5` 可额外验证 Taro H5 产物；`npm run build:all` 一次构建三端。
- 小程序 API 通过 `TARO_APP_API_BASE` 在编译时注入，例如 `TARO_APP_API_BASE=https://example.com/api npm run build:weapp`。默认地址仅供开发，真机必须使用 HTTPS，并在微信公众平台配置 request 合法域名。
- 共用页面由 `src/mini/index.tsx` 承载；`src/lib/platform.ts` 统一存储、复制、确认、导出等能力，`src/lib/backend/rest.ts` 同时支持 fetch 和 Taro.request。
- 在现有镜像构建脚本上设置 `BUILD_WEAPP=1` 或 `BUILD_H5=1` 可同时生成对应前端产物，不会改变生产镜像只打包 `dist/` 的行为。

---

## 三、数据模型（本轮扩展字段）

> 字段定义集中在 `src/types.ts`。本轮新增 / 强化的关键字段如下。

### 3.1 用户 `User`（types.ts:263）
| 字段 | 类型 | 说明 |
|---|---|---|
| `username` | `string` | **登录名**，`@` 后内容。永久唯一、**不可重复、不可更改**（见需求三）。 |
| `uid` | `string` | 公开唯一标识，**不可隐藏**，玩家主页常驻展示（见需求三）。 |
| `nickname` | `string` | 昵称，玩家**随时可改**。 |
| `showUsername` | `boolean` | 是否对外展示登录名，玩家自定。 |
| `following` / `followers` | `string[]` | 关注 / 被关注的用户 id 列表。 |
| `likedUsers` | `string[]` | 点赞过的用户 id，**仅日志层可见，不对外展示**（匿名点赞）。 |

- 登录名校验（与 server 对齐）：`/^[\w一-龥]{2,16}$/u`，密码 ≥ 6，昵称 2–12。
- `updateProfile`（`src/store/auth.ts:66`）在写入时**解构剔除身份字段**（`username/id/uid/role/passwordHash/createdAt/following/followers/likedUsers`），从根上保证登录名与 uid 永久不可变。

### 3.2 本子 `Game`（types.ts:118）
| 字段 | 类型 | 说明 |
|---|---|---|
| `psychTests?` | `PsychTest[]` | 心测题库，由管理员维护 / 导入。车头发车时基于它改编（见需求二）。 |
| `tags` / `rating` | — | 用于搜索与榜单。 |

`PsychTest` 结构（types.ts:112）：`{ id, title, questions: PsychQuestion[] }`，`PsychQuestion` 含 `{ id, text, options: { id, text, tag? }[] }`，`tag` 为性格标签，供车头分配角色时参考。

### 3.3 活动 `GameEvent`（types.ts:178）
| 字段 | 类型 | 说明 |
|---|---|---|
| `seats` | `Seat[]` | 座位列表。 |
| `psych?` | `{ enabled: boolean; test: PsychTest \| null }` | 是否启用心测、本次采用的心测内容（车头可改编）。 |
| `waitlistSize` | `number` | 候补位数量，0 表示不开放候补。 |

`Seat`（types.ts:161）：`status` 取值 `filled | open | pending | waitlist`；`roleName` 为分配到的角色名；`gender` 为空位展示用性别；`psychAnswers` 存心测答案（题目 id → 选项 id，仅车头可见）。

### 3.4 站点配置 `Settings`（types.ts:343）
- `feedbackEmail`：站长接收反馈的邮箱（**仅站长自己可见**）。
- `smtp`：SMTP 配置（host/user/pass/from，**仅站长自己可见**，本地模式不真正发信，部署到服务器后才发）。

### 3.5 社交推理热度
- 不再以 100 为上限。榜单以**当前第一名为 100% 基准做归一**（`StorePage` 的 `SocialColumn` 取 `maxHeat = max(s.heat)`，进度条 `value/maxHeat`），数字越高越热门（见需求三）。

### 3.6 反馈 `feedback`（types.ts:416）
- 用户提交的反馈 / issue，含文本、联系方式、截图（链接），本地模式仅存本地；服务端模式尝试发邮件到站长邮箱（`emailed` 标记是否成功）。

---

## 四、功能需求与实现映射

### 第一批（通用能力 / 后台 / 反馈）

#### R1 通用搜索栏（用户 + 仓库）
- **实现**：`SearchPage`（`src/pages/SearchPage.tsx`）+ 顶栏搜索按钮（`App.tsx`）。
- 搜索逻辑：`searchUsers` / `searchGames`（`src/store/social.ts:42/55`），按昵称 / 登录名 / uid / 本子标题 / 标签 / 出版社匹配。
- 搜索结果可一键「关注」（`followUser`）。

#### R2 匿名点赞用户主页
- **实现**：`UserPage` 展示点赞按钮（爱心图标），调用 `toggleLike(me.id, user.id)`。
- 被点赞方**不会**收到展示层面的通知；点赞关系只写入 `likedUsers`，**不对外暴露**（仅日志层可统计）。

#### R3 用户主页公开 UID（不可隐藏）
- **实现**：`UserPage` 名片区常驻 `UID {user.uid}` 按钮，点击复制到剪贴板；仅当 `showUsername` 为真时额外显示 `@{username}`。
- 昵称随时可改（`MePage`）；登录名 / uid 不可改（见需求三）。

#### R4 后台数据查看页 + 导出
- **实现**：`AdminPage` 新增「数据导出」Tab（`DataPanel`）。
- 总览卡片：用户 / 条目 / 活动 / 评价 / 反馈 / 日志计数 + 按 `status` 分布。
- 四类 CSV 导出：用户 / 活动 / 反馈 / 本子，调用 `toCSV` + `downloadText`（`src/store/social.ts:71/83`），逗号分隔、含表头，表格软件可直接打开。

#### R5 窄屏 / 中屏导航栏修复
- **实现**：`App.tsx` 底部导航 `md:hidden`；顶栏含搜索按钮；导航项含「搜索」「后台（管理员）」。窄屏折叠为底部 Tab，中屏显示顶栏，后台入口在权限满足时可见，不再因屏宽过窄而消失。

#### R6 提 issue / 反馈入口
- **实现**：全局 FAB 反馈按钮（`App.tsx`）→ `FeedbackModal`（`src/components/FeedbackModal.tsx`）。
- 提交走 `backend.feedback`，本地存本地；服务端尝试发邮件到 `feedbackEmail`。成功会提示「已通过邮件发送给站长」，未配置邮箱时提示「已记录，部署后会通知站长」。邮箱配置**仅站长自己可见**。

### 第二批（心测 / 候补 / 日历动效）

#### R7 剧本可配置心测（管理员维护 / 导入题库）
- **实现**：`AdminPage` 的「心测题库」区块（`<details>` 包裹 `PsychEditor`），可为某本子增删多份问卷、增删题目与选项、编辑文本与性格 `tag`。
- `PsychEditor`（`src/components/PsychEditor.tsx`）：受控编辑单份 `PsychTest`，`onChange` 抛出最新值。

#### R8 发车时基于默认模板改编心测
- **实现**：`CreateEventPage` 选本后预载 `game.psychTests[0]`，提供「上车心测」开关 + 默认模板下拉；开启后可打开 `Sheet` 用 `PsychEditor` 改编本次心测内容。

#### R9 启用心测时的上车规则
- 启用心测：**玩家必须做心测**，且**不能自选角色**；结果（心测答案 + 性格 tag）**车头可见**，由车头**手动分配角色**。
  - `EventDetailPage`：`openJoin()` 打开心测作答 `Sheet`（`submitPsychJoin` 校验答完题后调 `submitPsych`，座位 `status` 置为 `pending`）。
  - 车头在「待分配」座位点「分配角色」，打开 `Sheet` 查看玩家心测结果与 tag，从角色表选或手填（`assignRole`）。
- 不启用心测：玩家**自选角色**，空位显示「**角色名 · 性别**」（`Seat.roleName` / `Seat.gender`）。

#### R10 候补位
- **实现**：`CreateEventPage` 设 `waitlistSize`（步进器）；`EventDetailPage` 支持车头「加候补」（`addWaitlist`，座位 `status:'waitlist'`）、把候补转正（`promoteWaitlist`）、移除（`removeSeat`）。
- 头部人数行显示 `· N 候补`；候补位在座位网格中显示为「候补」+「上车 / 移除」。普通玩家退出候补位保留为 `waitlist` 记录。

#### R11 日历滑动翻页动效 + 拖动不选中文本
- **实现**（`CalendarPage.tsx` + `src/index.css`）：
  - 动效：每次切月 / 周 `setFlip` 递增并在内容容器上 `key={flip}`，套用 `anim-slide-next` / `anim-slide-prev`（基于方向从左右滑入 + 淡入，0.3s 缓动）。`goToday` 同样触发。
  - 不选中文本：鼠标按下拖拽时容器加 `select-none`（React `dragging` 状态），`onMouseUp/onMouseLeave` 移除；拖动后的误点由 `onClickCapture` 吞掉。触摸滑动沿用原 `swipeHandlers`（滑距 > 56px 翻页）。

### 第三批（仓库 / 热度 / 账号）

#### R12 仓库推荐栏鼠标拖动修复
- **实现**：`src/lib/dragscroll.ts` 的 `useDragScroll` 返回 `{ ref, handlers }`，`StorePage` 的横向滚动容器用 `ref={x.ref} {...x.handlers}`，避免与元素自身 `ref` 冲突；推荐位（featured）与新本（new）两个横向区均可鼠标拖动。

#### R13 社交推理热度不设 100 上限
- **实现**：`StorePage` 的 `SocialColumn` 以 `maxHeat` 归一（第一名 = 100%），副标题改为「每月统计一次，相对热度（数字越高越热门）」。

#### R14 登录名永久唯一 + 昵称可改 + uid 展示
- **实现**：
  - 注册 / 改资料双重校验：`signUp`（`local.ts`）与 `updateProfile`（`auth.ts`）均剔除 / 拒绝改动 `username`、`uid`；`updateProfile` 解构去掉身份字段。
  - 服务端 `saveProfile` 的 `PROFILE_FIELDS` 不含 `username`，天然不可变。
  - 昵称随时改（`MePage`）；`UserPage` 展示不可隐藏的 `uid` 与可选的 `@username`（`showUsername` 开关在 `MePage`）。

---

## 五、关键交互流程

### 5.1 关注
`SearchPage` / `UserPage` → `followUser(myId, targetId)` → 双方 `following` / `followers` 双向更新 → 写日志。

### 5.2 匿名点赞
`UserPage` 点赞按钮 → `toggleLike(me.id, target.id)` → 仅更新 `likedUsers` → 不展示给对方。

### 5.3 启用心测的上车
选活动 → `openJoin()` 填姓名 / 联系方式 → 逐题作答（必须答完）→ `submitPsychJoin` → `seats[i].status='pending'` → 车头在「待分配」处 `assignRole` 选 / 填角色 → `status='filled'`，空位显示该角色名与性别。

### 5.4 候补上车
车头「加候补」填姓名 / 联系方式 → 座位 `status='waitlist'` → 有人退出时车头「上车」转正（`promoteWaitlist` 补角色 / 联系方式）或「移除」。

### 5.5 反馈 / issue
FAB → `FeedbackModal` 填写 → `backend.feedback` → 本地存 +（服务端）发邮件到站长邮箱，结果提示是否成功发信。

### 5.6 Excel 批量导入与图片存储

- 后台「批量导入」支持 Excel `.xlsx` 和原有 JSON 数组，统一使用 `src/lib/gameImport.ts` 校验与归一化。Excel 错误精确到工作表行号，JSON 错误精确到数组项。
- 下载的样例包含「字段说明」「示例数据」「完整示例」「取值与错误」四个工作表，覆盖六类玩法、所有 Game 字段、角色与心测 JSON、默认值和常见错误。
- 浏览器通过 File/Blob 上传下载；微信通过 chooseMessageFile、文件系统和 openDocument 处理。ExcelJS 按需加载，业务条目仍通过现有 `mutate` 与 `/api/sync` 持久化。
- 图片目前在端侧压缩为 JPEG data URL，存入 MySQL `documents.data` JSON 字段，不是独立文件；正常部署和容器重建不会覆盖 MySQL 挂载目录中的数据。

---

## 六、后台数据导出格式

`DataPanel`（`AdminPage`）四类导出，均为 UTF-8 CSV、含表头：

| 文件 | 内容 |
|---|---|
| `users.csv` | 用户公开字段（uid / 昵称 / 登录名可见性 / 关注数 / 被关注数 / 角色） |
| `events.csv` | 活动字段（标题 / 本子 / 时间 / 城市 / 人数 / 状态 / 是否心测 / 候补数） |
| `feedbacks.csv` | 反馈 / issue（内容 / 联系方式 / 是否已邮件） |
| `games.csv` | 本子字段（标题 / 类型 / 标签 / 评分 / 是否含心测） |

---

## 七、验收与回归

- 类型检查：`npx tsc --noEmit` 全量通过（0 报错）。
- 构建：`npm run build` 通过，产物落 `dist/`。
- 视觉 / 交互回归：用 Playwright（系统 Edge，`scripts/`）对以下场景截图复检：
  - 窄屏 / 中屏导航栏（R5）；
  - 日历鼠标拖动翻页不选中文本 + 滑入动效（R11）；
  - 仓库推荐栏鼠标拖动（R12）；
  - 用户主页 uid + 点赞 + 关注（R2/R3/R1）；
  - 心测上车 + 车头分配角色（R7–R9）；
  - 候补位增删转正（R10）；
  - 后台数据导出（R4）。

---

## 八、待办 / 备注

- 登录名、昵称和公开 uid 在 MySQL 中有唯一约束；身份字段由服务端校验，不允许通过资料同步篡改。
- 反馈邮件依赖服务端 `smtp` + `feedbackEmail` 配置，仅站长可见；本地模式降级为「仅记录」。
- 当前缓存是单实例进程内缓存。如果以后部署多个后端实例，需要重新评估缓存一致性与认证密钥配置，但当前不提前引入分布式存储。
- 设计文档随实现持续更新，本文档与 `src/types.ts`、`src/store/*`、`src/pages/*`、`backend/` 为权威来源。
