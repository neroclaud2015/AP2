# Firebase 配置：Google 账号同步

当前代码、规则与本地测试已实现，但仓库没有真实 Firebase 项目配置。页面应显示未配置，不会模拟登录或声称真实两设备同步成功。本阶段无需服务端管理员密钥、Admin SDK 或服务账号。

## 七步控制台设置

1. **创建项目**：打开 [Firebase Console](https://console.firebase.google.com/)，选择「添加项目」。选择自己的项目名。Google Analytics 对此功能不是必需，可不启用。先使用适合个人验证的方案；不要为本任务创建其他后端或上传题库。
2. **启用 Google 登录**：项目中打开「Build → Authentication → Get started → Sign-in method」，启用 Google，填写项目支持邮箱并保存。在「Settings → Authorized domains」加入 `neroclaud2015.github.io`；本地开发需要时另加 `localhost`。域名不带协议、路径或仓库名称。只启用本阶段所需的 Google 提供方。
3. **创建 Firestore**：打开「Build → Firestore Database → Create database」。选择 Cloud Firestore 的标准数据库与适合自己的区域；区域确定后不应随意更换。选择生产模式，不使用允许所有人读写的测试规则。无需预建集合，客户端会在登录并明确迁移后写入 `users/{uid}/...`。
4. **发布安全规则和索引设置**：打开 Firestore 的「Rules」，用仓库根目录完整的 [firestore.rules](../firestore.rules) 替换默认内容，再点击「Publish」。规则仅允许 Firebase uid 对应的私人路径，拒绝匿名和跨用户访问，约束 revision、cursor 与历史字段。`firestore.indexes.json` 关闭大块个人正文的自动索引；可在确认项目后用 Firebase CLI 部署规则与索引：`firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID`。不要部署到示例 `demo-ap2-sync` 以外的项目，除非已确认是自己的目标项目。
5. **获取 Web App 配置**：打开「Project settings（齿轮）→ General → Your apps」，添加 Web App（`</>`）。无需启用 Firebase Hosting；现有网站仍在 GitHub Pages。选择 SDK setup and configuration → Config，复制 `apiKey`、`authDomain`、`projectId`、`appId`，以及可选的 `messagingSenderId`、`storageBucket`。
6. **只配置公开 Web 字段**：将 `.env.example` 复制为未提交的 `.env.local`，填写下面的变量并重新构建。GitHub Pages 已预留同名构建变量：仓库 Settings → Secrets and variables → Actions → Variables → New repository variable，逐项填写公开 `VITE_...` 值，然后重新运行 Pages 工作流。未填写时保持未配置。可以把 Web config 的这六个公开字段提供给维护者；Firebase Web API key 是项目标识配置，不是个人数据的授权凭据，真正的数据隔离由登录 UID 和 Rules 完成。限制该 API key 用于项目需要的 Firebase API，不复用其他服务的敏感 key。
7. **配置后再做真实验收**：Windows 用 Google 登录，查看本地数据数量摘要并明确确认迁移；Android/iPad 用同一 Google 账号登录。检查双方 uid 相同，分别新增进度、notes、attempt 和 test，离线修改后重连，检查重复重试与冲突提示、退出账号后本地学习仍可用。完成前不要写「真实跨设备云同步已通过」。

## 前端变量

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
# 以下可选，与 Web config 保持一致
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_STORAGE_BUCKET=
```

**绝不能提供或提交**：service account JSON、`private_key`、Firebase Admin SDK 凭据、Google 服务账号私钥、OAuth client secret、任何服务器管理员 key。这里没有服务端管理员凭据入口，也不需要这些信息。Firebase 自动管理登录凭据；不要把 ID token、refresh token、个人数据或导出的学习备份放入 GitHub。

## 数据和同步合同

- `users/{uid}/records/{sha256(entity + NUL + stableId)}`：七类个人实体的 envelope（revision、cursor、deviceId、updatedAt、value 或 tombstone），以及历史不可变字段的保护数据。
- `users/{uid}/sync/state`：账号级事务计数器。每次成功变更与记录一起原子提交，pull 使用 cursor 分页。时间不参与覆盖判定。
- `users/{uid}/mutations/{sha256(mutationId)}`：不可变重试收据。相同 mutation 重试不增加记录；相同 ID 携带不同内容会拒绝。
- `users/{uid}/conflicts/{sha256(mutationId)}`：保留提交版本与当时远端版本，不自动最后写入覆盖。用户明确选择后发送新 mutation 与当前 baseRevision。
- `users/{uid}/devices/{deviceId}`：设备名、创建和最后活动时间，预留 revoked_at。此阶段退出是 Firebase sign-out；不是完整的远程设备撤销或管理员系统。

IndexedDB 仍负责离线写入。Firestore transaction 的网络失败不会使本地学习失败，未确认的变更继续留在客户端队列。切换账号时 transport 固定 expectedUid 并在异步边界重新检查，不能把旧队列发送到新账户。Google 初始化异常回落本地模式，登录按钮会给出错误。

attempt 原始答案和来源不可更改，仅允许显式 notes/error/confidence 注释。TestSession 的题目、来源与已提交答案不可重写；已完成 U 题自评、结果汇总与 discard/restore 生命周期仍可同步。题库本身不上传。

删除通过带版本 tombstone 同步；UI 记录不再出现、不能普通恢复。重试收据、冲突快照及不可变历史保护数据可能仍保留此前内容；这不是所有云端审计字节的擦除接口。严格云端擦除需后续单独设计，不声称当前已实现。

## 验证与边界

本地纯策略/transport 模拟测试验证缺配置、认证初始化失败回落、UID 切换、CAS、重试、删除和冲突。另有真实 Firestore Emulator 规则和真实 SDK transaction 测试，它们与真实 Google 登录/云服务验收不同。

需 Node、Java 21，以及仓库 devDependencies：

```sh
npx firebase emulators:exec --only firestore --project demo-ap2-sync "node --test firebase/rules.emulator.mjs && npx vitest run firebase/transport.emulator.test.ts"
```

普通 `npm test` 没有模拟器时会明确跳过 emulator integration；不伪造 Rules 成功。模拟器测试只使用 demo 项目，不需要真实 Firebase 配置。没有部署过真实项目，也未进行真实 Windows ↔ Android/iPad 云验收。

官方参考：[Google 登录](https://firebase.google.com/docs/auth/web/google-signin)、[Web 初始化](https://firebase.google.com/docs/web/setup)、[Firestore 事务](https://firebase.google.com/docs/firestore/manage-data/transactions)、[安全规则](https://firebase.google.com/docs/firestore/security/rules-conditions)、[Firebase API keys](https://firebase.google.com/docs/projects/api-keys)。
