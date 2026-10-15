# Postman collection

| File | Purpose |
|---|---|
| `ATUPA-LMS.postman_collection.json` | 137 requests in 20 folders, covering every module |
| `ATUPA-LMS.local.postman_environment.json` | `baseUrl=http://localhost:4000/api/v1`, local admin login |
| `ATUPA-LMS.render.postman_environment.json` | Render URL; fill in `adminEmail` / `adminPassword` |
| `build-collection.py` | Regenerates the files above (`python3 postman/build-collection.py`) |

## Use it

1. In Postman, import the collection and an environment, then select the environment.
2. Make sure `adminEmail` / `adminPassword` match the server's `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.
3. Either **Run collection** (Runner) to execute everything in order, or send requests folder by folder from the top.
   Requests save tokens and ids (`learnerToken`, `courseId`, `classId`...) into collection variables
   for the requests that follow. Each run gets a fresh `runId`, so emails never clash.

Folder 08 walks the seeded Yoruba Beginner course to completion and folder 09 then shows the
auto-issued certificate. This needs `SEED_DEMO_CONTENT=true` (the default) on the server.
Folder 18 contains requests that are expected to be rejected (401/403/400).

Notes:
- **Payments:** checkout returns 503 until `PAYSTACK_SECRET_KEY` is set. With a test key, open
  `authorizationUrl`, pay with a Paystack test card, then run "Verify payment".
- **Media:** "Server upload" needs a file selected in its Body tab. Direct uploads go to Cloudinary using the
  ticket from "Request upload ticket".
- **Expiry:** access tokens last 15 minutes. Re-run the "01 Auth" login requests if you get 401s.

CLI run (same as CI):

```bash
npx newman run postman/ATUPA-LMS.postman_collection.json -e postman/ATUPA-LMS.local.postman_environment.json
```
