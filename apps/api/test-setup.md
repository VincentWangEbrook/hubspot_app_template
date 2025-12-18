# 测试设置说明

## 运行测试

### 安装依赖（如果尚未安装）

```bash
pnpm install
```

### 运行所有测试

```bash
# 在 apps/api 目录下
pnpm test

# 或在项目根目录
pnpm --filter api test
```

### 运行特定测试文件

```bash
pnpm test -- line.adapter.spec.ts
pnpm test -- chat.service.spec.ts
```

### 运行测试并生成覆盖率报告

```bash
pnpm test:cov
```

### 监听模式（开发时使用）

```bash
pnpm test:watch
```

## 测试状态

当前所有测试应该**失败（RED）**，因为实际的实现代码尚未创建。

### 预期失败的测试文件：

1. ✗ `channel/adapters/__tests__/line.adapter.spec.ts` - LineChannelAdapter 未实现
2. ✗ `chat/__tests__/chat.service.spec.ts` - ChatService 未实现
3. ✗ `chat/__tests__/chat.controller.spec.ts` - ChatController 需要更新
4. ✗ `chat/__tests__/chat.gateway.spec.ts` - ChatGateway 需要扩展
5. ✗ `webhook/__tests__/webhook.controller.spec.ts` - WebhookController 未实现
6. ✗ `channel/__tests__/channel-adapter.factory.spec.ts` - ChannelAdapterFactory 未实现

## 测试覆盖范围

### Happy Path（正常流程）
- ✓ 发送消息到 LINE 用户
- ✓ 接收来自 LINE 用户的消息
- ✓ 获取对话列表
- ✓ 从 Contact 初始化对话
- ✓ WebSocket 实时消息推送

### Edge Cases（边缘情况）
- ✓ LINE API 限流 (429)
- ✓ 用户封锁 Bot
- ✓ 网络超时重试
- ✓ Webhook 签名验证失败
- ✓ 重复消息去重
- ✓ 消息内容超长处理
- ✓ Channel 不存在自动创建
- ✓ HubSpot 同步失败
- ✓ 租户权限验证
- ✓ Contact 未绑定 LINE

## 下一步

1. **实现数据库 Migration**（根据设计文档 Section 3）
2. **实现 IChannelAdapter 接口**
3. **实现 LineChannelAdapter**
4. **实现 ChatService**
5. **实现 ChatController**
6. **实现 WebhookController**
7. **运行测试确保通过（GREEN）**
8. **重构代码（REFACTOR）**

## TDD 流程

```
RED → GREEN → REFACTOR
 ↑               ↓
 └───────────────┘
```

当前阶段：**RED** ⭕

目标：实现代码使测试通过（GREEN ✅）
