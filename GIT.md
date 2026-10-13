# Git & GitHub for this project

## Repository

https://github.com/Verba-Limited/atupa-lms-backend

## Which GitHub account to use

Use a **Verba-Limited** member account with write access (e.g. **kanmitcode**).

Do **not** use enterprise MTN personal accounts for this repo — they cannot push to Verba-Limited org repos.

## One-time setup

```bash
gh auth logout -h github.com   # if the wrong account is active
gh auth login                  # choose GitHub.com → HTTPS → login as kanmitcode (or your Verba org account)
gh auth setup-git
```

If `git push` still fails, remove stale credentials:

- macOS **Keychain Access** → search `github.com` → delete old GitHub entries, then `gh auth login` again.

## Push

```bash
cd atupa-lms/backend
git remote set-url origin https://github.com/Verba-Limited/atupa-lms-backend.git
git push -u origin main
```

Verify the active user before pushing:

```bash
gh auth status
```

The logged-in account must **not** be an MTN enterprise user without org access.
