# Payments plan

Status: **checkout is built; payouts are manual.** With `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set, an accepted order gets a Pay button that opens Stripe hosted Checkout; a signed webhook marks the order paid; you pay artists yourself (`tools/admin.js payments / payout / refund`). With no keys the site says payment is arranged directly. Tested against a mock Stripe, **not against real Stripe**: run it in test mode first. The sections below are the plan for the remaining work (Stripe Connect payouts, disputes, tax).

## 1. Decisions you need to make first

These are business choices, not code. Nothing below can start until they are settled.

| Decision | Options | Recommendation |
|---|---|---|
| Processor | Stripe Connect, Razorpay Route (India), PayPal Payouts | Stripe Connect if your business entity is in a Connect-supported country. Stripe's availability in India is invite/limited, so check your country first; if not available, Razorpay Route is the closest equivalent. |
| Fund flow | (a) Direct split on every charge, (b) hold funds on the platform, release on completion | (b) — buyers expect protection, and it matches the existing "approve and review" step. |
| Fee model | Seller fee, buyer fee, or both | Start with a single seller-side percentage (e.g. 10%). Simple to explain, easy to show in the price breakdown. |
| Refund policy | Who pays when work is not delivered or disputed | Write it before building. It drives the dispute flow. |
| Tax | VAT/GST/sales tax collection | Use Stripe Tax or ask an accountant. Not something to guess. |
| Business entity | Individual vs company | Stripe will require verified business details. |

## 2. Recommended architecture

**Stripe Connect (Express accounts) with separate charges and transfers.**

- Sellers onboard through Stripe-hosted Account Links. Orbitly never sees bank details or ID documents.
- Buyers pay through **Stripe Checkout** (hosted page). Card data never touches our server, which keeps PCI scope at SAQ A.
- The charge lands on the platform account. When the buyer marks the order complete, the server creates a **Transfer** to the seller's connected account minus the platform fee.
- Holding funds this way has a time limit on card charges and transfers (check Stripe's current limits before promising anything), so auto-complete after N days of buyer silence needs to be part of the order workflow.

Why not destination charges: they pay the seller immediately, which removes the hold that makes the "approve before release" step meaningful.

## 3. Data model changes

Add to `db.json` (and later to a real database, see section 8):

- `user.stripeAccountId`, `user.payoutsEnabled`, `user.chargesEnabled`
- `order.amount` (integer minor units), `order.currency`, `order.fee`, `order.paymentStatus` (`unpaid | paid | released | refunded | disputed`), `order.checkoutSessionId`, `order.paymentIntentId`, `order.transferId`
- `webhookEvents[]` of processed Stripe event IDs for idempotency

Rules: money is always integers in minor units, never floats. Price in an order is snapshotted at acceptance so later gig edits cannot change it.

## 4. Server work

New endpoints:

- `POST /api/payouts/onboard` creates the connected account if needed and returns an Account Link URL.
- `GET /api/payouts/status` returns whether the seller can receive money.
- `POST /api/orders/:id/pay` (buyer, order accepted, unpaid) creates a Checkout Session and returns its URL.
- `POST /api/stripe/webhook` the only place payment state changes.
- Admin: refund, force release, view disputes.

Webhook handler requirements:

1. Read the **raw** body and verify the `Stripe-Signature` header with the endpoint secret, rejecting anything older than 5 minutes.
2. Look up `event.id` in `webhookEvents`; skip duplicates.
3. Handle `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created/closed`, `account.updated`, `transfer.*`.
4. Return 2xx quickly, do the work, never trust the browser redirect as proof of payment.

Zero-dependency note: the Stripe HTTP API can be called with `fetch` and signatures verified with `crypto.createHmac`, so the no-dependencies rule can stay. The official SDK is the alternative if you prefer it.

New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_FEE_PERCENT`, `PAYMENTS=on|off`. Keep `PAYMENTS=off` as the default so the current behaviour is unchanged until you flip it.

## 5. Client work

- Seller dashboard: "Get paid" card showing onboarding state, with a button to Stripe's flow.
- Order card: price breakdown (price, fee, total), a **Pay** button once the seller accepts, status chips for paid / released / refunded.
- Gig form: price is already there; require it to be a real number and show the seller's net after fees.
- Copy changes: remove "Payment is arranged directly" only when `PAYMENTS=on`. Do not claim escrow or protection that the code does not actually enforce.

## 6. Legal and trust

- Terms of service: fees, refund policy, dispute process, payout timing, prohibited services, who is the merchant of record.
- Privacy policy: Stripe as a processor, what is shared.
- Show Stripe's required disclosures at checkout and on seller onboarding.
- Keep the receipts/invoices Stripe generates; provide them to buyers by email.

## 7. Testing plan

All in Stripe **test mode** first:

- Onboard a test seller using Stripe's test data.
- Pay with `4242 4242 4242 4242`; failure with `4000 0000 0000 0002`; 3-D Secure with `4000 0025 0000 3155`.
- Replay the same webhook twice and confirm nothing is double-applied.
- Send a webhook with a bad signature and confirm 400.
- Complete an order and confirm the transfer amount equals price minus fee to the cent.
- Refund and dispute paths; seller with payouts disabled cannot be paid.
- Extend `sec2.js` with a mocked Stripe so these run in CI without network.

## 8. Before going live

- [ ] Business verified with the processor and bank account attached
- [ ] Terms, privacy, refund policy reviewed (ideally by a lawyer)
- [ ] Webhook endpoint registered on the live domain over HTTPS
- [ ] Live keys only in environment, never committed
- [ ] Move off the JSON file to a real database (Postgres/SQLite with transactions). Money state should not live in a file that one crash can truncate.
- [ ] Backups verified by actually restoring one
- [ ] Alerting on webhook failures
- [ ] Support email monitored for disputes
- [ ] Small real transaction end to end, then refund it

## 9. Rough order of work

1. Decisions in section 1 (you)
2. Database migration (about a day)
3. Onboarding + status (about a day)
4. Checkout + webhook + order states (2–3 days)
5. Release, refund, dispute handling and admin tools (2 days)
6. Tests, legal text, copy (1–2 days)

## 10. Risks

- **Regulatory:** holding funds can make you a money transmitter in some places. Connect with Stripe holding the funds is designed to avoid that, but confirm for your jurisdiction.
- **Fraud and chargebacks:** the platform is liable for disputes on separate-charge flows. Start with low limits and manual review.
- **Scope creep:** do not add subscriptions, tips, milestones or multi-currency payouts in the first release.
