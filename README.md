# WriteSpace

Browser-local blogging demo built with React 18, JavaScript JSX, React Router 6, Vite 5 and Tailwind 3. Guests preview writing; registered authors manage their posts; Admin manages all posts and eligible accounts. Four dashboard statistics intentionally include a repeated Total Users metric pending product clarification.

## Important limits
This is **not a secure hosted multi-user service**. Passwords are plaintext in localStorage. Client guards are bypassable demo controls. Never use real passwords or sensitive information. Data remains in this browser profile, does not sync across devices, and is lost when browser storage is cleared. Concurrent tabs use last-writer-wins updates. No backend, API, database, recovery or audit service exists.

## Run
Use Node 20 (verified 20.18.1; Playwright 1.48 discovery hangs under the sandbox's Node 24).

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev
```
Open the development URL printed by Vite. Demo Admin: `admin` / `admin`. Use only disposable demo passwords for other accounts.

## Test and build
From frontend:
```sh
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
npm run build
npm run preview
```
643 unit/component tests and 26 Playwright journeys passed. The independent critic passed round 2 at 1.0, zero high failures. Unit fault injection covers invalid storage, quota/write failures, partial registration and stale ownership. Browser journeys exercise real local persistence, role guards, mobile menus and account/post lifecycles.

`node scripts/preflight.js` captures accessibility/style/HTML evidence and screenshots with a preview at `PREFLIGHT_URL` (default localhost:4173). Start preview in the same command/session if the sandbox terminates background descendants.

## Static container and AWS handoff
From repository root:
```sh
docker build -t writespace ./frontend
docker run --rm -p 8080:80 writespace
```
The two-stage image serves built assets with nginx on 0.0.0.0:80, root health `/`, SPA fallback and missing assets 404. No proxy or user-data volume. Image build, nginx config and root/blogs/admin/users 200 plus missing asset 404 were verified inside the sandbox container. Fullstack compose is not applicable.

DevOps owns AWS ECR/ECS frontend service, shared ALB/VPC and application CloudFront promotion. No AWS infrastructure was provisioned or claimed verified by Development. Promote immutable images, check root/direct routes through the actual edge, and roll back to the previous image if smoke checks fail. Scaling containers never shares browser records.

## Layout
`frontend/src/utils` contains guarded persistence and pure/domain rules; focused pages/components consume them. `frontend/e2e` contains feature journeys, `frontend/Dockerfile` and `nginx.conf` own static serving. `graphify-out/graph.json` records the final code graph. Pipeline plan/test/source metadata remains workspace-only.
