# Payment provider contracts

Verified against official sources on 6 October 2026. Provider integration remains in test mode and is not externally validated until merchant credentials are configured.

## Paystack

- [Transaction API](https://paystack.com/docs/api/transaction/): server-side `POST https://api.paystack.co/transaction/initialize`; bearer secret key; `amount` in currency minor units, email, currency, unique reference, callback_url, metadata. Response data includes authorization_url and reference.
- Verify independently with `GET https://api.paystack.co/transaction/verify/{reference}`. Check data.status = success, reference, amount, currency, and test/live domain against the order.
- [Webhooks](https://paystack.com/docs/payments/webhooks/): `x-paystack-signature` is HMAC-SHA512 of the **raw request body**, signed with the secret key. Compare constant-time before processing. `charge.success` is the successful transaction event; duplicates are expected and fulfillment must be idempotent. Return 200 only after durable handling or a verified harmless duplicate; failed requests retry.
- [Subscriptions](https://paystack.com/docs/payments/subscriptions/): recurring support depends on payment channel and merchant/country eligibility. Never infer automatic renewal for mobile money or all channels. Auto-renew is not enabled by this implementation until its own complete provider lifecycle is configured and tested.

## Kora

- [Checkout Redirect](https://developers.korapay.com/docs/checkout-redirect): `POST https://api.korapay.com/merchant/api/v1/charges/initialize` using bearer secret key, reference, amount, currency, customer email/name, redirect_url, optional notification_url and metadata. Response data includes checkout_url/reference. Examples and webhook amounts are decimal **major currency units**, so convert safely to/from the database's minor-unit integer representation.
- [Developer FAQ](https://support.korapay.com/hc/en-us/articles/31129494583186-Kora-Technical-Support-Developer-FAQ): single charge lookup is `GET https://api.korapay.com/merchant/api/v1/charges/{reference}`. Check status, reference, amount, currency. FAQ describes test/live infrastructure and recurring token capabilities but does not prove their availability on the owner's merchant account.
- [Detailed Webhooks documentation](https://developers.korapay.com/docs/webhooks): `x-korapay-signature` is HMAC-SHA256 over **JSON.stringify(payload.data) only**, not the entire request body, signed with the secret key. This precise protocol takes precedence over the FAQ's generalized signature wording. Verify independently even after a valid signature. Accept only relevant charge events; do not confuse refunds/payouts with pay-ins.

## Implementation boundaries

No card or mobile-money credentials are collected by AI Riches Network. Hosted provider checkout collects payment details. Client redirects/callbacks do not grant access. Orders snapshot authoritative price/currency/terms. Independent server verification and transactional fulfillment are required. Country/currency support is configured only after merchant-account validation. No global GHS assumption, fabricated exchange conversion, live activation, refund execution, or automatic recurring charge is permitted by test-mode configuration.

## Observed test-account validation

On 6 October 2026, both supplied keys passed strict `sk_test_` format checks and authenticated read-only verification requests (nonexistent references returned transaction/charge-not-found, rather than authorization errors). Paystack GHS 75 / mobile-money hosted-checkout initialization succeeded. Kora's authenticated initialization returned the original reference and **`https://test-checkout.korapay.com`**, which differs from the production host illustrated in its documentation; the adapter now allows that exact test origin, never an arbitrary host. Kora metadata keys use hyphens, consistent with its published restrictions. Initialization is not a completed payment and grants no entitlement. See `provider-validation.json` for the latest initialization result. Both adapters pass admin-configured `channels`; default live charging and automatic billing remain disabled.

## Read-only refund verification contracts

- [Paystack Refund API](https://paystack.com/docs/api/refund/): `GET /refund/{id}` returns id, status, amount in minor units, currency, domain, and transaction as an ID (or object). Only `processed` proves completion. Independently `GET /transaction/verify/{original_order_reference}` and compare transaction IDs/reference before recording a refund. Pending/processing/needs-attention are not refunded. No POST refund or retry endpoint is implemented here.
- [Kora Refund API](https://developers.korapay.com/docs/refunds-api): `GET /merchant/api/v1/refunds/{reference}` returns reference, amount as major decimal units, currency, status, payment_reference, transaction_amount, and completed_at. Only `success` proves completion. Compare payment_reference to independently verified original charge reference/payment_reference. `refund.success` webhook carries refund reference and payment_reference, but still requires independent lookup. No initiate-refund endpoint is implemented here.
- Full versus partial refunded amount must be accumulated idempotently per unique provider refund ID. Preserve payment/review/progress history. Only a full refund applies the configured entitlement policy; never pretend a pending refund returned money.
