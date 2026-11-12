# iProductions site

The site is a React/Vite app. Public work and brand entries are stored in MongoDB. Google sign-in is provided by Firebase Authentication; the API verifies each Firebase ID token and permits writes only for `ramithk69@gmail.com` or `isuru.withanage123@gmail.com`.

## Configure services

1. Create a Firebase project, enable **Authentication → Google**, and add your deployed domain to Firebase's authorized domains. Create a Firebase Web App and copy its API key, auth domain, project ID, and app ID.
2. Create a MongoDB database/user (for example, in MongoDB Atlas) and allow your hosting provider to connect to the cluster.
3. Create a Firebase service-account key in Firebase project settings. Keep the key private; the API uses it to verify sign-in tokens.
4. Copy `.env.example` to `.env` for local work, or add the values as environment variables in your hosting provider:

   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`: Firebase Web App settings.
   - `MONGODB_URI`: the MongoDB connection string.
   - `MONGODB_DB`: database name (defaults to `iproductions`).
   - `FIREBASE_SERVICE_ACCOUNT`: the complete service-account JSON on one line. Keep it server-side; never prefix it with `VITE_`.

The Login button opens the admin panel only after a Google sign-in with one of the two allowed email addresses. The email allowlist is checked in the UI and independently enforced by the API, so changing browser settings cannot grant write access. Update the allowlist in both `src/firebase.js` and `api/_lib.js` if the authorized accounts change.

## Run and deploy

```sh
npm install
npm run dev
```

`npm run dev` starts both the Vite frontend and a local API server for `/api/work` and `/api/brands`. The API reads `.env` and connects to the configured MongoDB database. Firebase service-account credentials are required for authenticated admin writes.

Deploy the project to Vercel with the environment variables above. Vercel detects the Vite app and the `api/` functions automatically. After changing the Firebase web settings or owner email, rebuild/redeploy the site.

## Initialize MongoDB

The configured MongoDB connection has been verified. Run `npm run db:setup` from the project directory to create the `work` and `brands` collections, if needed, and add indexes used to display entries in saved order. The database name comes from `MONGODB_DB` or defaults to `iproductions`. The command does not delete or overwrite existing documents.

## Data management

The owner-only admin panel can add, delete, and reorder work and brands. Images are stored as data URLs in MongoDB and are limited to 2 MB per upload. Public visitors can read published work and brands; only the owner can change them.
