import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI is not configured in .env.');
}

const databaseName = process.env.MONGODB_DB || 'iproductions';
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const database = client.db(databaseName);
  await database.command({ ping: 1 });

  const existingCollections = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray())
      .map(({ name }) => name),
  );

  for (const collectionName of ['work', 'brands']) {
    if (!existingCollections.has(collectionName)) {
      await database.createCollection(collectionName);
    }

    await database.collection(collectionName).createIndex({ order: 1 });
    console.log(`Ready: ${collectionName}`);
  }

  console.log(`Database setup complete: ${databaseName}`);
} finally {
  await client.close();
}
