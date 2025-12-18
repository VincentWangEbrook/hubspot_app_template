# HubSpot App Integration Project Rules
 
## Git Workflow Rules
 
### Branch Synchronization

- 开发分支同步 develop 分支时，**必须使用 rebase**
- 禁止使用 `git merge develop`

流程：
1. `git checkout feature-branch`
2. `git fetch origin`
3. `git rebase origin/develop`

冲突处理：
- 允许在 rebase 过程中解决冲突
- 如遇到无法解决的问题，必须使用 `git rebase --abort` 回退
- 禁止在未完成 rebase 的情况下提交代码
- rebase 过程中禁止切换分支

推送规则：
- rebase 后如需更新远程分支，**仅允许使用**
  `git push --force-with-lease`
- 禁止使用 `git push --force`
 
### Remote Repository

为保证团队协作一致性和自动化工具的可预测性，
项目统一约定标准的 Git remote 命名规则。

- 默认远程仓库名称为 `origin`
- 在 fork 场景下：
  - `origin` 表示个人 fork 仓库（可 push）
  - `upstream` 表示代码权威主仓库（仅 pull / fetch）
- 未经团队说明，不得使用非标准 remote 名称（如 `ebrook`）

该约定的目的在于：
- 避免 remote 命名混乱
- 降低误操作风险
- 保障 CI / Cursor / MCP 自动化流程稳定运行

示例：
- 正确：`git push origin feature-branch`
- 错误：`git push ebrook feature-branch`

### Pull Request Draft

- 创建 PR 前，必须先生成 PR 描述草稿
- 草稿必须以 Markdown 形式展示给发起人确认
- 确认方式：
  - 明确回复 “确认创建 PR”
  - 或显式修改后确认

在未确认前：
- 禁止调用 GitHub API 创建 PR 或创建 Draft PR

### Pull Request Creation Method

- 必须使用 GitHub REST API 创建 PR
- 禁止使用 `gh pr create`

原因：
- 保证 PR 创建流程可审计
- 便于自动化工具（Cursor / MCP）介入
- 避免本地 CLI 状态差异导致的隐式行为

### Base Branch Rules

- 所有 PR 必须指向 `develop`
- 禁止直接向 `develop` push
- 如需 hotfix，必须走 PR 流程

### HubSpot Integration Specific Rules

- 涉及 OAuth / scopes 变更的 PR，必须在描述中说明：
  - 新增 / 移除的 scopes
  - 影响的 HubSpot App（erp_import / line_chat）

- 涉及 tenant / token / OAuth 回调逻辑的 PR：
  - 必须说明多租户隔离是否受影响
  
- 涉及 OAuth scopes 变更的 PR，必须确认已在 HubSpot App 配置中同步更新

## Final Human Confirmation

- [ ] I have reviewed CI results and Bugbot feedback
- [ ] I confirm this PR is safe to merge
- [ ] 
---

<details>
<summary>🤖 Bugbot Review Instructions (DO NOT REMOVE)</summary>

You are reviewing a HubSpot integration Pull Request.

Please perform a strict review focusing on:

1. Git discipline
- No direct develop modifications
- No merge commits from develop
- Rebase-based history only

2. HubSpot OAuth & Scopes
- Detect scopes changes
- Verify scopes are minimal
- Ensure scopes are synced with HubSpot App settings

3. Multi-tenant Safety
- Token isolation per tenant
- No cross-tenant data leakage
- search_path or tenant scoping correctness

4. Security
- OAuth redirect URI validation
- Refresh token safety
- No secrets in logs

5. Integration correctness
- ERP import idempotency
- Retry & failure handling
- Partial sync safety

Output format:
- Summary
- ❌ Blockers
- ⚠️ Risks
- ✅ Suggestions

</details>
