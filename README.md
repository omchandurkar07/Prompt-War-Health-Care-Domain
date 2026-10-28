# UltraCare HMS

UltraCare is a healthcare management application for patients, doctors, and administrators. It brings doctor discovery, appointments, consultations, prescriptions, care plans, personal health records, family health, queues, and symptom-assistance workflows together in one web app.

Clinical and AI-assisted features are decision support only. They are not a diagnosis or a substitute for a licensed clinician. Ambulance request screens do not guarantee that emergency services are dispatched.

## Features

- **Patients:** register and sign in, find doctors, book instantly without waiting for doctor approval, request doctor-approved rescheduling, message their doctor on an appointment thread, pay immediately after booking through Razorpay or a clearly labeled local demo-payment flow, track health, manage records and allergies, use family/vaccination tools, and view care plans and prescription history.
- **Doctors:** manage profiles and appointments, review and approve patient reschedule requests, reschedule failed-payment appointments with a patient message, review patient records, use the consultation room and queue, and create prescriptions by uploading a PDF/image for medicine extraction or adding medicine details manually.
- **Administrators:** manage platform accounts and appointments and review eligible payment-refund requests.
- **Shared workflows:** temporary health-record sharing, patient-owned JSON health-record export, health passports, visit preparation, appointment and medicine reminders, reports, and symptom assistance.
- **Accessibility and language:** persistent larger-text and high-contrast controls, a keyboard-accessible skip link and visible focus indicators. Patients can set a preferred language (English, Hindi, or Marathi) for AI-assisted prescription summaries; doctors can change the language per prescription. The rest of the interface is currently English.
- **Doctor analytics:** monthly appointment/completion charts, ratings and revenue, plus cancellation, pending reschedule, and upcoming follow-up counts.

Prescription scan extraction is a transcription aid: images are auto-oriented, enhanced, and supplied with detail crops to assist reading, but doctors must review the original scan and verify medicine names and instructions before sharing. AI confidence labels are estimates, not measured probabilities. Appointment messages are restricted to the patient and doctor associated with that appointment; they are not an emergency service. AI recovery guidance is informational and does not replace clinical judgment.

Some workflows require external providers or configuration. A booked appointment is confirmed immediately and patients are taken to checkout. Without Razorpay credentials, the development-only payment simulation lets the patient simulate either success or failure; it records no real charge. A failed payment notifies the doctor, who can offer a new slot and message the patient. Configure Razorpay test credentials to exercise provider checkout. MongoDB is required for server startup. The optional Python ML helper requires the dependencies in `requirements.txt`.

## Technology

- React, React Router, Vite, MUI, and Chart.js client in `client/`
- Node.js, Express, and Mongoose API in `server.js` and `routes/`
- MongoDB persistence and session storage
- Optional Flask/scikit-learn helper in `ml_server.py`
- Optional Razorpay, email, messaging, Cloudinary, OCR, PDF, and QR integrations

## Local setup

Prerequisites: a supported Node.js/npm installation, MongoDB, and (for ML features) Python with pip.

1. Install JavaScript dependencies from the project root:

   ```powershell
   npm install
   npm install --prefix client
   ```

2. Create a local environment file and set a strong `SECRET_KEY`. Razorpay credentials are optional for local development; leave both keys unset to use the clearly labeled demo payment simulation:

   ```powershell
   Copy-Item .env.example .env
   ```

   Keep `.env` private and never commit real credentials.

3. Start MongoDB. The default local connection is `mongodb://localhost:27017/ultracare`; set `MONGO_URI` in `.env` to override it.

4. Start the API:

   ```powershell
   npm start
   ```

   The API listens on port `3000` by default. Its health endpoint is `http://localhost:3000/health`.

5. In another terminal, start the client:

   ```powershell
   npm run dev --prefix client
   ```

   Open the Vite URL printed in the terminal.

To enable the optional ML helper, install `requirements.txt` in a Python virtual environment. For payment setup and webhook configuration, see [PAYMENTS_SETUP.md](PAYMENTS_SETUP.md).

### Render deployment

The repository includes a Render Blueprint in `render.yaml`. It installs the backend and client dependencies, builds the Vite frontend into `client/dist`, and starts the Express server. If this service is configured in the Render dashboard rather than synced from the Blueprint, set **Build Command** to `npm ci && npm ci --prefix client && npm run build --prefix client` and **Start Command** to `npm start`, then deploy the latest commit. Keep application secrets such as `MONGO_URI` configured as Render environment variables; never commit them.

The Python/Flask ML helper is optional. Its absence does not prevent the main web app from starting, but symptom-checker routes that depend on it will be unavailable.

### Phase 2 testing

- Build the frontend with `npm run build --prefix client` and lint it with `npm run lint --prefix client`.
- Book an appointment as a patient and confirm checkout appears immediately without doctor approval. In demo mode, test both successful and failed payment; verify a failure notification appears for the doctor, reschedule the slot with a message, then verify the patient sees the new time/message and can retry payment. No real charge is made in demo mode. For provider checkout, configure Razorpay test credentials and follow [PAYMENTS_SETUP.md](PAYMENTS_SETUP.md).
- Test prescriptions by uploading a PDF or image in the doctor's prescription form. Extracted medicine details appear for review, and additional medicines can be entered manually. Verify all extracted instructions against the original before saving.

### Patient follow-up and records

- Confirm an appointment as a doctor, then request a future date and available time from the patient dashboard. The original slot remains reserved until the doctor approves the request; an occupied or out-of-hours slot is rejected.
- Use **Message doctor** or **Message patient** on an appointment to open the private follow-up thread. Only the appointment's patient and doctor can read or send messages; messages are limited to 2,000 characters.
- Use **Export my records** in Health Locker to download the signed-in patient's record metadata and structured prescriptions as JSON. Uploaded file contents and file paths are deliberately not included in the export.
- Appointment reminders are delivered in-app and, when configured, by email/WhatsApp the day before. Existing medicine reminders continue on their configured daily/weekly schedule. Scheduled reminder processing requires the application's cron routes to be invoked.
- Toggle larger text and high contrast using the persistent accessibility controls at the bottom of the page. Keyboard users can tab to **Skip to main content**.
- Set a preferred prescription summary language in the patient profile. This is a summary preference only; medicine instructions still need clinical review and the rest of the interface remains English.
- Doctor analytics include cancellation/decline totals, pending reschedule requests, and follow-ups scheduled within the next 30 days.

### Gmail email setup

Email notifications require valid SMTP credentials. For Gmail, enable 2-Step Verification and create a Google App Password for this application; use the 16-character App Password rather than your regular Google account password. Set `MAIL_USERNAME` to that Gmail account and `MAIL_PASSWORD` to its App Password in `.env`. The mail service removes spaces from Gmail App Passwords automatically. Restart the backend after changing `.env`. Never commit or share the password.

### Fast2SMS OTP setup

Patient registration and forgot-password verification use the Fast2SMS OTP API to send and verify a six-digit code by SMS. Set `FAST2SMS_KEY` and the OTP template ID from your Fast2SMS account as `FAST2SMS_OTP_ID` in `.env`. The approved template must support the OTP variable and the account must be authorized to send to the destination number. The OTP expires after five minutes and is limited to three local verification attempts. Keep the API key private; test with a mobile number you control.

## Useful commands

| Command | Purpose |
|---|---|
| `npm start` | Start the API (requires a reachable MongoDB instance) |
| `npm run dev --prefix client` | Start the client development server |
| `npm run build --prefix client` | Build the client for production |
| `npm run lint --prefix client` | Lint the client |

## Project layout

```text
client/       React application
config/       Database configuration
middleware/   Server-side authentication helpers
models/       Mongoose data models
routes/       Express API routes
services/     External integrations and business services
static/       Public application assets (not user uploads)
ml/           Symptom model and ML support files
docs/         Product, architecture, design, and flow requirements
server.js     Express entry point
ml_server.py  Optional Flask ML helper
```

Uploaded health records and generated files are runtime data and must not be committed. The application does not claim regulatory certification or production readiness; review authorization, session configuration, file privacy, retention, backups, auditability, clinical governance, and applicable healthcare/payment rules before deployment.
