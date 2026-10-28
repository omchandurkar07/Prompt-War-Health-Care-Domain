# Razorpay Payments Setup

## Payment Behavior

- A patient can start payment only after a doctor confirms the appointment.
- The server computes the amount from the saved appointment fee and creates a Razorpay order in INR (amount stored/sent in paise).
- Razorpay Checkout handles payment details. The application does not collect or store card/UPI credentials.
- Checkout success is not trusted by itself. The API verifies the Razorpay signature and fetches/captures the payment before marking the appointment paid.
- Patients can see payment and refund status in their dashboard.
- Cancelling an appointment that has been paid creates a full-refund request for administrator review. An admin can approve a full Razorpay refund or reject the request. The product's final cancellation/refund policy should be agreed before production use.
- A valid payment arriving after an appointment was cancelled/rejected is flagged for refund handling; the server attempts a full refund and records the result.

## Configure Test Mode

1. Create/use a Razorpay account and obtain **test-mode** API credentials. Do not use live credentials for local testing.
2. Copy `.env.example` to `.env` and set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. `.env` is ignored by Git; do not paste secret values into source files or chat.
3. Run the existing server and client using the repository's normal setup: `node server.js` and `npm run dev --prefix client`.
4. Configure a Razorpay webhook for `POST https://<your-public-host>/api/payments/webhook` using the same webhook secret. Enable `payment.captured`, `refund.processed`, and `refund.failed` events. For local development, expose the server through a trusted HTTPS tunnel and configure that tunnel URL in the provider dashboard.
5. Use Razorpay's published test payment methods. Confirm the appointment as a doctor first, then test checkout, payment history, cancellation, admin refund approval/rejection, and webhook reconciliation.

The `RAZORPAY_KEY_ID` is returned to the authenticated patient checkout flow; the key secret and webhook secret remain server-only. The webhook endpoint verifies the signature against the exact raw request body.

## Endpoints

- `GET /api/payments/config`: authenticated patient checkout configuration.
- `POST /api/payments/order/:appointmentId`: create or reuse an order for a confirmed, patient-owned appointment.
- `POST /api/payments/verify/:appointmentId`: verify the Checkout response and reconcile payment.
- `GET /api/payments/history`: current patient's latest payment records.
- `POST /api/appointment/cancel/:appointmentId`: preserve the existing cancellation path and create refund requests for paid appointments.
- `GET /api/admin/payment-refunds`: administrator refund queue.
- `POST /api/admin/payment-refunds/:paymentId/decision`: administrator approval/rejection.
- `POST /api/payments/webhook`: signed provider events.

## Operational Notes

- The payment flow has not been exercised against a real Razorpay account in this workspace. Test credentials, a public webhook endpoint, and provider-side setup are required for end-to-end testing.
- Configure Razorpay order/payment/refund reconciliation and monitor failed webhook deliveries before production.
- Decide the cancellation cutoff, partial-refund rules, refund timelines, fees, tax treatment, and applicable payment regulations with the product owner before live mode.
- A successful checkout page redirect is not proof of settlement. Use verified API/webhook state only.
- Do not use an administrator's refund action to override gateway state manually; retry only after reviewing the provider dashboard.
