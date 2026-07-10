import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { registerServiceModel } from "../domains/pricing/service.schema.js";

describe("service schema", () => {
  it("declares a unique key index", () => {
    const connection = mongoose.createConnection();
    registerServiceModel(connection);
    const schema = connection.models.Service!.schema;
    const indexes = schema.indexes();

    expect(indexes).toEqual(expect.arrayContaining([[{ key: 1 }, { unique: true }]]));
    void connection.close();
  });

  it("persists optional description and centimes priceHT", () => {
    const connection = mongoose.createConnection();
    const Service = registerServiceModel(connection);
    const doc = new Service({
      key: "cafe-premium",
      label: "Café premium",
      description: "Boisson chaude servie au bar",
      priceHT: 1999,
      vatRate: 20,
      promoEligible: true,
      status: "active",
    });

    const error = doc.validateSync();
    expect(error).toBeUndefined();
    expect(doc.description).toBe("Boisson chaude servie au bar");
    expect(doc.priceHT).toBe(1999);
    void connection.close();
  });
});
