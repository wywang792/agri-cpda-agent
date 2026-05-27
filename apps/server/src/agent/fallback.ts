import type { AgentIntent } from '@agent-xfd/shared';
import type { ExtractedEntities } from './types.js';

export function recognizeIntentByRules(message: string): AgentIntent {
  if (/确认|就这个|可以|同意/.test(message)) return 'confirm_order';
  if (/取消|撤销|不要了/.test(message)) return 'cancel';
  if (/推荐|买什么|买点啥|什么好/.test(message)) return 'recommend';
  if (/多少钱|价格|价钱|报价/.test(message)) return 'ask_price';
  if (/订单|送到|状态|昨天|今天|历史/.test(message) && /查|看|到没|有没有/.test(message)) return 'query_order';
  if (/下单|采购|购买|来\s*\d+|要\s*\d+|\d+\s*(斤|箱|袋)/.test(message)) return 'place_order';
  return 'chat';
}

export function extractEntitiesByRules(message: string): ExtractedEntities {
  const itemMatches = Array.from(message.matchAll(/([\u4e00-\u9fa5A-Za-z]+)\s*(\d+(?:\.\d+)?)\s*(斤|箱|袋|个|件)?/g));
  const items = itemMatches.map((match) => ({
    name: match[1],
    quantity: Number(match[2]),
    unit: match[3] || '斤',
  }));

  return {
    items,
    buyer: null,
    supplier: null,
    deliveryAddress: null,
    timeRange: /昨天/.test(message) ? '昨天' : /今天/.test(message) ? '今天' : null,
  };
}

export function generateFallbackResponse(params: {
  intent: AgentIntent | null;
  message: string;
  context?: string;
}): string {
  const { intent, message, context } = params;

  if (intent === 'ask_price') {
    return context
      ? `我查到这些价格信息：\n${context}`
      : '我还没查到对应商品价格。你可以换个更具体的商品名试试，比如“土豆多少钱”。';
  }

  if (intent === 'query_order') {
    return context || '暂时没有查到相关订单。';
  }

  if (intent === 'place_order') {
    return context
      ? `我先帮你整理一下下单信息：\n${context}\n请再确认采购方、供应商和配送地址。`
      : '可以，我需要商品、数量、供应商和配送地址，例如“来100斤土豆送到城东仓库”。';
  }

  if (intent === 'recommend') {
    return context || '我可以根据近期商品和价格帮你推荐。你想偏便宜、热销，还是按某个品类推荐？';
  }

  return `收到：${message}`;
}
