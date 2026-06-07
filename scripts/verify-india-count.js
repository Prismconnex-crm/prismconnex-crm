const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const i = await p.$queryRawUnsafe("SELECT COUNT(*) as cnt FROM Company WHERE headquarters LIKE '%India%'");
  console.log('Indian Companies:', JSON.stringify(i, (k,v) => typeof v === 'bigint' ? Number(v) : v));
  await p.$disconnect();
})();
