# Hospital Dashboard Backend

Node.js Express backend in TypeScript for the Hospital Marketing Analytics Dashboard.

## Tech Stack

- Node.js
- Express
- TypeScript
- axios
- node-cache
- cors
- dotenv
- express-rate-limit

## Getting Started

```bash
npm install
npm run dev
```

The API runs on `http://localhost:5000` by default.

## Environment

Create `.env` from `.env.example` and set:

```bash
PORT=5000
FRONTEND_URL=http://localhost:3000
CLARITY_API_TOKEN=your_clarity_export_token
```

## Routes

- `GET /api/health` - backend health and Clarity configuration status
- `GET /api/clarity` - Microsoft Clarity analytics data
- `GET /api/settings/keyword-map` - referral keyword mappings
- `POST /api/settings/keyword-map` - save referral keyword mappings

## Settings Data

The `/data/keywordMap.json` file is gitignored. On first deploy, the default mappings are used. Any changes made via Settings page are saved locally.

## Clarity Caching

Microsoft Clarity Data Export API allows 10 requests per day. The backend caches Clarity responses for 8640 seconds, or 2.4 hours, so normal dashboard use does not burn through the daily limit.

The Clarity service intentionally does not retry failed requests.

## Deployment Notes

After deploying this backend to Railway:

1. Copy the Railway URL, for example `https://xxx.railway.app`.
2. Set `NEXT_PUBLIC_BACKEND_URL` in Netlify to the Railway URL.
3. Set `FRONTEND_URL` in Railway to the Netlify app URL.
