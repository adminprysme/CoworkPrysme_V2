/**
 * One-off profiler: counts Mongo operations during slot generation for one month.
 * Usage: set -a && source .env && set +a && node scripts/profile-slot-generation.mjs
 */
import mongoose from "mongoose";

const mongoOps = { find: 0, other: 0 };

mongoose.set("debug", (_collectionName, method) => {
  if (method === "find" || method === "findOne" || method === "countDocuments") {
    mongoOps.find += 1;
    return;
  }
  if (method !== "createIndex" && method !== "ensureIndex") {
    mongoOps.other += 1;
  }
});

const { connectMongo, getSpaceModel } = await import("@coworkprysme/db");
const { AvailabilityService } = await import("../dist/booking/availability.service.js");
const { SlotGenerationService } = await import("../dist/booking/slot-generation.service.js");

const SPACE_ID = process.argv[2] ?? "6a4fa8240a137dd59bf824fc";
const RANGE_START = new Date("2026-09-01T00:00:00.000Z");
const RANGE_END = new Date("2026-09-30T23:59:59.999Z");

await connectMongo();
const Space = await getSpaceModel();
const space = await Space.findById(SPACE_ID).lean().exec();
if (!space) {
  console.error("Space not found:", SPACE_ID);
  process.exit(1);
}

const availability = new AvailabilityService();
const slotGeneration = new SlotGenerationService(availability);

function resetMongoOps() {
  mongoOps.find = 0;
  mongoOps.other = 0;
}

resetMongoOps();
const slotStarted = performance.now();
const slots = await slotGeneration.generateSlots(space, RANGE_START, RANGE_END);
const slotElapsedMs = performance.now() - slotStarted;
const slotMongoOps = { ...mongoOps };

resetMongoOps();
const searchStarted = performance.now();
await availability.filterAvailableSpaces([space], RANGE_START, RANGE_END);
const searchElapsedMs = performance.now() - searchStarted;
const searchMongoOps = { ...mongoOps };

const hourly = slots.filter((slot) => slot.durationClass === "hourly").length;
const daily = slots.filter((slot) => slot.durationClass === "daily").length;

console.log(
  JSON.stringify(
    {
      spaceId: SPACE_ID,
      spaceName: space.name,
      range: { start: RANGE_START.toISOString(), end: RANGE_END.toISOString() },
      slotGeneration: {
        slots: { total: slots.length, hourly, daily },
        mongoOps: { ...slotMongoOps, total: slotMongoOps.find + slotMongoOps.other },
        elapsedMs: Math.round(slotElapsedMs),
      },
      parcoursASearch: {
        spacesChecked: 1,
        mongoOps: { ...searchMongoOps, total: searchMongoOps.find + searchMongoOps.other },
        elapsedMs: Math.round(searchElapsedMs),
      },
    },
    null,
    2,
  ),
);

await mongoose.disconnect();
