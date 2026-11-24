# Security Specification — Vishwakarma Interior Services Centre

## 1. Data Invariants
1. Customer inquiries (`/inquiries/{inquiryId}`) contain PII (`customer_name`, `mobile_number`, `location`). Unauthenticated or non-admin users MUST NEVER be able to `get`, `list`, `update`, or `delete` inquiries.
2. Public inquiry creation MUST force `status == 'New'`, validate strict string sizes and phone length, reject unknown fields via `hasAll` + `hasOnly`, and validate `created_at == request.time`.
3. Only the verified owner admin (`request.auth.token.email_verified == true` and `request.auth.token.email == 'sonurana9lenovo@gmail.com'`, or an explicit document in `/admins/$(request.auth.uid)`) can create, update, or delete `/projects`, `/locations`, `/services`, `/settings`, or read/manage `/inquiries`.
4. Inactive services (`active == false`) are readable only by admins; public queries must filter `active == true`.
5. Every document ID path variable is validated with `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, max 128 chars) on single-document operations (`get`, `create`, `update`, `delete`).
6. No `get()` or `exists()` calls are placed inside `allow list` rules.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Inquiry List**: `GET /inquiries` without auth -> Denied.
2. **Non-Admin Authenticated Inquiry Read**: `GET /inquiries/{id}` signed in as `attacker@gmail.com` -> Denied.
3. **Unverified Admin Email Spoof**: Signed in with `email: 'sonurana9lenovo@gmail.com'` and `email_verified: false` -> Denied on admin writes and inquiry reads.
4. **Inquiry Status Shortcutting on Create**: `CREATE /inquiries/{id}` with `status: 'Completed'` -> Denied (must be `'New'`).
5. **Inquiry Shadow Field Injection**: `CREATE /inquiries/{id}` including `isAdmin: true` -> Denied by `keys().hasOnly(...)`.
6. **Inquiry Timestamp Forgery**: `CREATE /inquiries/{id}` with backdated `created_at` (`created_at != request.time`) -> Denied.
7. **Inquiry Resource Exhaustion**: `CREATE /inquiries/{id}` with 50KB `project_details` string -> Denied by `.size() <= 2000`.
8. **ID Poisoning**: `CREATE /inquiries/..%2Fevil` or 200-char doc ID -> Denied by `isValidId()`.
9. **Unauthorized Project Creation**: Non-admin authenticated user creating `/projects/{id}` -> Denied.
10. **Project Gallery Unbounded Array**: Admin payload with > 20 `gallery_images` -> Denied by `.size() <= 20`.
11. **Admin Self-Elevation**: Non-admin user attempting `CREATE /admins/{uid}` with `role: 'owner'` -> Denied.
12. **Hidden Service Scraping**: Unauthenticated `LIST /services` without `active == true` constraint -> Denied.
