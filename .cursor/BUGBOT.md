# Family archive security review

This release handles private family records. Review the complete PR with particular attention to:
- Server-side permission enforcement on pages, API routes, exports, saved views and server actions. UI visibility is not authorization.
- Verified record ownership, protection against changing one's own privileges, and admin-only approval of amendments to other records and properties.
- Atomic amendment approval, optimistic concurrency, and consistent audit history.
- Private media and source workbook access, upload validation, path/URL handling, and stored content injection.
- Invitation/reset token expiry, single use, session revocation, account enumeration and secret exposure.

Report concrete findings with severity, exploit conditions and file/line references. Distinguish existing issues from regressions. Never expose credential values or personal record contents in review comments. Do not edit files or deploy.
