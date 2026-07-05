// @ts-nocheck
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:prismconnex_local@localhost:5432/prismconnex_dev?schema=public",
  },
});
