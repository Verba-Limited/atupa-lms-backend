# ATUPA LMS Backend (NestJS)

Single-port modular monolith for the ATUPA Learning Management System (Yoruba, Igbo, Hausa).

## Architecture

- **One HTTP service** on `PORT` (default `4000`)
- **Domain modules** (auth, catalog, learning, progress, classes, assignments, parents, schools, search, reports, certificates, gamecard, notifications, subscriptions, media)
- **SOLID patterns**: repository interfaces, payment/notification ports, role guards, focused services
- **MongoDB** for extensible language/course data (new languages are data, not code)

## Repository

GitHub: [kanmitcode/atupa-lms-backend](https://github.com/kanmitcode/atupa-lms-backend)

## Quick start

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

- API base: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`
- Health: `http://localhost:4000/api/v1/health`

## MVP coverage (P1 user stories)

| Area | Routes (prefix `/api/v1`) |
|------|---------------------------|
| US-01 Auth & roles | `/auth/*` |
| US-02/04/16 Languages & courses | `/languages`, `/courses/*` |
| US-05/11 Lessons & media | `/modules/*/lessons`, `/media/upload` |
| US-06/07 Activities & quizzes | `/lessons/*/activities`, `/learning/quizzes/*` |
| US-03/08/19 Progress | `/progress/*` |
| US-09 GameCard QR | `/gamecard/scan` |
| US-10 Certificates | `/certificates/*` |
| US-12 Classes | `/classes/*` |
| US-13 Assignments | `/assignments/*` |
| US-14 Parents | `/parents/*` |
| US-15 Schools | `/schools/*` |
| US-17 Search | `/search` |
| US-18 Reports | `/reports/*` |
| US-20 Subscriptions | `/subscriptions/*` |

## Tests

```bash
npm test
```

Unit tests cover auth, users, quiz scoring, certificates, search, and role guards (mapped to QA test cases TC-01, TC-07, TC-10, TC-17, TC-NFR-SEC).

## Render deployment

- Bind to `0.0.0.0:$PORT`
- Set `MONGODB_URI`, JWT secrets, Paystack/Resend keys
- Use external object storage for production media (local `uploads/` is for development)
