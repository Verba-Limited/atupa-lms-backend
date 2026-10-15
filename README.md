# ATUPA LMS Backend (NestJS)

API for the ATUPA LMS: Nigerian languages and culture (Yoruba, Igbo, Hausa). One deployable service on `PORT` (default `4000`), MongoDB, Cloudinary for media, Paystack for payments, Resend for email.

GitHub: [Verba-Limited/atupa-lms-backend](https://github.com/Verba-Limited/atupa-lms-backend) · Deploy: see [RENDER.md](RENDER.md)

## Quick start

```bash
cp .env.example .env      # set JWT secrets + SUPER_ADMIN_EMAIL/PASSWORD
npm install
npm run start:dev
```

- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`
- Health: `http://localhost:4000/api/v1/health`

On an empty database the app seeds Yoruba, Igbo and Hausa, plus demo courses, vocabulary and GameCards (turn off with `SEED_DEMO_CONTENT=false`), and creates the first super admin from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.

Without Resend/Cloudinary/Paystack keys the app still runs: emails are printed to the log, media goes to local `uploads/`, and checkout returns 503.

## Architecture: modular monolith, hexagonal modules

Each bounded context is a Nest module under `src/modules/<name>` with four layers:

```
modules/<name>/
  domain/          entities, value rules, policies (no Nest, no Mongo)
  application/     use-case services + ports (interfaces) they depend on
  infrastructure/  adapters: Mongo repositories, Cloudinary, Paystack, Resend, cron
  presentation/    inbound adapters: HTTP controllers + DTOs, event listeners
  <name>.module.ts wires ports to adapters
  index.ts         the module's public API
```

Rules:

- **Other modules import only from `modules/<name>/index.ts`**: application facades (e.g. `CatalogQueryService`) and domain types. Never another module's schemas or repositories.
- **Side effects across modules go through integration events** (`src/shared/contracts/events.ts`, published via the `EventBus` port). For example `CourseCompleted` → certificates issue a certificate → notifications tell the learner and parents.
- **Application code throws domain errors** (`src/shared/domain/errors.ts`); `DomainExceptionFilter` maps them to HTTP codes.
- **Security is on by default**: every route needs a JWT unless marked `@Public()`, then `@Roles(...)` is checked, then the use case checks ownership (e.g. a teacher's own course or class).

| Module | Responsibility |
|---|---|
| `identity` | Registration (learner/parent/teacher self-sign-up), login, refresh rotation, password reset, invitations, profile, super-admin user management |
| `catalog` | Languages, courses → modules → lessons → activities → quizzes; CMS (`/authoring/*`) with ownership rules; learner-safe read facade |
| `library` | Vocabulary bank (concepts across languages), cultural topics, ATUPA games |
| `media` | Cloudinary direct/signed uploads, optimised delivery URLs (images `f_auto,q_auto`, HLS video, 64k audio) |
| `learning` | Lesson player, activity grading, server-timed quiz attempts, answer review, premium gating |
| `progress` | Enrollments, lesson position (resume across devices), points, streaks, badges, course completion |
| `certificates` | Auto-issued on course completion, verification code + QR, revocation |
| `gamecard` | GameCard QR lookup (word in every language + audio + challenge), scans, challenges, game sessions |
| `parents` | Code-based child linking |
| `schools` | School registration, members (invite teachers/students), join codes, leaderboard privacy settings |
| `classes` | Classes, students (same school or class join code), course assignment, announcements |
| `assignments` | Assignments and submissions: Assigned → Started → Submitted → Reviewed → Completed; auto-completion for lesson/quiz/game targets |
| `notifications` | In-app notifications, Resend email, event-driven triggers, daily streak reminders |
| `subscriptions` | Plans, Paystack checkout, signed webhook, verification, entitlement checks |
| `search` | Courses, lessons, languages, vocabulary, cultural topics and games with filters |
| `reports` | Learner/parent/teacher/school/admin dashboards, learner/class/school reports, leaderboards |

## Main endpoints (prefix `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password/{forgot,reset,change}`; `GET/PATCH /users/me` |
| Admin | `GET/POST/PATCH /admin/users`, `GET /dashboards/admin`, `GET /subscriptions/payments`, `GET /certificates` |
| Browse | `GET /languages`, `GET /courses`, `GET /courses/:id`, `GET /vocabulary`, `/vocabulary/concepts/:key`, `/cultural-topics`, `/games`, `GET /search` |
| CMS | `/authoring/courses`, `/authoring/modules/:id`, `/authoring/lessons/:id`, `/authoring/activities/:id`, `/authoring/quizzes/:id`, `/authoring/vocabulary`, `/authoring/cultural-topics`, `/authoring/games`, `/authoring/gamecards` |
| Media | `POST /media/uploads` → upload to Cloudinary → `POST /media/uploads/confirm`; or `POST /media/upload` (≤25MB) |
| Learning | `GET /learning/lessons/:id`, `POST /learning/activities/:id/submit`, `POST /learning/quizzes/:id/attempts`, `POST /learning/attempts/:id/submit`, `GET /learning/attempts/:id/review` |
| Progress | `POST /progress/courses/:id/enroll`, `GET /progress/courses`, `PUT /progress/lessons/:id/position`, `POST /progress/lessons/:id/complete`, `GET /progress/continue`, `POST /progress/heartbeat`, `GET /progress/{stats,badges,activity}` |
| GameCard | `GET /gamecard/cards/:code`, `POST /gamecard/scan`, `POST /gamecard/cards/:code/challenge`, `POST /games/:id/sessions` |
| Certificates | `GET /certificates/mine`, `GET /certificates/:id`, `GET /certificates/verify/:code` (public) |
| Parents | `POST /parents/link-codes` (learner), `POST/GET/DELETE /parents/children`, `GET /dashboards/parent`, `GET /dashboards/children/:id` |
| Schools | `POST /schools/register` (public), `GET /schools/mine`, `PATCH /schools/:id`, `GET/POST/DELETE /schools/:id/members`, `POST /schools/join`, `GET /dashboards/school` |
| Classes | `POST/GET /classes`, `POST /classes/join`, `/classes/:id/students`, `/classes/:id/courses/:courseId`, `/classes/:id/teacher`, `/classes/:id/announcements` |
| Assignments | `POST /assignments`, `GET /assignments/mine`, `GET /assignments/classes/:id`, `POST /assignments/:id/{start,submit}`, `POST /assignments/:id/submissions/:learnerId/review` |
| Reports | `GET /dashboards/{learner,teacher}`, `GET /reports/learners/:id`, `/reports/classes/:id`, `/reports/schools/:id`, `GET /leaderboards` |
| Payments | `GET /subscriptions/plans`, `POST /subscriptions/checkout`, `GET /subscriptions/payments/:ref/verify`, `POST /subscriptions/webhooks/paystack` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |

Responses are `{ success, message, data }`; lists are `{ items, page, limit, total }` with `?page=&limit=`. IDs are returned as `id`.

## Frontend notes

- Access tokens last 15 minutes. Call `POST /auth/refresh` with the refresh token; each refresh returns a new pair, and reusing an old refresh token logs the user out everywhere.
- Quiz answers are keyed by **question id**, not index.
- Send `POST /progress/heartbeat` about every 60 seconds while a learner is active, to record learning time.
- Media: request a ticket, upload the file with the returned `fields` to `uploadUrl`, then confirm with the returned `public_id`. Use `optimizedUrl` / `streamingUrl` for playback.
- Paystack redirects to `${FRONTEND_URL}/payments/callback?reference=...`; then call `GET /subscriptions/payments/:reference/verify`.
- Emails link to `${FRONTEND_URL}/reset-password?token=` and `/set-password?token=`; GameCard QRs open `${FRONTEND_URL}/scan/:code`; certificates open `${FRONTEND_URL}/certificates/verify/:code`.

## Tests

```bash
npm test           # unit tests for domain rules
npm run test:e2e   # full app against an in-memory MongoDB (security fixes + learner journey)
```

## Upgrading an existing database

On startup, idempotent migrations convert prototype data (ObjectId references to strings, quiz question ids, GameCard codes, parent links, school/class join codes, certificate status). Prototype progress, quiz-attempt, assignment and GameCard-scan records live in collections the new code does not read (`learner_progress`, `quiz_attempts`, `assignments`, `gamecard_scans`). For a staging database, the simplest option is to start fresh.
