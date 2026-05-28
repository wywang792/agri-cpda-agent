import type { AgentIntent, Order } from '@agent-xfd/shared';
import type { OrderDraft } from '../modules/chat/types.js';
import type { ExtractedEntities } from './types.js';

type HistoryEntry = { role: 'user' | 'assistant'; content: string };

export function formatHistory(history: HistoryEntry[] = [], limit = 10): string {
  return history
    .slice(-limit)
    .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.content}`)
    .join('\n');
}

function getConversationText(message: string, history: HistoryEntry[] = []): string {
  return `${formatHistory(history)}\n用户：${message}`;
}

function hasActiveOrderContext(history: HistoryEntry[] = []): boolean {
  const text = formatHistory(history, 8);
  return /下单|订单|商品明细|确认下单|配送|收货|土豆|白菜|西红柿|胡萝卜|黄瓜|[一二两三四五六七八九十百千万\d]+\s*(斤|箱|袋)/.test(text);
}

export function recognizeIntentByRules(message: string, history: HistoryEntry[] = []): AgentIntent {
  if (/确认|就这个|可以|同意|没问题/.test(message) && hasActiveOrderContext(history)) return 'confirm_order';
  if (/取消|撤销|不要了/.test(message)) return 'cancel';
  if (/(新增|添加|增加|保存|维护|设置).*(地址|收货地址)|地址.*(新增|添加|增加|保存|维护|默认)|设为默认地址|默认收货地址/.test(message)) return 'manage_address';
  if (/推荐|买什么|买点啥|什么好/.test(message)) return 'recommend';
  if (/多少钱|价格|价钱|报价/.test(message)) return 'ask_price';
  if (/订单|送到|状态|昨天|今天|历史/.test(message) && /查|看|到没|有没有|查询/.test(message)) return 'query_order';
  if (/下单|采购|购买|来\s*[一二两三四五六七八九十百千万\d]+|要\s*[一二两三四五六七八九十百千万\d]+|送\s*[一二两三四五六七八九十百千万\d]+|[一二两三四五六七八九十百千万\d]+\s*(斤|箱|袋)/.test(message)) return 'place_order';
  if (hasActiveOrderContext(history) && /电话|地址|送|明天|今天|中午|下午|上午|\d{11}/.test(message)) return 'place_order';
  return 'chat';
}

function parseChineseNumber(value: string): number {
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  const digits: Record<string, number> = {
    零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
  let total = 0;
  let section = 0;
  let current = 0;

  for (const char of value) {
    if (char in digits) {
      current = digits[char];
      continue;
    }

    const unit = units[char];
    if (!unit) continue;
    if (unit === 10000) {
      section = (section + current) * unit;
      total += section;
      section = 0;
    } else {
      section += (current || 1) * unit;
    }
    current = 0;
  }

  return total + section + current;
}

function cleanProductName(value: string): string {
  return value
    .replace(/^(帮我|我要|我想|请|下单|采购|购买|买|来|要|送|订|点)+/, '')
    .replace(/[，。,.、\s]+$/g, '')
    .replace(/和$/g, '')
    .trim();
}

function findItems(text: string): ExtractedEntities['items'] {
  const items: ExtractedEntities['items'] = [];
  const seen = new Set<string>();
  const itemPattern = /([一二两三四五六七八九十百千万\d]+(?:\.\d+)?)\s*(斤|箱|袋|个|件)\s*([^一二两三四五六七八九十百千万\d，。,.、\s]+)/g;

  for (const match of text.matchAll(itemPattern)) {
    const quantity = parseChineseNumber(match[1]);
    const unit = match[2] || '斤';
    const name = cleanProductName(match[3]);
    const key = `${name}:${quantity}:${unit}`;

    if (
      !name ||
      /^(用户|助手|下单|订单|商品明细|确认)$/.test(name) ||
      name.length > 12 ||
      quantity <= 0 ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    items.push({ name, quantity, unit });
  }

  return items;
}

function extractTimeRange(text: string): string | null {
  const preciseTime = text.match(/(?:今天|明天|后天)?\s*(?:上午|中午|下午|晚上)\s*\d{1,2}\s*点/);
  if (preciseTime?.[0]) return preciseTime[0].replace(/\s+/g, '');

  const partOfDay = text.match(/(?:今天|明天|后天)\s*(?:上午|中午|下午|晚上)?/);
  if (partOfDay?.[0]) return partOfDay[0].replace(/\s+/g, '');

  if (/昨天/.test(text)) return '昨天';
  if (/今天/.test(text)) return '今天';
  return null;
}

function cleanDeliveryAddress(value: string | undefined): string | null {
  if (!value) return null;

  const address = value
    .replace(/^(今天|明天|后天)?(上午|中午|下午|晚上)?(\d{1,2}点)?/, '')
    .replace(/^(送到|配送到|收货地址|地址)[:：\s]*/, '')
    .trim();

  return address || null;
}

function extractAddressManagementFields(message: string): Pick<ExtractedEntities, 'contactName' | 'deliveryAddress' | 'phone' | 'setDefaultAddress'> {
  const phoneMatch = message.match(/1[3-9]\d{9}/);
  const phone = phoneMatch?.[0] || null;
  const setDefaultAddress = /默认|设为默认/.test(message);

  if (!phone || phoneMatch?.index === undefined) {
    return {
      contactName: null,
      deliveryAddress: null,
      phone,
      setDefaultAddress,
    };
  }

  const beforePhone = message.slice(0, phoneMatch.index).trim();
  const afterPhone = message.slice(phoneMatch.index + phone.length).trim();
  const contactSegment = beforePhone.split(/[，,。；;\s]+/).filter(Boolean).pop() || '';
  const contactName = contactSegment
    .replace(/^(联系人|收货人|姓名|客户|采购商)[:：]?/, '')
    .trim() || null;
  const deliveryAddress = afterPhone
    .replace(/^[，,。；;\s]+/, '')
    .replace(/(设为默认|默认地址|默认收货地址|作为默认|设成默认).*$/, '')
    .replace(/[，,。；;\s]+$/, '')
    .trim() || null;

  return {
    contactName,
    deliveryAddress,
    phone,
    setDefaultAddress,
  };
}

export function extractEntitiesByRules(message: string, history: HistoryEntry[] = []): ExtractedEntities {
  const text = getConversationText(message, history);
  const items = findItems(text);

  const phoneMatch = text.match(/1[3-9]\d{9}/);
  const addressMatch = text.match(/(?:地址|送到|配送到|收货地址)?[:：\s]*([\u4e00-\u9fa5A-Za-z0-9]{2,}(?:市|区|县|路|街|楼|号|仓|市场|店|摊)[\u4e00-\u9fa5A-Za-z0-9]*)/);
  const buyerMatch = text.match(/(?:我是|联系人|客户|采购商)?\s*([\u4e00-\u9fa5]{2,4})\s*(?:1[3-9]\d{9})/);
  const addressFields = extractAddressManagementFields(message);

  return {
    items,
    buyer: buyerMatch?.[1] || null,
    supplier: null,
    deliveryAddress: addressFields.deliveryAddress || cleanDeliveryAddress(addressMatch?.[1]),
    timeRange: extractTimeRange(text),
    phone: addressFields.phone || phoneMatch?.[0] || null,
    contactName: addressFields.contactName,
    setDefaultAddress: addressFields.setDefaultAddress,
  };
}

export function generateFallbackResponse(params: {
  intent: AgentIntent | null;
  message: string;
  context?: string;
  history?: HistoryEntry[];
  orderDraft?: OrderDraft | null;
  createdOrder?: Order | null;
  missingFields?: string[];
}): string {
  const { intent, message, context, history = [], orderDraft, createdOrder, missingFields = [] } = params;

  if (createdOrder) {
    return `订单已创建成功，订单号：${createdOrder.orderNo}，金额：￥${createdOrder.totalPrice.toFixed(2)}。我会继续跟进后续分拣和配送状态。`;
  }

  if (intent === 'confirm_order') {
    if (missingFields.length > 0) {
      return `还差${missingFields.join('、')}，补齐后我再帮您确认下单。`;
    }
    if (hasActiveOrderContext(history)) {
      return '好的，已收到您的确认。我会按前面确认的商品、数量和配送信息继续处理订单。';
    }
    return '可以，请先把要确认的订单商品、数量和配送信息发给我。';
  }

  if (intent === 'ask_price') {
    return context
      ? `我查到这些价格信息：\n${context}`
      : '我还没查到对应商品价格。你可以换个更具体的商品名试试，比如“土豆多少钱”。';
  }

  if (intent === 'query_order') {
    return context || '暂时没有查到相关订单。';
  }

  if (intent === 'place_order') {
    if (orderDraft) {
      const lines = orderDraft.items.map((item) => {
        const price = item.unitPrice ? ` × ￥${item.unitPrice}/${item.unit}` : '';
        return `- ${item.productName}：${item.quantity}${item.unit}${price}`;
      });
      const total = orderDraft.totalPrice ? `\n总价约：￥${orderDraft.totalPrice.toFixed(2)}` : '';
      const missing = missingFields.length > 0 ? `\n还需要补充：${missingFields.join('、')}` : '\n请确认以上信息是否下单。';
      return `好的，我先整理当前订单：\n${lines.join('\n')}${total}${missing}`;
    }
    return context
      ? `我先帮你整理一下下单信息：\n${context}\n请确认采购方、供应商和配送地址。`
      : '可以，我需要商品、数量、供应商和配送地址，例如“来100斤土豆送到城东仓库”。';
  }

  if (intent === 'recommend') {
    return context || '我可以根据近期商品和价格帮你推荐。你想偏便宜、热销，还是按某个品类推荐？';
  }

  return `收到：${message}`;
}
