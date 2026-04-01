-- AlterTable
ALTER TABLE "OAuthClient" ADD COLUMN     "appUrl" TEXT,
ADD COLUMN     "iconUrl" TEXT;

-- CreateTable
CREATE TABLE "UserApplicationAccess" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserApplicationAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserApplicationAccess_userId_idx" ON "UserApplicationAccess"("userId");

-- CreateIndex
CREATE INDEX "UserApplicationAccess_applicationId_idx" ON "UserApplicationAccess"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserApplicationAccess_userId_applicationId_key" ON "UserApplicationAccess"("userId", "applicationId");

-- AddForeignKey
ALTER TABLE "UserApplicationAccess" ADD CONSTRAINT "UserApplicationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApplicationAccess" ADD CONSTRAINT "UserApplicationAccess_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
