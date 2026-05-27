# 数据库驱动 V1 闭环设计

> 日期：2026-05-27
> 状态：待用户审阅

## 1. 目标

将当前开发版从“前端临时状态 + 部分 mock 数据”推进到“核心业务数据全部由数据库管理”的 V1 闭环。

本阶段包含：

- 会话：聊天记录落库，退出重登后可恢复最近会话。
- 商品：价格看板、问价、下单商品匹配全部读取数据库。
- 订单：自然语言下单、补充信息、确认后创建真实订单；订单页读取数据库。

本阶段不包含：

- 多会话列表与会话切换。
- 订单详情页和复杂状态流转 UI。
- 生产级分页、审计日志、复杂权限矩阵。
- 支付、推送、配送员/分拣员流程。

## 2. 推荐方案

采用“后端主导状态，前端轻量展示”。

后端负责会话、商品、订单和 Agent 状态推进；前端只维护当前页面显示状态。移动端退出重登或刷新后，从后端恢复当前用户的 active conversation 和业务数据。

选择理由：

- Agent 上下文来自数据库，不依赖前端内存。
- 订单创建和订单页展示使用同一份真实数据。
- 商品价格来源统一，价格看板、问价、下单不会各自维护逻辑。
- 后续扩展会话列表、订单详情和权限控制时边界清晰。

## 3. 数据模型

尽量复用现有 schema，不为开发版引入额外复杂表。

### 3.1 conversations

复用现有 `conversations` 表：

- `id`
- `userId`
- `messages jsonb`
- `createdAt`
- `updatedAt`

`messages` 保存结构化消息数组：

```ts
type ConversationMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: AgentIntent;
    orderDraft?: OrderDraft;
    orderId?: string;
    error?: string;
  };
};
```

开发版只维护每个用户最近一个 active conversation。没有会话列表，因此 `GET /api/chat/current` 取最近一条会话；没有则创建。

### 3.2 orderDraft

开发版不新增订单草稿表。订单草稿存放在最近的 assistant message metadata 中，或由后端从最近消息中提取。

```ts
type OrderDraft = {
  buyerName?: string;
  buyerPhone?: string;
  supplierId?: string;
  supplierName?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  deliveryAddress?: string;
  deliveryTime?: string;
  remark?: string;
};
```

确认订单时，后端校验草稿完整性；完整才写入 `orders` 和 `order_items`。

### 3.3 products / supplier_products

复用现有商品和供应商价格表：

- `products`：商品目录、分类、单位、参考价、市场 ID。
- `supplier_products`：供应商商品价格和库存。

开发版商品匹配以关键词为主，例如 `products.name ilike '%土豆%'`。语义检索保留为可选能力，不作为主链路依赖。

### 3.4 orders / order_items

复用现有真实订单表。确认订单后调用 `createOrder` 写入：

- `orders`
- `order_items`

订单列表直接查询真实订单，不再使用 mock 数据。

## 4. 后端 API

### 4.1 Chat

`GET /api/chat/current`

- 需要登录。
- 获取当前用户最近会话。
- 如果没有会话，创建一个空会话。
- 返回：

```ts
{
  conversationId: string;
  messages: ConversationMessage[];
}
```

`POST /api/chat/stream`

- 需要登录。
- 请求：

```ts
{
  conversationId?: string;
  message: string;
}
```

- 后端流程：
  1. 获取或创建 conversation。
  2. 写入用户消息。
  3. 从 DB 中读取历史消息。
  4. 运行 Agent。
  5. 写入 assistant 消息和 metadata。
  6. SSE 返回文本、草稿或订单结果。

前端不再负责传完整历史；历史以数据库为准。

### 4.2 Products

`GET /api/products`

- 需要登录。
- 默认使用当前用户 `marketId`。
- 支持 `search`。
- 返回商品、参考价、可用供应商价格信息。

开发版价格看板使用此接口替换 mock 数据。

### 4.3 Orders

`GET /api/orders`

- 需要登录。
- 根据当前用户角色查询相关订单：
  - buyer：查询 `buyerId = userId`
  - supplier：查询 `supplierId = userId`
  - admin：开发版可查询当前市场所有订单

`POST /api/orders`

- 保留手动创建订单能力。
- Agent 确认订单时也复用同一个 service，不一定暴露给移动端直接调用。

## 5. Agent 工作流

每次用户发送消息，Agent 使用数据库中的 conversation history，而不是只看当前 message。

流程：

1. `recognizeIntent`
   - 结合历史和最新消息判断意图。
   - “确认”“就这个”“可以”在有待确认订单草稿时识别为 `confirm_order`。

2. `extractEntities`
   - 从历史和最新消息中合并商品、数量、联系人、电话、地址、配送时间。
   - 用户分多轮补充信息时，不覆盖已确认字段。

3. `retrieveContext`
   - 下单和问价走 product service。
   - 查询订单走 order service。

4. `generateResponse`
   - 如果下单信息不完整，只询问缺失字段。
   - 如果信息完整，展示订单草稿并请求确认。
   - 如果用户确认且草稿完整，创建真实订单并返回订单号。

5. 消息持久化
   - user message 在 Agent 前写入。
   - assistant message 在 Agent 后写入。
   - 失败也写入 assistant error 消息，方便前端和后续排查。

## 6. 前端改造

### 6.1 首页聊天

页面加载时：

1. 调用 `GET /api/chat/current`。
2. 将返回 messages 映射为本地 `ChatMessage[]`。
3. 保存 `conversationId`。

发送消息时：

1. 本地先追加用户消息，提升交互反馈。
2. 调用 `POST /api/chat/stream`，只传 `conversationId` 和 `message`。
3. SSE 返回过程中更新 streamingText。
4. done 后追加 assistant 消息。
5. 后端已经完成持久化，前端无需自己保存历史。

### 6.2 订单页

移除 `mockOrders`。

页面加载时调用 `GET /api/orders`，展示真实订单：

- 订单号
- 商品摘要
- 状态
- 对方名称
- 金额

开发版筛选可以先在前端对已加载数据过滤。

### 6.3 价格页

移除 `mockProducts`。

页面加载时调用 `GET /api/products`，搜索时带 `search` 参数。展示：

- 商品名
- 分类
- 单位
- 参考价
- 供应商价或库存信息

### 6.4 登录与退出

登录成功后跳转首页，首页自动加载当前会话。

退出登录只清理本地 token 和用户信息，不删除数据库会话。

## 7. 错误处理

- 请求失败：前端显示明确错误，不无限 loading。
- SSE error event：显示为 assistant 错误消息。
- 商品匹配失败：Agent 要求用户换更具体商品名。
- 确认订单但缺字段：只询问缺失字段，不重置上下文。
- 创建订单失败：写入 assistant error 消息，并返回给前端。
- DB 写入失败：返回错误事件，前端显示“服务端保存失败”。

## 8. 验收标准

1. 退出并重新登录后，首页能恢复最近聊天记录。
2. “帮我下单十斤土豆” -> “小王 18089333333 西安市钟楼 明天中午12点” -> “确认” 能创建订单。
3. 创建成功后，订单页能看到刚创建的订单。
4. 价格页展示 seed 中的商品和价格，不再使用 mock 数据。
5. 问“土豆多少钱”时，Agent 返回数据库中的价格信息。
6. 后端日志显示会话从 DB 读取和写入。
7. `pnpm lint` 通过。
8. `pnpm build` 通过。

## 9. 实施边界

本设计适合一个开发版 V1 实施计划。实现时应按以下顺序推进：

1. 后端会话 service 和 `/api/chat/current`。
2. `POST /api/chat/stream` 改为 DB history 驱动。
3. Agent 下单草稿和确认创建订单。
4. 订单 API 查询角色修正和移动端订单页接入。
5. 商品 API 默认按登录用户市场查询，移动端价格页接入。
6. 端到端验证和必要 bugfix。
