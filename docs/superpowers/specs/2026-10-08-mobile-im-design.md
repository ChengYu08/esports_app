# Mobile IM Design

## Goal

Replace the mobile message tab's sample data with a private-message flow backed
by RongCloud. A signed-in user can open a real conversation, see the latest
conversations and profile data, load message history, send and receive text
messages, and see unread counts. The feature must accurately expose unavailable
IM, loading, empty, and send-failure states rather than displaying fake success.

## Scope

This delivery covers private text conversations only. Image messages, custom
business-card messages, push notifications, presence, group/chatroom messages,
and message search/clear actions are intentionally out of scope. The existing
header actions will remain non-destructive until those flows exist.

## Architecture

`src/features/message/message-store.ts` will be a Zustand store, matching the
application's existing auth-state convention. It owns:

- IM connection and availability state;
- conversations keyed by peer user ID, including hydrated display profile and
  unread count;
- the in-memory message collection for each open conversation;
- history pagination cursors and request state;
- pending/failed outgoing messages and retry;
- subscription setup and teardown for real-time SDK callbacks.

`rongcloud-im.ts` remains the sole native SDK adapter. It maps RongCloud data
to stable feature models, exposes connection/list/history/send/read operations,
and contains no React UI state. It will use named SDK enums rather than numeric
arguments. It must receive an authenticated business token before requesting an
IM token or user profile.

The store begins connecting when a valid auth session is present. It disconnects
and clears user-specific state on logout. On native-module absence (Expo Go,
web, or an unbuilt native app) it enters an unavailable state. The UI never
falls back to seeded conversations or messages.

## Data Flow

1. A signed-in root layout asks the store to initialize. The adapter obtains an
   IM token through `/client/v1/im/token`, connects, loads private conversations,
   and hydrates each peer using `/client/v1/user/profile/{userId}`.
2. A received private message is normalized by the adapter and sent to the
   store. The store de-duplicates it, updates or creates the peer conversation,
   moves it to the top, and increments unread count unless that conversation is
   active.
3. Entering a conversation calls `openConversation`. It creates a display
   shell when navigation originated on a profile page, loads the latest history,
   records the conversation as active, and clears the SDK/local unread count.
4. Sending first creates a locally visible `pending` message. The store calls
   the adapter. Success replaces the pending item with the SDK message; failure
   preserves the text as `failed`, exposes a retry action, and reports an error
   to the screen. An unready connection does not create a sent-looking message.
5. Older history is requested when the user reaches the start of the list.
   Pages are prepended, de-duplicated, and the cursor advances only after a
   successful request. The UI makes end-of-history and fetch errors visible.

## Screens

`MessageScreen` renders only store conversations. It presents login,
unavailable, connection, error, and empty states, then routes a selected peer
to the chat screen with its display metadata.

`ChatScreen` renders store messages using the peer avatar for incoming messages
and the authenticated user's avatar for outgoing messages. It shows loading and
history pagination feedback, disables send while IM is unavailable, and renders
a failed outgoing message with a retry control.

`ProfileScreen` changes its existing inert "聊一聊" control into a route to the
private chat using that profile's user ID, nickname, and avatar. It remains
hidden on the current user's own profile.

## Failure Handling

- No auth token: message tab asks the user to sign in; chat navigation does not
  claim that a message was sent.
- Native SDK unavailable: show a clear unavailable state. This is expected in
  Expo Go and web builds.
- IM token, connection, profile, conversation, history, or read-status failure:
  retain valid cached UI where possible and expose a retry path.
- Send failure: retain content as failed and allow retry; never silently swallow
  the exception or leave an indistinguishable optimistic success.

## Verification

- Unit-test message reducers/mappers for deduplication, ordering, unread state,
  history-page merge, pending-to-confirmed replacement, and failed-send retry.
- Run `npx expo lint` and `npx tsc --noEmit`.
- Validate in a development build, not Expo Go: two authenticated accounts can
  initiate a private chat from profile, receive the conversation, exchange text
  in both directions, reopen history, clear unread state, and see a failed-send
  retry after a forced network disconnect.
