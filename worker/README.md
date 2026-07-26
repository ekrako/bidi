# BiDi Report Backend

Cloudflare Worker that turns a "Report an issue" click in the extension popup
into a GitHub issue, keeping the GitHub token off the client.

## Endpoint

`POST /report`

```json
{ "url": "https://…", "dom": "<html>…", "version": "1.0.3", "userAgent": "…" }
```

Response: `201 { "issueUrl": "https://github.com/ekrako/bidi/issues/123" }`

## Deploy

CI deploys automatically on push to `main` when `worker/**` changes
(`.github/workflows/deploy-worker.yml`). Required GitHub repo secrets:

| secret                  | purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare token with Workers deploy permission     |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id                               |
| `WORKER_GITHUB_TOKEN`   | GitHub PAT (`Issues: write` on ekrako/bidi), pushed to the Worker as its `GITHUB_TOKEN` secret each deploy |

Manual deploy:

```sh
cd worker
bunx wrangler deploy
bunx wrangler secret put GITHUB_TOKEN   # fine-grained PAT with Issues: write on ekrako/bidi
```

After the first deploy, set `REPORT_ENDPOINT` in `src/report.ts` to the deployed
Worker URL (`https://bidi-report.<subdomain>.workers.dev/report`) and rebuild the
extension.

## Config

| var             | type   | default   | notes                                            |
| --------------- | ------ | --------- | ------------------------------------------------ |
| `GITHUB_TOKEN`  | secret | —         | required; PAT with `Issues: write`               |
| `GITHUB_OWNER`  | var    | `ekrako`  | repo owner                                        |
| `GITHUB_REPO`   | var    | `bidi`    | repo name                                         |
| `ALLOWED_ORIGIN`| var    | `*`       | lock to `chrome-extension://<id>` in production   |
