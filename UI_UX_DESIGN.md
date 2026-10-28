# UltraCare HMS UI/UX Design Specification

**Status:** Design baseline for the existing React application. Audit current components and styles before treating any proposed behavior or visual token as implemented.

## 1. Experience Principles

- **Role clarity:** Patients, doctors, and administrators should immediately see the tasks and data relevant to their role.
- **Clinical calm:** Use clear hierarchy and restrained emphasis. Reserve strong warning colors for genuine risks; do not make routine health data look alarming.
- **Privacy by default:** Make ownership, sharing state, and access scope clear around records, passports, and shared links.
- **Actionable feedback:** Every save, booking, cancellation, upload, or status transition needs a visible result and a recovery path when it fails.
- **Progressive disclosure:** Put the primary task first; place secondary history, advanced options, and supporting context nearby without overwhelming the page.
- **Consistency:** Extend existing MUI components, `theme.js`, and CSS conventions rather than introducing competing patterns.

## 2. Current UI Structure

The React shell is in `client/src/App.jsx`, with shared `Navbar` and `Footer`, `AuthProvider`, and `ProtectedRoute`. Routes are grouped as public, patient-protected, doctor-protected, shared patient/doctor, and admin-protected. The client uses React, React Router, MUI, Lucide icons, and Chart.js. Inspect `client/src/theme.js`, `App.css`, and `index.css` for actual colors, typography, spacing, and responsive behavior before visual changes.

## 3. Navigation and Information Architecture

### Public

- Home / featured doctors / testimonials
- Doctor discovery
- Login and registration
- Shared health-locker access and health-passport verification (limited public flows)

### Patient

- Dashboard and profile
- Doctors and appointments
- Symptom checker
- Health tracker and reports
- Health locker and sharing
- Health passport
- Allergies
- Family and vaccination schedules
- Care/healing plan and adherence
- Preventive care, visit preparation, and reviews
- Ambulance emergency and queue status

### Doctor

- Dashboard, profile, availability, and analytics
- Appointments and queue/walk-ins
- Patients and patient records
- Consultation chat/video
- Visit preparation
- Prescriptions and care plans

### Administrator

- Admin dashboard and account/appointment oversight

Navigation labels should match the user's role and avoid presenting inaccessible destinations as active actions. Preserve route behavior in `App.jsx` and shared navigation components.

## 4. Page and Workflow Patterns

### Dashboards

- Lead with a concise greeting/context and the next required action.
- Show a small number of actionable summaries (appointments, queue, reminders, care-plan tasks) rather than decorative metrics.
- Make each summary link to its source workflow and indicate empty states when no items exist.

### Lists and search

- Provide clear page title, search/filter controls, result count when useful, and stable sorting/pagination for long lists.
- Preserve filters when users navigate to an item and return, where practical.
- On mobile, use stacked rows with key status and one clear primary action; avoid horizontal overflow.

### Forms and booking

- Group related fields and identify required inputs.
- Show validation next to the relevant field and preserve entered values after recoverable errors.
- For appointment booking, show doctor, date/time, visit type if supported, and final confirmation before submitting.
- Prevent accidental duplicate submission; display booking outcome and next step.

### Health records and sharing

- Separate record metadata from sensitive file preview/download actions.
- Label the recipient/scope and expiry of a share link where supported; provide revoke/cancel controls when available.
- Use confirmation for destructive actions and make empty, upload-progress, and upload-failure states explicit.

### Prescription and clinical assistance

- Visually distinguish clinician-authored values from OCR/AI-suggested values.
- Keep allergy and interaction warnings adjacent to the affected medication/action, with clear resolution choices and clinician confirmation.
- Avoid alarming certainty for model results. Include a plain-language decision-support disclaimer and appropriate urgent-care guidance where clinically approved.

### Consultation and queues

- Make connection, waiting, current queue position, and failure states prominent.
- Keep essential actions reachable without hiding patient/doctor identity and appointment context.
- Provide an accessible fallback if video/chat transport is unavailable.

## 5. Visual System Guidance

- Audit `theme.js`, CSS variables, and existing page styles first; document existing tokens before changing them.
- Use a consistent type scale, spacing scale, contrast, and status palette across roles.
- Reserve semantic colors for success, warning, error, and informational states; never use color alone to convey meaning.
- Use familiar iconography for compact actions and add accessible labels/tooltips for icon-only buttons.
- Avoid unnecessary nested cards, excessive shadows, oversized marketing content in operational screens, and decorative elements that compete with care tasks.
- Keep typography readable at mobile widths. Do not rely on viewport-scaled font sizes for core text.

## 6. Responsive Behavior

- Support narrow phones, tablets, and desktop layouts.
- Use a single-column reading flow on narrow screens; adapt dense tables into responsive rows or controlled horizontal scrolling only when essential.
- Keep primary actions visible and touch targets sufficiently large.
- Ensure dialogs, menus, charts, forms, and file controls fit the viewport and remain keyboard-operable.
- Test representative widths and long text/error messages to prevent clipping, overlap, and layout shifts.

## 7. Accessibility Requirements

- Use semantic landmarks, heading hierarchy, labels, and button/link semantics.
- Support keyboard-only navigation, visible focus, logical focus order, and focus management in dialogs.
- Associate field errors and hints with inputs; announce async status changes to assistive technology.
- Ensure contrast meets the chosen accessibility target; target WCAG 2.2 AA unless product owners define otherwise.
- Provide text alternatives for charts and status indicators; do not rely solely on color, icon, audio, or animation.
- Respect reduced-motion settings and avoid disruptive transitions.

## 8. Required UI States

For each data-backed view, design and implement:

- Initial loading/skeleton state.
- Empty state with a relevant next action.
- Success state/confirmation for mutations.
- Recoverable error state with retry or correction.
- Unauthorized, expired-session, and unavailable-service states where relevant.
- Validation and upload progress/failure states for forms and files.

## 9. UX Validation Checklist

- Can each role reach its common tasks without confusing cross-role links?
- Are sensitive data and sharing boundaries obvious?
- Can users tell whether an action completed, failed, or is still running?
- Are destructive or irreversible actions confirmed appropriately?
- Are mobile, keyboard, screen-reader, zoom, and reduced-motion flows usable?
- Are symptom and AI/OCR outputs clearly labeled as suggestions, not definitive clinical results?
- Do route guards and server authorization agree on the user's actual permissions?
