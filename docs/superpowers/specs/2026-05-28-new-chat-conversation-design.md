# New Chat Conversation Design

## Goal

Allow a logged-in user to start a fresh chat conversation without losing existing conversation history.

## Design

- Add a backend `POST /api/chat/conversations` endpoint that creates an empty conversation for the authenticated user and returns the same shape as `GET /api/chat/current`: `{ conversationId, messages }`.
- Add a mobile `createConversation()` service wrapper and a `newConversation()` method in `useChat`.
- Add a compact "new conversation" icon button on the chat screen. Tapping it creates and switches to a blank conversation, clears streaming text, and resets the local message list.

## Constraints

- Do not add a conversation list or history switcher in this step.
- Disable the new conversation button while streaming.
- Keep existing conversation persistence unchanged.
- Leave unrelated local changes, such as `packages/shared/tsconfig.json`, untouched.

## Verification

- Backend service/router behavior is covered by focused tests where practical.
- Mobile TypeScript check must pass.
- Full server tests and lint should pass before commit.
