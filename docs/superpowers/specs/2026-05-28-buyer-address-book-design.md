# Buyer Address Book Design

## Goal

Add a database-backed address book for buyer accounts. Buyers can maintain multiple delivery contacts and addresses from the mobile "My" tab, choose one default address, and use the default address during chat-based ordering when the user does not explicitly provide delivery details.

The agent must also understand natural-language address maintenance, such as "帮我新增一个地址，小王 18089333333 西安市钟楼", and persist the extracted address.

## Data Model

Create a `buyer_addresses` table:

- `id`: UUID primary key.
- `user_id`: buyer user ID.
- `contact_name`: delivery contact.
- `contact_phone`: delivery phone.
- `address`: delivery address text.
- `is_default`: boolean.
- `created_at`, `updated_at`: timestamps.

Only buyer users can manage buyer addresses. Each buyer can have many addresses, but at most one default address. When inserting the first address for a buyer, it becomes default automatically. When an address is set as default, all other addresses for that buyer are unset in the same service operation.

Orders should keep a delivery snapshot so historical orders are not affected when a buyer later edits an address. Add order fields:

- `delivery_contact_name`
- `delivery_contact_phone`
- existing `delivery_address`

The existing `delivery_time`, `delivery_start_at`, and `delivery_end_at` fields remain unchanged.

## Backend API

Add a buyer address module:

- `GET /api/buyer-addresses`
  - Returns all addresses for the authenticated buyer, default first.
- `POST /api/buyer-addresses`
  - Creates an address.
  - If `isDefault` is true, unset other defaults.
  - If this is the first address, make it default.
- `PATCH /api/buyer-addresses/:id`
  - Updates contact name, phone, address, and default flag.
- `DELETE /api/buyer-addresses/:id`
  - Deletes an address owned by the buyer.
  - If the deleted address was default, make the newest remaining address default.
- `POST /api/buyer-addresses/:id/default`
  - Sets one owned address as default.

All routes use the existing auth middleware. Supplier and admin requests return an authorization error for this V1.

## Agent Flow

Add a new intent: `manage_address`.

Natural-language examples:

- "帮我新增一个地址，小王 18089333333 西安市钟楼"
- "把西安市钟楼设为默认地址"
- "新增收货地址：李四 13900001111 城东仓库"

Entity extraction should support:

- `contactName`
- `contactPhone`
- `deliveryAddress`
- `setDefault`

When intent is `manage_address`, the agent writes the address through the same buyer address service used by the REST API and responds with the saved address summary. If required fields are missing, it asks only for the missing fields.

When intent is `place_order`, order draft merging should work like this:

1. If the user provided delivery contact, phone, or address in the message, use those values.
2. If any delivery fields are missing, load the buyer's default address and fill the missing values.
3. Show the filled contact, phone, and address in the order confirmation response.
4. Only create the order after explicit confirmation.

## Mobile UI

Update the buyer "My" tab:

- Add an address section below the user profile.
- Show address cards with contact name, phone, address, and a default badge.
- Provide controls to add, edit, delete, and set default.
- Use a modal or inline editor rather than adding a new route for V1.

The supplier view should not show the buyer address management section.

## Error Handling

- Missing contact, phone, or address returns a clear validation error.
- Setting/deleting/updating an address not owned by the current user returns not found.
- If a buyer has no default address and starts an order without an address, the agent asks for delivery contact, phone, and address.
- Natural-language address creation with incomplete fields asks for the missing fields instead of saving partial data.

## Testing

Backend tests:

- Creating the first address makes it default.
- Setting a second address as default unsets the first.
- Deleting the default address promotes another address.
- Natural-language address extraction recognizes contact, phone, and address.
- Order draft uses default address when no address is provided.
- Explicit order address overrides the default address.

Verification:

- `pnpm --dir apps/server test -- --run`
- `pnpm --dir apps/server build`
- `pnpm --dir apps/mobile lint`
- `pnpm lint`
- `pnpm build`

## Scope Boundaries

This V1 does not include map/geocoding, province/city/district normalization, address labels, cross-buyer shared addresses, or a dedicated address detail page.
