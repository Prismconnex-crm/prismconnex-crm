-- CreateTable
CREATE TABLE "SavedCompany" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedCompany_workspaceId_idx" ON "SavedCompany"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCompany_workspaceId_companyId_key" ON "SavedCompany"("workspaceId", "companyId");

-- AddForeignKey
ALTER TABLE "SavedCompany" ADD CONSTRAINT "SavedCompany_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
