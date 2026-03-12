import { MongoClient } from "mongodb";
import "dotenv/config";

const client = new MongoClient(process.env.MONGODB_URL!);
await client.connect();
const db = client.db("test");

const prop = await db.collection("properties").findOne({ images: { $exists: true, $ne: [] } });
const pg = await db.collection("pgs").findOne({ images: { $exists: true, $ne: [] } });

console.log("=== PROPERTY ===");
console.log("images[0]:", JSON.stringify(prop?.images?.[0], null, 2));
console.log("images[1]:", JSON.stringify(prop?.images?.[1], null, 2));
console.log("amenities[0]:", JSON.stringify(prop?.amenities?.[0], null, 2));
console.log("amenities[1]:", JSON.stringify(prop?.amenities?.[1], null, 2));
console.log("location:", JSON.stringify(prop?.location, null, 2));
console.log("cityLocation:", JSON.stringify(prop?.cityLocation, null, 2));

console.log("\n=== PG ===");
console.log("images[0]:", JSON.stringify(pg?.images?.[0], null, 2));
console.log("amenities[0]:", JSON.stringify(pg?.amenities?.[0], null, 2));
console.log("rooms[0]:", JSON.stringify(pg?.rooms?.[0], null, 2));
console.log("services[0]:", JSON.stringify(pg?.services?.[0], null, 2));
console.log("location:", JSON.stringify(pg?.location, null, 2));

await client.close();
