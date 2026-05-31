import { PrismaClient } from "@prisma/client";
import { inferCompanyRegion, type CompanyRegion } from "../lib/company-classification";

const prisma = new PrismaClient({ log: ["error"] });

type BackfillCandidate = {
  id: string;
  name: string;
  headquarters: string | null;
  region: string | null;
};

type RegionUpdate = BackfillCandidate & {
  inferredRegion: CompanyRegion;
};

const args = new Set(process.argv.slice(2));

function readNumericArg(name: string, fallback: number) {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = raw ? Number.parseInt(raw, 10) : fallback;

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function updateRegionBatch(rows: RegionUpdate[]) {
  const chunkSize = 100;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);

    await prisma.$transaction(
      chunk.map((row) =>
        prisma.company.update({
          where: { id: row.id },
          data: { region: row.inferredRegion },
        })
      )
    );
  }
}

async function main() {
  const apply = args.has("--apply");
  const batchSize = readNumericArg("--batchSize", 1000);
  const limit = readNumericArg("--limit", Number.MAX_SAFE_INTEGER);

  let cursor: { id: string } | undefined;
  let processed = 0;
  let inferable = 0;
  let mismatched = 0;
  let updated = 0;
  const samples: RegionUpdate[] = [];

  while (processed < limit) {
    const rows: BackfillCandidate[] = await prisma.company.findMany({
      take: Math.min(batchSize, limit - processed),
      ...(cursor ? { cursor, skip: 1 } : {}),
      orderBy: { id: "asc" },
      where: { headquarters: { not: null } },
      select: {
        id: true,
        name: true,
        headquarters: true,
        region: true,
      },
    });

    if (rows.length === 0) {
      break;
    }

    const updates: RegionUpdate[] = [];

    for (const row of rows) {
      const inferredRegion = inferCompanyRegion(row.headquarters);

      if (!inferredRegion) {
        continue;
      }

      inferable += 1;

      if (row.region !== inferredRegion) {
        const update = { ...row, inferredRegion };

        updates.push(update);
        mismatched += 1;

        if (samples.length < 10) {
          samples.push(update);
        }
      }
    }

    if (apply && updates.length > 0) {
      await updateRegionBatch(updates);
      updated += updates.length;
    }

    processed += rows.length;
    cursor = { id: rows[rows.length - 1].id };
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        processed,
        inferable,
        mismatched,
        updated,
        samples: samples.map((sample) => ({
          id: sample.id,
          name: sample.name,
          headquarters: sample.headquarters,
          currentRegion: sample.region,
          inferredRegion: sample.inferredRegion,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
