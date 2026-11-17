-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "osVersion" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "publisher" TEXT,
    "installedVersion" TEXT NOT NULL,
    "availableVersion" TEXT,
    "packageId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'winget',
    "updateStatus" TEXT NOT NULL DEFAULT 'unknown',
    "releaseDate" TEXT,
    "changelogUrl" TEXT,
    "homepageUrl" TEXT,
    "lastScannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseMetadata" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "channel" TEXT,
    "releaseDate" TEXT,
    "changelogUrl" TEXT,
    "releaseNotes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'winget',
    "fetchedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReleaseMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "totalApps" INTEGER NOT NULL DEFAULT 0,
    "updatesFound" INTEGER NOT NULL DEFAULT 0,
    "startMessage" TEXT,
    "errorMessage" TEXT,
    "inventorySnapshot" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpdateJob" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationName" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "fromVersion" TEXT NOT NULL,
    "targetVersion" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "progressPercent" INTEGER DEFAULT 0,
    "progressPhase" TEXT DEFAULT 'queued',
    "progressMessage" TEXT,
    "initiator" TEXT NOT NULL DEFAULT 'user',
    "exitCode" INTEGER,
    "outputLogs" TEXT,
    "verificationResult" TEXT,
    "verifiedVersion" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpdateJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityFinding" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "installedVersion" TEXT NOT NULL,
    "advisoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affectedRange" TEXT NOT NULL,
    "fixedVersion" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OSV / NVD',
    "summary" TEXT NOT NULL,
    "lastVerifiedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "eventType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Device_token_key" ON "Device"("token");
CREATE INDEX "Device_status_idx" ON "Device"("status");
CREATE INDEX "Device_lastSeen_idx" ON "Device"("lastSeen");
CREATE INDEX "Application_deviceId_idx" ON "Application"("deviceId");
CREATE INDEX "Application_updateStatus_idx" ON "Application"("updateStatus");
CREATE INDEX "Application_packageId_idx" ON "Application"("packageId");
CREATE UNIQUE INDEX "Application_deviceId_displayName_packageId_key" ON "Application"("deviceId", "displayName", "packageId");
CREATE INDEX "ReleaseMetadata_packageId_idx" ON "ReleaseMetadata"("packageId");
CREATE UNIQUE INDEX "ReleaseMetadata_packageId_version_key" ON "ReleaseMetadata"("packageId", "version");
CREATE INDEX "ScanJob_deviceId_idx" ON "ScanJob"("deviceId");
CREATE INDEX "ScanJob_state_idx" ON "ScanJob"("state");
CREATE INDEX "UpdateJob_deviceId_idx" ON "UpdateJob"("deviceId");
CREATE INDEX "UpdateJob_applicationId_idx" ON "UpdateJob"("applicationId");
CREATE INDEX "UpdateJob_state_idx" ON "UpdateJob"("state");
CREATE INDEX "SecurityFinding_packageId_idx" ON "SecurityFinding"("packageId");
CREATE INDEX "SecurityFinding_severity_idx" ON "SecurityFinding"("severity");
CREATE INDEX "AuditEvent_deviceId_idx" ON "AuditEvent"("deviceId");
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");

ALTER TABLE "Device" ADD CONSTRAINT "Device_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpdateJob" ADD CONSTRAINT "UpdateJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpdateJob" ADD CONSTRAINT "UpdateJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
