import { MongoClient } from 'mongodb';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let mongoClient;
let adminAuth;
const allowedAdminEmails = new Set([
  'ramithk69@gmail.com',
  'isuru.withanage123@gmail.com',
]);

export async function collection(name) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');

  if (!mongoClient) {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
  }
  return mongoClient.db(process.env.MONGODB_DB || 'iproductions').collection(name);
}

function getAdminAuth() {
  if (!adminAuth) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured.');

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT must contain valid JSON.');
    }

    const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

export async function requireOwner(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    return decoded.email_verified === true &&
      typeof decoded.email === 'string' &&
      allowedAdminEmails.has(decoded.email.trim().toLowerCase());
  } catch {
    return false;
  }
}

export function sendError(res, error) {
  if (error.message === 'MONGODB_URI is not configured.' ||
      error.message === 'FIREBASE_SERVICE_ACCOUNT is not configured.' ||
      error.message === 'FIREBASE_SERVICE_ACCOUNT must contain valid JSON.') {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: 'The request could not be completed.' });
}

export function validImage(image) {
  return image === null || image === undefined ||
    (typeof image === 'string' &&
      image.length <= 3_000_000 &&
      /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(image));
}

export function validExternalUrl(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}
