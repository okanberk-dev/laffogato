import { MongoClient, type Db } from "mongodb";

/**
 * MongoDB Atlas bağlantısı. Vercel serverless'te global cached pattern
 * kullanırız — her cold start'ta yeni client kurmamak için.
 *
 * Lazy initialize: modül import edildiğinde connect ÇAĞRILMAZ. İlk
 * `getDb()` çağrısında initialize olur. Bu sayede build/page-data
 * collection sırasında MONGODB_URI olmadan crash etmez.
 */

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function startClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI environment variable is not set. Vercel projesinde MongoDB Atlas integration kurulu olmalı.",
    );
  }
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10000,
  });
  return client.connect();
}

function getClientPromise(): Promise<MongoClient> {
  if (!global.__mongoClientPromise) {
    global.__mongoClientPromise = startClient();
  }
  return global.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const dbName = process.env.MONGODB_DB_NAME || "laffogato";
  return client.db(dbName);
}

export async function getMongoClient(): Promise<MongoClient> {
  return getClientPromise();
}
