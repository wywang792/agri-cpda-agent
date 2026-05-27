import { retrieveProducts, retrieveOrders } from '../rag/retriever.js';
import { findRelevantKnowledge } from '../rag/knowledge.js';
import type { AgentState } from './types.js';

export async function retrieveContext(state: AgentState): Promise<Partial<AgentState>> {
  let context = '';

  switch (state.intent) {
    case 'place_order':
    case 'ask_price': {
      const query = state.entities?.items.map((i) => i.name).join(' ') || state.message;
      const prods = await retrieveProducts(query, state.marketId);
      if (prods.length > 0) {
        context += '相关商品：\n';
        for (const p of prods) {
          context += `- ${p.name} (${p.category}) 参考价: ￥${p.referencePrice}/斤\n`;
        }
      }
      break;
    }
    case 'query_order': {
      const ords = await retrieveOrders(state.userId, state.userRole, { timeRange: state.entities?.timeRange || undefined });
      if (ords.length > 0) {
        context += '相关订单：\n';
        for (const o of ords.slice(0, 5)) {
          context += `- 订单${o.orderNo} | 状态: ${o.status} | 金额: ￥${o.totalPrice}\n`;
        }
      } else {
        context = '未找到相关订单。';
      }
      break;
    }
    case 'recommend': {
      const prods = await retrieveProducts('热销推荐', state.marketId, 5);
      if (prods.length > 0) {
        context += '推荐商品：\n';
        for (const p of prods) context += `- ${p.name}\n`;
      }
      break;
    }
    default: {
      const knowledge = await findRelevantKnowledge(state.message);
      if (knowledge.length > 0) {
        context += '相关知识：\n';
        for (const k of knowledge) context += `- 问：${k.question}\n  答：${k.answer}\n`;
      }
      break;
    }
  }
  return { context };
}
