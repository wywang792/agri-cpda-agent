import { createBuyerAddress } from '../modules/buyerAddress/service.js';
import type { AgentState } from './types.js';

export async function manageAddressBook(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Agent] manageAddressBook:start');

  if (state.userRole !== 'buyer') {
    return {
      response: '只有采购商账号可以维护收货地址。',
      suggestions: [],
    };
  }

  const contactName = state.entities?.contactName || state.entities?.buyer || null;
  const contactPhone = state.entities?.phone || null;
  const address = state.entities?.deliveryAddress || null;
  const missingFields = [
    !contactName ? '联系人' : '',
    !contactPhone ? '联系电话' : '',
    !address ? '收货地址' : '',
  ].filter(Boolean);

  if (missingFields.length > 0) {
    return {
      response: `还需要补充${missingFields.join('、')}，我再帮你保存收货地址。`,
      missingFields,
      suggestions: [],
    };
  }

  const saved = await createBuyerAddress(state.userId, {
    contactName: contactName!,
    contactPhone: contactPhone!,
    address: address!,
    isDefault: state.entities?.setDefaultAddress === true,
  });

  console.log(`[Agent] manageAddressBook:done -> ${saved.id}`);
  return {
    response: `已保存收货地址：${saved.contactName}，${saved.contactPhone}，${saved.address}${saved.isDefault ? '。这也是你的默认地址。' : '。'}`,
    missingFields: [],
    suggestions: [],
  };
}
