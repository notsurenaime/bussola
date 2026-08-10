import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.BUSSOLA_DATA_DIR
      ? `${process.env.BUSSOLA_DATA_DIR}/bussola.db`
      : "./data/bussola.db",
  },
});
