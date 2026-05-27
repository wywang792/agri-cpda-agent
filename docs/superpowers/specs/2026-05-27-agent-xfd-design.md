# 农产品订单 Agent — 设计文档

> 日期：2026-05-27
> 状态：待用户确认

## 1. 项目概述

基于现有农产品订单汇聚平台，开发一款 **Agent 驱动的手机 APP**。用户（采购商和供应商）通过语音或自然语言完成下单、查询、分拣、发货等业务操作。

### 1.1 核心理念

- **Agent 优先**：聊天为主交互界面，快捷操作为辅
- **统一订单**：不区分采购单/供货单，核心是"谁给谁买了什么"
- **学习导向**：项目同时作为 LangGraph.js、LangChain.js、RAG、Drizzle、pgvector、SSE 等技术的学习载体

## 2. 用户角色

| 角色 | 说明 | 典型操作 |
|------|------|----------|
| 采购商 | 批发商/零售商，向供应商采购商品 | "来100斤土豆送到老王那边" |
| 供应商 | 商品供应方，可代客下单 | "帮张三下50斤白菜" |
| 管理员 | 平台管理人员（V1 可通过后台操作） | 管理商品库、调价、查看报表 |

两者的下单流程完全对称，系统通过角色自动判断发起方。

## 3. 订单模型

### 3.1 统一订单结构

```typescript
// 核心字段
{
  id: string;              // 订单ID
  orderId: string;         // 业务订单号
  creatorId: string;       // 下单人ID（采购商或供应商）
  creatorRole: 'buyer' | 'supplier';  // 下单人角色
  buyerId: string;         // 采购商ID
  supplierId: string;      // 供应商ID
  items: OrderItem[];      // 商品明细
  totalPrice: number;      // 订单总价
  status: OrderStatus;     // 订单状态
  deliveryAddress: string; // 配送地址
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 订单状态流转

```
待确认(pending) → 已确认(confirmed) → 分拣中(sorting) → 已分拣(sorted)
  → 配送中(delivering) → 已完成(completed)
                                                  ↘ 已取消(cancelled)
```

> V1 阶段分拣员和配送员不在范围内，但状态字段已预留。

## 4. 商品与价格模型

### 4.1 混合定价

- **统一商品库**：平台维护商品目录（名称、分类、单位、参考价）
- **供应商自定义价**：每个供应商可为商品设置自己的价格
- **参考价**：平台价格作为参考基准，实际价格以供应商为准

```typescript
// 商品
interface Product {
  id: string;
  name: string;           // 商品名称
  category: string;       // 分类
  unit: string;           // 单位（斤/箱/袋）
  referencePrice: number; // 平台参考价
  embedding?: number[];   // pgvector 语义向量
}

// 供应商商品定价
interface SupplierProduct {
  supplierId: string;
  productId: string;
  price: number;          // 供应商自定义价格
  stock: number;          // 库存
}
```

## 5. 技术架构

### 5.1 整体架构

```
┌─────────────────────────────────┐
│     📱 React Native App         │
│  Agent 优先 + 快捷操作 UI        │
└───────────┬─────────────────────┘
            │ SSE 流式 + REST API
┌───────────┴─────────────────────┐
│     🔧 Hono Server (模块化单体)   │
│                                 │
│  ┌──────────┐ ┌──────────────┐  │
│  │ 业务模块  │ │  Agent 模块   │  │
│  │ 订单 CRUD │ │ LangGraph    │  │
│  │ 用户认证  │ │ 意图识别      │  │
│  │ 商品管理  │ │ 实体提取      │  │
│  │ 价格管理  │ │ 工具调用      │  │
│  └──────────┘ └──────────────┘  │
│                                 │
│  ┌──────────────────────────┐   │
│  │        RAG 模块           │   │
│  │  商品语义检索 / 价格知识库  │   │
│  │  订单历史检索 / Embedding  │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │      LLM 抽象层           │   │
│  │  LangChain.js + DeepSeek  │   │
│  │  (可切换 OpenAI 等)       │   │
│  └──────────────────────────┘   │
└───────────┬─────────────────────┘
            │ Drizzle ORM
┌───────────┴─────────────────────┐
│   🐘 PostgreSQL + pgvector      │
│   业务数据 + 向量嵌入 + 全文搜索   │
└─────────────────────────────────┘
            │
┌───────────┴─────────────────────┐
│   🤖 DeepSeek API (默认)        │
│   可切换 OpenAI / 国产模型        │
└─────────────────────────────────┘
```

### 5.2 技术栈明细

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React Native + Expo | 移动端 APP，跨平台 |
| 后端 | Hono | 轻量高性能 Web 框架 |
| Agent 工作流 | LangGraph.js | 有状态多步骤工作流编排 |
| LLM 交互 | LangChain.js | Prompt 管理、工具调用、模型抽象 |
| 数据库 | PostgreSQL + pgvector | 业务数据 + 向量语义搜索 |
| ORM | Drizzle ORM | 类型安全的数据库操作 |
| 语音 | 系统 STT API / 第三方 | 语音转文字（前端处理） |
| 流式通信 | SSE (Server-Sent Events) | Agent 回复流式输出 |
| 语言 | TypeScript (全栈) | 前后端统一语言 |

### 5.3 LLM 配置

```typescript
// 可配置的 LLM 抽象层
interface LLMConfig {
  provider: 'deepseek' | 'openai' | 'qwen' | 'zhipu';
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

// 默认配置
const defaultConfig: LLMConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
};
```

## 6. Agent 工作流设计

### 6.1 LangGraph 工作流图

```
                    ┌──────────────┐
                    │  接收用户消息  │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │   意图识别     │
                    │ (LLM 分类)    │
                    └──────┬───────┘
                           ▼
            ┌──────┬───────┼───────┬──────┐
            ▼      ▼       ▼       ▼      ▼
         [下单]  [查询]   [问价]  [确认]  [闲聊]
            │      │       │       │      │
            ▼      ▼       ▼       ▼      ▼
         实体    RAG     RAG     执行    友好
         提取    订单     价格    下单    回复
            │    检索     检索     │      │
            ▼      │       │      ▼      │
         RAG      ▼       ▼    写入DB    │
         商品    生成     生成     │      │
         检索    结果     结果     ▼      │
            │      │       │   返回     │
            ▼      │       │   成功     │
         验证      │       │      │      │
         库存      │       │      │      │
            │      │       │      │      │
            ▼      ▼       ▼      ▼      ▼
                    ┌──────────────┐
                    │  SSE 流式返回  │
                    └──────────────┘
```

### 6.2 意图分类

| 意图 | 示例 | 处理方式 |
|------|------|----------|
| `place_order` | "来100斤土豆送到老王那边" | 实体提取 → RAG检索 → 验证 → 确认卡片 |
| `query_order` | "昨天那单送到没？" | RAG订单检索 → 返回状态 |
| `ask_price` | "土豆现在多少钱？" | RAG价格检索 → 返回价格信息 |
| `confirm_order` | "确认" / "就这个" | 执行下单 → 写入DB |
| `recommend` | "今天买点啥好？" | RAG热销商品 → 推荐列表 |
| `alert` | (系统触发) | 库存/价格异常 → 推送提醒 |
| `chat` | "你好" | 友好闲聊回复 |

### 6.3 RAG 检索策略

1. **商品检索**：用户说"土豆"，通过 pgvector 语义搜索匹配商品库（也能匹配"马铃薯"）
2. **价格检索**：找到商品后，查询该供应商/平台的当前价格
3. **订单检索**：解析时间范围（"昨天"）+ 关联方（"老王"）+ 状态，组合查询
4. **知识库**：常见问答、平台规则、配送政策等 Embedding 后存入向量库

### 6.4 工具定义（LangChain Tools）

```typescript
// Agent 可调用的工具
const tools = [
  createOrder,        // 创建订单
  queryOrders,        // 查询订单列表
  getOrderDetail,     // 获取订单详情
  searchProducts,     // 搜索商品（RAG语义搜索）
  getPrice,           // 查询价格
  getStock,           // 查询库存
  confirmOrder,       // 确认订单
  cancelOrder,        // 取消订单
  getRecommendations, // 获取推荐商品
];
```

## 7. APP 界面设计

### 7.1 页面结构

| 页面 | 说明 |
|------|------|
| 首页（Agent） | 聊天主界面 + 顶部快捷入口 |
| 订单确认 | Agent 解析后展示结构化订单卡片 |
| 订单列表 | 按状态筛选，支持搜索 |
| 价格看板 | 商品搜索 + 价格列表 + 涨跌对比 |
| 我的 | 个人信息、设置、切换角色 |

### 7.2 底部导航

```
[首页(Agent)] [订单] [价格] [我的]
```

### 7.3 首页布局

```
┌─────────────────────────┐
│  📦今日订单  ⚡快速下单  💰价格看板  │  ← 快捷入口
├─────────────────────────┤
│                         │
│  ┌───────────────┐      │
│  │ 帮我查下老王   │      │  ← 用户消息
│  │ 昨天的单       │      │
│  └───────────────┘      │
│                         │
│      ┌───────────────┐  │
│      │ 王记蔬果昨日   │  │  ← Agent 回复
│      │ 2单，共￥3,200 │  │
│      └───────────────┘  │
│                         │
├─────────────────────────┤
│ [说点什么...]        [🎤] │  ← 输入框 + 语音按钮
└─────────────────────────┘
```

### 7.4 交互流程

1. **文字下单**：用户输入 → SSE 流式显示 Agent 回复 → 展示确认卡片 → 用户确认 → 订单创建
2. **语音下单**：按语音按钮 → 系统 STT 转文字 → 填入输入框 → 用户确认发送 → 同上
3. **快捷下单**：点击"快速下单" → 弹出简易表单（选商品、填数量）→ 直接创建

## 8. 数据库设计

### 8.1 核心表

```sql
-- 用户表
users (id, username, password_hash, role, market_id, created_at)

-- 市场表（多租户）
markets (id, name, address, created_at)

-- 商品表（含向量嵌入）
products (id, name, category, unit, reference_price, embedding vector(1536), market_id)

-- 供应商商品定价
supplier_products (supplier_id, product_id, price, stock)

-- 订单表
orders (id, order_no, creator_id, creator_role, buyer_id, supplier_id,
        total_price, status, delivery_address, remark, market_id, created_at, updated_at)

-- 订单商品明细
order_items (id, order_id, product_id, quantity, unit_price, subtotal)

-- 对话历史
conversations (id, user_id, messages jsonb, created_at, updated_at)
```

### 8.2 向量索引

```sql
-- pgvector 向量索引，用于 RAG 语义搜索
CREATE INDEX ON products USING ivfflat (embedding vector_cosine_ops);
```

## 9. 项目结构

```
agent-xfd/
├── apps/
│   ├── mobile/                 # React Native APP
│   │   ├── src/
│   │   │   ├── screens/        # 页面
│   │   │   ├── components/     # 组件
│   │   │   ├── hooks/          # 自定义 hooks
│   │   │   ├── services/       # API 调用
│   │   │   └── store/          # 状态管理
│   │   └── app.json
│   └── server/                 # Hono 后端
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/       # 认证模块
│       │   │   ├── order/      # 订单模块
│       │   │   ├── product/    # 商品模块
│       │   │   ├── price/      # 价格模块
│       │   │   └── agent/      # Agent 模块
│       │   │       ├── graph.ts        # LangGraph 工作流
│       │   │       ├── intent.ts       # 意图识别
│       │   │       ├── entities.ts     # 实体提取
│       │   │       ├── tools/          # Agent 工具
│       │   │       └── prompts/        # Prompt 模板
│       │   ├── rag/
│       │   │   ├── embeddings.ts       # Embedding 生成
│       │   │   ├── retriever.ts        # 检索器
│       │   │   └── knowledge.ts        # 知识库管理
│       │   ├── db/
│       │   │   ├── schema.ts           # Drizzle Schema
│       │   │   ├── migrations/         # 数据库迁移
│       │   │   └── index.ts            # DB 连接
│       │   ├── llm/
│       │   │   ├── provider.ts         # LLM 抽象层
│       │   │   └── config.ts           # 模型配置
│       │   └── index.ts                # 入口
│       └── package.json
├── packages/
│   └── shared/                 # 前后端共享类型
│       └── types.ts
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-27-agent-xfd-design.md
├── package.json                # Monorepo 根配置
├── turbo.json                  # Turborepo 配置
└── .gitignore
```

## 10. Monorepo 管理

使用 **Turborepo** 管理 monorepo：

- `apps/mobile` — React Native APP
- `apps/server` — Hono 后端
- `packages/shared` — 共享类型定义

包管理器：**pnpm**

## 11. 学习目标映射

| 技术 | 在项目中的学习点 |
|------|------------------|
| LangGraph.js | 有状态工作流、条件分支、人工确认节点 |
| LangChain.js | Prompt 模板、Function Calling、模型切换 |
| RAG | Embedding 生成、向量检索、上下文注入 |
| 意图识别 | LLM 分类、混合规则策略 |
| Drizzle ORM | Schema 定义、类型安全查询、迁移管理 |
| pgvector | 向量存储、相似度搜索、索引优化 |
| SSE | 流式输出、前端 EventSource、错误处理 |

## 12. V1 范围边界

### 包含

- [x] 用户注册/登录（账号密码）
- [x] Agent 聊天界面（文字 + 语音输入）
- [x] 自然语言下单（意图识别 + 实体提取 + 确认）
- [x] 订单查询（"昨天那单"）
- [x] 价格查询（"土豆多少钱"）
- [x] 智能推荐 & 补全
- [x] 异常提醒（库存不足、价格波动）
- [x] 快捷入口（今日订单、快速下单、价格看板）
- [x] 订单状态流转（含预留分拣/配送状态）
- [x] RAG 商品语义检索
- [x] 多市场架构（V1 单市场数据）

### 不包含（后续版本）

- [ ] 分拣员操作界面
- [ ] 配送员接单/签收
- [ ] 支付集成
- [ ] 报表/数据分析
- [ ] 微信登录
- [ ] 消息推送
