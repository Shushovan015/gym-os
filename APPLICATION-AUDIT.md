# A&A Health Club application audit

## Architecture and route inventory

The React/Vite SPA uses React Router for public pages and protected workspaces. Public pages read published Supabase content through Redux Saga services. Most staff screens query Supabase directly. Supabase Auth supplies the session, the profile supplies the role, and PostgreSQL policies and RPCs control data access. Storage serves uploaded media. The bill delivery Edge Function sends configured receipts. The Windows loopback service independently checks administrator access for backups and restores.

| Surface | Routes or functions |
|---|---|
| Public | `/`, `/about`, `/facilities`, `/trainers`, `/shop`, `/pricing`, `/contact`, plus shared navigation and footer |
| Sign-in | `/admin/login` |
| Operations | `/admin`, `members`, `attendance`, `holidays`, `billing`, `inventory`, `reports`, `settings`, `legacy-import` |
| Former CMS routes under `/admin` | `website`, `home`, `facilities`, `trainers`, `pricing`, `proshop`, `testimonials`, `contact`, `footer` |
| Supporting workflows | Member CSV preview and import, legacy SQL migration, BS attendance and holidays, membership fee ledger, invoice and payments, stock and suppliers, monthly reporting, bill printing and email, local backup and restore |

Members are linked to attendance and fee periods. Bills connect customers to invoice items and payments. Product variants and stock movements support inventory and sales. Reports consume recorded financial and stock data. Existing invoice amounts use stored line and total amounts, including cost snapshots for product reporting.

## Findings from source review

| Severity | Evidence and cause | Remediation and verification |
|---|---|---|
| Critical | The baseline grants authenticated users profile updates. `profiles_update_own` checks the row ID but does not restrict the role column. The same column is trusted by `is_admin()`, the frontend, and privileged services. | Remove client profile updates. Verify the effective table and column privileges in a disposable database. Existing roles require a trusted operator review before deployment. |
| High | The active-member and fee-initialization migrations grant browser roles execution of `initialize_membership_fees` and `sync_member_fee_state`. Both run with definer privileges and lack a caller check. | Restrict the internal functions to trusted execution and verify grants. Database triggers call these as their owner. |
| High | The fee status and summary RPCs read member financial history as the function owner without an administrator check. The latest fee migrations expose them to browser roles. | The forward migration switches both queries to caller privileges and removes anonymous execution. Authenticated calls now rely on the members and fee policies. SQL assertions are provided. |
| High | `AdminMembers` uploads member photos to the public `gym-media` bucket. The Storage migration enables public fetches and public object selects. | Open. Move member images into private storage with authenticated reads and a tested migration of existing files and references. |
| High | The baseline production build failed. Attendance, Members and Dashboard called the BS formatter with an obsolete argument. Billing confused a UI mode with a persisted line type. Dashboard omitted fields required by its member query type. The fee status type was declared twice. | Updated these callers and types. The production build passes. |
| High | Opening a member profile invoked three setters removed from the component, and still queried three tables whose results the UI did not show. Older responses could also overwrite a newly opened profile. | Removed the obsolete requests and invalidated stale profile responses. The profile still loads attendance and fees. TypeScript and the existing request invalidation tests pass. |
| Medium | `db:reset` resets the local database and then calls an absent script. A fresh installation can report failure after a successful reset. | Remove the stale script reference. Create the first administrator using the documented trusted setup. No database reset is needed to make this change. |
| Medium | Operational and CMS pages share the same route and visual shell. The public wrapper recognizes internal routes by a single prefix. | Split the route groups, layouts and menus. Preserve old CMS bookmarks and use one protected session boundary. |
| Medium | The Pro Shop editor silently discarded delete errors. Inventory and invoice foreign keys can block deletion. | Display the error and explain how to hide a linked product from the catalog. Runtime deletion remains to be verified in a disposable database. |
| Review needed | Billing and fee concurrency, report reconciliation, BS period boundaries, session failure handling, legacy import interruption, and full backup restoration require runtime verification. | Use disposable fixtures and concurrent transactions. Treat these as unverified scenarios until an issue is demonstrated. |

## Panel separation and shared data ownership

The public site remains at `/`. Operations use `/admin`. Website management uses `/studio` with its own overview, editor links and public-site preview link. Both private workspaces require the existing Supabase admin role. The frontend route guards complement database policies. A scoped CMS-only role would require an independently reviewed field and RPC authorization design.

| Shared data | Current editing owner and public behavior |
|---|---|
| Membership pricing | Studio owns the existing `pricing_items` editor. Operations reads these plans and can link directly to the editor. Published changes become visible on the public pricing page and can affect future charges. Issued invoice values are stored snapshots. |
| Trainers and training plans | Studio edits `trainers` and `personal_training_plans`. Public pages display configured profiles and plans. Billing reads the current plans for future charges. |
| Pro Shop | Studio edits catalog fields in `shop_items`. Operations manages stock and pricing on shared products, `inventory_product_variants`, suppliers and movement history. Inventory and invoice foreign keys restrict deletion of linked products. Public availability comes from its own view. |
| Contact, branding and hours | Studio owns page-specific public content. Operations Settings owns the existing `admin_settings` singleton for operational and billing identity. These separate values can need coordination after a change. |
| Media | Existing editors use Storage for public website assets. Member portraits require private storage. |

Studio keeps the existing direct-save model. Its public preview opens the currently saved website. The About page has no existing editor. A general media library and draft/publish workflow would require product and permission decisions.

## Implementation order

1. Close the confirmed role and internal fee function permission gaps in a forward migration. Fix the fresh-install command.
2. Verify database access and the financial, attendance and reporting journeys against disposable data. Prioritize private member image storage and audit existing administrator accounts.
3. Separate the workspaces while keeping old bookmarks, shared services and existing editors. Test direct navigation, switching, and sign-out.
4. Review large components and query paths, and simplify only where there is a demonstrated maintenance or correctness benefit.
5. Check responsive and keyboard behavior, verify report output and backups, and measure production build and route loading.

Intentional boundaries include the contact form without a submission backend, a catalog without public checkout, front-desk payments, and no public member self-service. The progress function and standalone workout/dashboard code have no active user route.

## Verification and deployment status

- Baseline Vitest passed 181 tests. After the changes, 185 tests passed across 11 files, including four route checks with mocked authentication.
- The production build failed at baseline and passes after the fixes. The initial JavaScript entry decreased from 1,085.25 kB to 684.69 kB after loading private routes on demand. Gzip size decreased from 294.18 kB to 204.38 kB. These are build measurements. Browser load time and the cost of subsequent navigation were not measured.
- Full lint went from 114 errors and 8 warnings at baseline to 104 errors and 8 warnings after the changes. Remaining findings include existing React hook rules and explicit `any` usage. Production readiness still requires resolving the lint failures and testing the real browser and database journeys.
- The Docker daemon was unavailable. SQL assertions, database integration, real authorization, Gmail, report reconciliation, concurrency and isolated backup restoration were not run. No coverage measurement was collected.
- Apply the forward migration to a disposable environment first. Run the SQL assertions there and manually verify administrator membership fee reads, fee creation through normal triggers, and denial for anonymous and non-admin sessions. Verify a full backup and retain the previous frontend artifact before deploying. Review existing administrators through trusted database access.
- Deploy the tested frontend and database changes after validation. If the frontend must be rolled back, restore the previous known-good frontend artifact while retaining the privilege restrictions. Address any database compatibility issue through a reviewed forward migration. A full database restore should follow the verified recovery procedure and requires separate authorization.
