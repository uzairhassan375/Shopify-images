# Shopify Image Upload

Next.js app that uploads an image to **Shopify Files** and returns the CDN URL.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env example and fill in your Admin API credentials:

```bash
cp .env.example .env.local
```

Required values in `.env.local`:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_API_ACCESS_TOKEN=shpat_...
SHOPIFY_API_VERSION=2025-01
```

Your Admin API token needs permission to manage files (`write_files` / `read_files`).

3. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Browser sends the image to `POST /api/upload`
2. Server creates a Shopify staged upload target
3. Server uploads the file to Shopify staging storage
4. Server creates a Shopify File (`fileCreate`)
5. Server waits until the file is `READY` and returns the CDN URL
6. Main page shows the preview and CDN URL (with copy button)
