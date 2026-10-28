# UltraCare HMS Product Requirements Document

**Status:** Project baseline, derived from the current repository. Confirm product decisions marked as open before treating them as commitments.

## 1. Product Summary

UltraCare HMS is a web-based healthcare management system for patients, doctors, and administrators. It brings appointment discovery and management together with consultation, prescription, care-plan, health-record, and ongoing health-management workflows. Supporting features include family health, preventive care, queues, emergency ambulance booking, and ML-assisted symptom support.

The repository contains working implementation surfaces for these domains, but this document does not assert that every workflow is production-ready, clinically validated, or compliant with a particular regulation. Verify behavior in the source and deployment before making such claims.

## 2. Problem and Goals

Patients need a centralized way to discover care, manage appointments, maintain their health information, and follow care plans. Doctors need tools to manage schedules and appointments, review relevant patient information, conduct consultations, and create prescriptions and care plans. Administrators need oversight of accounts and core activity.

### Product goals

- Provide role-appropriate patient, doctor, and administrator workflows.
- Reduce friction in doctor discovery, booking, consultation, follow-up, and care adherence.
- Keep medical information organized and shareable only through controlled, authorized flows.
- Support asynchronous and in-person care workflows, including queue and walk-in handling.
- Make AI/ML and OCR capabilities assistive, reviewable, and clearly bounded.
- Offer a responsive, accessible interface with explicit feedback for every important action.

### Out of scope unless separately approved

- Replacing professional diagnosis or clinical judgment with AI/ML output.
- Claiming legal, regulatory, security, or clinical certification without evidence.
- Assuming a particular payment, insurance, pharmacy fulfillment, or electronic health record integration; these are not established by the current feature map.

## 3. Users and Roles

| Role | Primary needs | Current capabilities indicated by the codebase |
|---|---|---|
| Patient | Find care, manage health information, receive care, follow plans | Profile, doctor discovery, appointments, consultations, prescriptions, care plans, health tracker/locker/passport, allergies, family/vaccines, preventive care, visit prep, reminders, queue, ambulance, symptom checker |
| Doctor | Manage practice and deliver care | Profile/availability, dashboard, appointments, patient records, consultations, prescriptions, care plans, visit preparation, queue/walk-ins, analytics, allergy/medication checks |
| Administrator | Maintain platform operations | Admin authentication/dashboard and oversight of doctors, patients, and appointments |
| Public/unauthenticated visitor | Learn about the service and access deliberately public content | Home/featured doctors, doctor discovery routes, testimonials, token-based shared locker/passport verification where allowed |

Role access must be verified in both React route guards and server middleware. A UI route being hidden is not authorization.

## 4. Product Areas and Requirements

### 4.1 Accounts and access

- **PR-01:** Patients can register, complete OTP verification where configured, log in, log out, and recover/reset a password.
- **PR-02:** Doctors can register and log in; doctor approval/availability status must be respected by relevant workflows.
- **PR-03:** Administrators can authenticate and access administrative workflows.
- **PR-04:** Patient and doctor users can view/update their own profile and avatar where supported.
- **Acceptance:** Unauthenticated and wrong-role requests cannot access protected pages or APIs. Sessions and errors do not disclose secrets.

### 4.2 Doctor discovery and appointments

- **PR-05:** Patients can search/browse doctors and review relevant profile/specialty/availability information.
- **PR-06:** Patients can view available booking slots and book an appointment.
- **PR-07:** Patients can view and cancel eligible appointments; doctors can accept, reject, or complete appointments.
- **PR-08:** Eligible patients can review a completed appointment.
- **Acceptance:** A slot cannot be silently double-booked; users can only view or mutate appointments they are entitled to access; status transitions are validated server-side.

### 4.2.1 Appointment payments and refunds

- **PR-25:** After a doctor confirms an appointment, the patient can pay the server-calculated consultation fee through Razorpay Checkout in INR.
- **PR-26:** Patients can review payment and refund statuses in payment history.
- **PR-27:** Cancelling a paid appointment creates a refund request for administrator review; an administrator can approve a full refund through Razorpay or reject the request.
- **Acceptance:** The server verifies payment signatures and provider status; client-provided amounts/statuses are never trusted. Provider credentials remain server-side. Refund state is reconciled through signed webhooks. Live launch requires an approved cancellation/refund policy.

### 4.3 Consultation and follow-up

- **PR-09:** Patients and doctors can access the consultation mode associated with an appointment, including chat and video routes where configured.
- **PR-10:** Authorized participants can view/send consultation chat messages.
- **PR-11:** Doctors can prepare visit notes/sheets, prescribe treatment, and create care plans using the relevant appointment context.
- **Acceptance:** Consultation and records are restricted to their participants/owners; the UI communicates connection, loading, and failure states.

### 4.4 Prescriptions and medication safety

- **PR-12:** Doctors can create, view, regenerate (with clinician review), and manage prescriptions.
- **PR-13:** Prescription workflows can use OCR/AI assistance, drug interaction checks, allergy checks, PDF generation, signatures, translation, and verification where configured.
- **PR-14:** Patients can access their prescriptions and care instructions through authorized routes.
- **Acceptance:** Generated or extracted content is not treated as verified clinical truth. The clinician remains responsible for confirming a prescription. Interaction warnings and allergy safeguards are visible and cannot be bypassed silently.

### 4.5 Personal and family health

- **PR-15:** Patients can track health entries/conditions, view permitted insights, and download a report.
- **PR-16:** Patients can upload/manage health records and share them through controlled share links.
- **PR-17:** Patients can generate a health passport/QR and a recipient can verify it using the intended public verification flow.
- **PR-18:** Patients can manage allergy information, family members, and vaccination records/schedules.
- **PR-19:** Patients can use preventive-care recommendations, visit preparation, reminders, and care-plan adherence workflows.
- **Acceptance:** Sharing is explicit and constrained; expired/revoked links stop granting access if supported by the product policy. Patients can distinguish their data from family-member data.

### 4.6 Emergency, queue, and symptom assistance

- **PR-20:** Patients can submit an ambulance request and view/cancel its status where permitted.
- **PR-21:** Doctors can manage queues and add walk-in patients; patients can view their queue status and permitted public queue information.
- **PR-22:** The symptom checker can collect symptoms through supported text/audio flows and return ML-assisted information/specialization suggestions.
- **Acceptance:** Emergency pathways do not imply that the application dispatches emergency services unless a real integration confirms it. Symptom predictions are labeled as non-diagnostic decision support; urgent warning signs should direct users toward appropriate emergency care.

### 4.7 Administration and shared platform

- **PR-23:** Administrators can review/manage doctors and inspect patient/appointment data as allowed by policy.
- **PR-24:** The home page can display featured doctors and testimonials; submitted content is validated.
- **Acceptance:** Administrative access is tightly role-restricted and actions are auditable where the system supports audit logging.

## 5. Quality Attributes

- **Privacy/security:** Least-privilege access, server-side ownership checks, safe session handling, secure secret management, validated uploads, and careful handling of share tokens.
- **Reliability:** Clear unavailable-service behavior for MongoDB, ML, email, messaging, OCR, and cloud storage integrations.
- **Usability:** Mobile and desktop support, keyboard access, readable forms, consistent navigation, and actionable error messages.
- **Data integrity:** Valid state transitions, date/time-zone clarity, duplicate-submit protection for critical operations, and safe data lifecycle behavior.
- **Maintainability:** Keep features in the established route/model/service/component boundaries and test meaningful behavior.

## 6. Success Measures to Define

The codebase does not define business KPIs. Product owners should select measurable targets such as appointment booking completion, successful consultation completion, prescription correction/error rate, care-plan adherence engagement, failed upload rate, and support incidents. Metrics must avoid collecting unnecessary sensitive data.

## 7. Open Product Decisions

- Supported locations, languages, time zones, and emergency contact/disclaimer requirements.
- Whether appointments are online, in-person, or both, and what the video provider/operational expectation is.
- Exact doctor approval and account suspension policies.
- Patient consent, link expiry/revocation, and health-passport data minimization policy.
- Retention/deletion rules for health records, chat, logs, and uploaded files.
- Clinical governance and escalation wording for symptom assistance and generated prescriptions.
- Accessibility target, supported browsers/devices, and operational service-level targets.
- Which features are release-critical versus experimental or archived.

## 8. Source Map

- Frontend routes: `client/src/App.jsx`
- Backend route modules: `routes/`
- Data models: `models/`
- Services/integrations: `services/`
- Main server and API mounting: `server.js`
- Existing focused profile checks: `TESTING.md`
- Payment setup and provider requirements: `docs/PAYMENTS_SETUP.md`
- Broader current project context: `.github/prompts/ultracare-healthcare-master.prompt.md`
