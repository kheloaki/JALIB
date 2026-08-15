# library-jamaa

Copy of the MATJAR app codebase with a **separate** environment and Convex database.

## First-time setup (new database)

```bash
cd ~/Desktop/library-jamaa
npm install

# Creates a NEW Convex project/database (do not select the MATJAR deployment)
npx convex dev
```

When prompted:
1. Log in to Convex if needed
2. **Create a new project** named `library-jamaa` (or team project with that name)
3. Accept writing env vars into `.env.local`

Then in another terminal:

```bash
npm run dev
```

Open the URL shown (usually http://localhost:3000).

## Important

- Do **not** copy `.env.local` from MATJAR — that would share the same database.
- This folder starts with empty Convex URLs on purpose.
- Optional: set `TINIFY_API_KEY` and VAPID keys in `.env.local` + Convex dashboard.
