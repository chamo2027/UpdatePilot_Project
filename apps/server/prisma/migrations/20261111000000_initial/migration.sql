-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "osVersion" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "lastScannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReleaseMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "channel" TEXT,
    "releaseDate" TEXT,
    "changelogUrl" TEXT,
    "releaseNotes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'winget',
    "fetchedTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "totalApps" INTEGER NOT NULL DEFAULT 0,
    "updatesFound" INTEGER NOT NULL DEFAULT 0,
    "startMessage" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UpdateJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationName" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "fromVersion" TEXT NOT NULL,
    "targetVersion" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "initiator" TEXT NOT NULL DEFAULT 'user',
    "exitCode" INTEGER,
    "outputLogs" TEXT,
    "verificationResult" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpdateJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UpdateJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "lastVerifiedTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "eventType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Device_token_key" ON "Device"("token");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_lastSeen_idx" ON "Device"("lastSeen");

-- CreateIndex
CREATE INDEX "Application_deviceId_idx" ON "Application"("deviceId");

-- CreateIndex
CREATE INDEX "Application_updateStatus_idx" ON "Application"("updateStatus");

-- CreateIndex
CREATE INDEX "Application_packageId_idx" ON "Application"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_deviceId_displayName_packageId_key" ON "Application"("deviceId", "displayName", "packageId");

-- CreateIndex
CREATE INDEX "ReleaseMetadata_packageId_idx" ON "ReleaseMetadata"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseMetadata_packageId_version_key" ON "ReleaseMetadata"("packageId", "version");

-- CreateIndex
CREATE INDEX "ScanJob_deviceId_idx" ON "ScanJob"("deviceId");

-- CreateIndex
CREATE INDEX "ScanJob_state_idx" ON "ScanJob"("state");

-- CreateIndex
CREATE INDEX "UpdateJob_deviceId_idx" ON "UpdateJob"("deviceId");

-- CreateIndex
CREATE INDEX "UpdateJob_applicationId_idx" ON "UpdateJob"("applicationId");

-- CreateIndex
CREATE INDEX "UpdateJob_state_idx" ON "UpdateJob"("state");

-- CreateIndex
CREATE INDEX "SecurityFinding_packageId_idx" ON "SecurityFinding"("packageId");

-- CreateIndex
CREATE INDEX "SecurityFinding_severity_idx" ON "SecurityFinding"("severity");

-- CreateIndex
CREATE INDEX "AuditEvent_deviceId_idx" ON "AuditEvent"("deviceId");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");

