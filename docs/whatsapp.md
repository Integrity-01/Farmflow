# FarmFlow WhatsApp layer

FarmFlow connects to the WhatsApp Business *Cloud API* so farmers and managers can:

- **Link** a phone number to an account by replying `join <invite-code>` to the bot (no OTP typing).
- **Ask** the assistant for weather, open/overdue tasks, low stock, and agronomy advice (OpenAI).
- **Receive** task assignments, due-soon and overdue reminders, and the daily summary as WhatsApp alerts.

The layer is fully optional. Until the four `WHATSAPP_*` values are present in `.env`, every endpoint
reports `WHATSAPP_NOT_CONFIGURED` (503) and outbound alerts are skipped — nothing else breaks.

---

## 1. How to get the credentials (Meta for Developers)

The WhatsApp Cloud API is free to use for sending business messages to your customers. To get started:

1. **Create a Meta developer account**
   Go to https://developers.facebook.com → *Get Started*, log in with a Facebook account, click
   *My Apps → Create App*.

2. **Create a Business app**
   - *Use case*: **Other**
   - *App type*: **Business**
   - Name it `FarmFlow`. No Business portfolio is required for development.

3. **Add the WhatsApp product**
   In the app dashboard, under *Add products to your app*, click **WhatsApp** → *Set up*.
   This adds the **WhatsApp Cloud API** product and opens the **API Setup** page (WhatsApp → *API Setup*).

4. **Choose a phone number** (the number the bot sends from)
   - **Development / testing:** use the Meta-assigned **test number** it gives you for free.
     You can reply to and receive messages on up to 5 phone numbers that you add under *To:* on the same page.
   - **Production:** click *Manage phone number list* and add a real business WhatsApp number
     (requires the number to not already be on WhatsApp Business App / API; registration is free).
   - **Phone Number ID** (a numeric id like `123456789012345`) — this becomes `WHATSAPP_PHONE_ID`.

5. **Grab the access token** — `WHATSAPP_TOKEN`
   - *Temporary access token* shown on the API Setup page — good for ~24 hours of testing.
   - **Permanent token (production):** *App Settings → Users → Roles → System Users → Add System User*
     (Admin), then *Generate New Token* with the permissions
     `whatsapp_business_messaging` and `whatsapp_business_management`, and an expiry of *Never*.
     This token is what you put in `WHATSAPP_TOKEN`.

6. **Webhook verification token** — `WHATSAPP_VERIFY_TOKEN`
   You choose this yourself: any string, e.g. `farmflow-verify-a1b2c3`. Meta echoes it back when it
   verifies your callback URL. It goes in `.env` unchanged.

7. **App secret** — `WHATSAPP_WEBHOOK_SECRET`
   *App Settings → Basic* → **App secret** → *Show*. FarmFlow uses it to verify Meta webhook signatures
   (the `X-Hub-Signature-256` header). This is the "secret" Meta calls the *App secret*.

### Webhook URL (needed for inbound messages)

The server must be reachable over **HTTPS** at:

```
https://<your-domain>/api/whatsapp/webhook
```

In Meta: WhatsApp → *API Setup* → *Webhook* section.

1. **Callback URL** = `https://<your-domain>/api/whatsapp/webhook`
2. **Verify token** = the same string as `WHATSAPP_VERIFY_TOKEN` (Meta calls it to verify; FarmFlow
   echoes the `hub.challenge` back).
3. Click *Verify and save*, then under **Webhook fields** click *Manage* and subscribe to:
   - `messages` (required)
   - `message_deliveries` (optional)
   - `read` (optional)

> No HTTPS domain yet? During development you can tunnel HTTP to the local API:
> `cloudflared tunnel --url http://localhost:4000`, then use the `https://<random>.trycloudflare.com/api/whatsapp/webhook`
> URL for 30 days of free dev. The production Docker setup (Caddy) already provides TLS.
>
> You do **not** need the webhook for outbound alerts — only for inbound questions and for linking via `join <code>`.

### Message templates (business-initiated alerts)

Meta only allows **free-form** messages within a 24-hour customer-service window (e.g. replies to an
inbound message). Task reminders, overdoses and daily summaries are *initiated by the business*, so they
must arrive as an **approved template**.

1. WhatsApp → **Message templates** → *Create template*.
2. Name it exactly **`farmflow_alert`** (or set `WHATSAPP_ALERT_TEMPLATE` to your own name).
3. Category: **Utility**, language **English (US)**.
4. Body: a single line with one variable, e.g.
   `Hi {{1}}. This is a FarmFlow update for you.`
5. *Submit*. Approval is usually minutes; the webhook receives the template-message status.

If FarmFlow cannot deliver a template message, it logs a warning — check `backend/api-err.log`.

---

## 2. Configure

Add to `.env` (all four are required together; anything missing disables the layer):

```env
WHATSAPP_TOKEN=EAAG...your-token
WHATSAPP_PHONE_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=farmflow-verify-a1b2c3
WHATSAPP_WEBHOOK_SECRET=app-secret-from-meta
# optional
WHATSAPP_API_VERSION=v21.0
WHATSAPP_ALERT_TEMPLATE=farmflow_alert
```

Restart the API. In the app, open **Settings → WhatsApp** — it should now show `Connected` tools.

---

## 3. How linking works

1. A user opens **Settings → WhatsApp → Generate invite code**. An 8-character code is created.
2. They (or the farmer they're onboarding via voice/paper) messages the bot's number and replies
   `join FARMCODE`.
3. The webhook looks up the code, binds the sender's number to that account, revokes any other active
   link on the number, and replies with a welcome/help message.

Linking is initiated from the WhatsApp side — no OTP is typed in the app, which is the "WhatsApp-first" flow.

## 4. What the assistant understands

| You say | It replies with |
| --- | --- |
| `weather` | Live conditions + 1–2 day outlook for your first farm |
| `tasks` / `overdue` / `due` | Open task count, overdue + due-soon counts, top 5 by deadline |
| `stock` / `low` | Inventory items at or below their reorder threshold |
| `advice <anything>` | Short agronomy answer via OpenAI (or a help hint when no key is set) |
| `help` | This menu |

## 5. Alert flow

Every place the app already sends push/email notifications (task assigns/completes/comments, due-soon,
overdue, daily summary) now also calls the WhatsApp channel. Delivery requires, in order:

1. WhatsApp configured (`WHATSAPP_*` set) — else silently skipped.
2. The recipient's `whatsapp_enabled` preference is on (Settings → Notifications → WhatsApp).
3. A linked `whatsapp_links` row with `status = 'active'`.
4. The per-event toggle (task assignments, etc.) shared with the other channels.
5. An approved `farmflow_alert` template for business-initiated messages.

## 6. Files

- `backend/src/services/whatsapp.service.ts` — Cloud API client, signature + handshake verify, inbound assistant, `sendToUser`.
- `backend/src/routes/whatsapp.routes.ts` / `controllers/whatsapp.controller.ts` — `/api/whatsapp/*`.
- `database/migrations/008_whatsapp.sql` — `whatsapp_links` table + `whatsapp_enabled` preference.
- `backend/src/app.ts` — raw-body capture for signature verification.
- `src/pages/Settings.tsx` — the WhatsApp connect + status UI.
- `backend/whatsapp-live.cjs` — 15-check live regression suite (`node backend/whatsapp-live.cjs`).