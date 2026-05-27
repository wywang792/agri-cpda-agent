export const knowledgeBase = [
  { id: 'faq-1', question: '如何下单？', answer: '通过语音或文字告诉我要购买的商品和数量，例如"来100斤土豆送到老王那边"。' },
  { id: 'faq-2', question: '如何查询订单？', answer: '直接告诉我您想查的订单信息，例如"昨天那单送到没"。' },
  { id: 'faq-3', question: '如何查看价格？', answer: '问"土豆现在多少钱"，或点击首页的"价格看板"。' },
  { id: 'faq-4', question: '订单状态有哪些？', answer: '待确认、已确认、分拣中、已分拣、配送中、已完成、已取消。' },
];

export async function findRelevantKnowledge(query: string, limit: number = 3) {
  return knowledgeBase.slice(0, limit);
}
