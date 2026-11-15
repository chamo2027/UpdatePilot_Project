import { Request, Response, Router } from 'express';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'UpdatePilot API',
    version: '1.0.0',
    description: 'REST API for UpdatePilot: Software Update Intelligence & Management Platform on Windows hosts.',
    contact: {
      name: 'UpdatePilot Engineering',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Local UpdatePilot Server API v1',
    },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'updatepilot_session',
        description: 'HTTP-only authenticated session cookie for operator dashboard',
      },
      agentBearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Cryptographic bearer token issued to local agent during secure pairing',
      },
    },
    schemas: {
      DashboardMetrics: {
        type: 'object',
        properties: {
          totalApplications: { type: 'integer', example: 42 },
          updatesAvailable: { type: 'integer', example: 3 },
          upToDate: { type: 'integer', example: 35 },
          unsupportedOrUnknown: { type: 'integer', example: 4 },
          securityAdvisoriesCount: { type: 'integer', example: 1 },
          connectedDevices: { type: 'integer', example: 1 },
          lastScanTime: { type: 'string', format: 'date-time', nullable: true },
          agentStatus: { type: 'string', enum: ['online', 'offline', 'unpaired'], example: 'online' },
        },
      },
      Application: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string', format: 'uuid' },
          displayName: { type: 'string', example: 'Git' },
          publisher: { type: 'string', nullable: true, example: 'The Git Development Community' },
          installedVersion: { type: 'string', example: '2.43.0' },
          availableVersion: { type: 'string', nullable: true, example: '2.44.0' },
          packageId: { type: 'string', nullable: true, example: 'Git.Git' },
          source: { type: 'string', enum: ['winget', 'registry', 'manual'], example: 'winget' },
          updateStatus: { type: 'string', enum: ['up_to_date', 'update_available', 'unknown', 'unsupported'], example: 'update_available' },
          releaseDate: { type: 'string', nullable: true, example: '2024-02-23' },
          changelogUrl: { type: 'string', format: 'uri', nullable: true },
          homepageUrl: { type: 'string', format: 'uri', nullable: true },
          lastScannedAt: { type: 'string', format: 'date-time' },
        },
      },
      Device: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'DESKTOP-WIN11' },
          osVersion: { type: 'string', example: 'Windows 11 Pro 10.0.22631' },
          agentVersion: { type: 'string', example: '1.0.0-mvp' },
          lastSeen: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['online', 'offline', 'unpaired'] },
        },
      },
      UpdatePreview: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', format: 'uuid' },
          displayName: { type: 'string', example: 'Visual Studio Code' },
          packageId: { type: 'string', example: 'Microsoft.VisualStudioCode' },
          currentVersion: { type: 'string', example: '1.85.0' },
          targetVersion: { type: 'string', example: '1.86.0' },
          source: { type: 'string', example: 'winget' },
          deviceId: { type: 'string', format: 'uuid' },
          deviceName: { type: 'string', example: 'DESKTOP-WIN11' },
          safetyCheck: {
            type: 'object',
            properties: {
              supportedSource: { type: 'boolean', example: true },
              knownPackageIdentifier: { type: 'boolean', example: true },
              majorVersionJump: { type: 'boolean', example: false },
              requiresElevation: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Package is matched to the Windows Package Manager community source.' },
            },
          },
        },
      },
      UpdateJob: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string', format: 'uuid' },
          applicationId: { type: 'string', format: 'uuid' },
          applicationName: { type: 'string', example: 'Git' },
          packageId: { type: 'string', example: 'Git.Git' },
          fromVersion: { type: 'string', example: '2.43.0' },
          targetVersion: { type: 'string', example: '2.44.0' },
          state: {
            type: 'string',
            enum: ['pending_confirmation', 'queued', 'in_progress', 'succeeded', 'failed', 'cancelled', 'restart_required'],
            example: 'queued',
          },
          initiator: { type: 'string', example: 'user' },
          exitCode: { type: 'integer', nullable: true, example: 0 },
          outputLogs: { type: 'string', nullable: true },
          verificationResult: { type: 'string', nullable: true, example: 'Verified successfully' },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      SecurityFinding: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          advisoryId: { type: 'string', example: 'GHSA-xxx' },
          title: { type: 'string' },
          summary: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'unknown'] },
          packageId: { type: 'string', example: 'GitHub.cli' },
          packageName: { type: 'string', example: 'GitHub CLI' },
          source: { type: 'string', example: 'OSV' },
          affectedRange: { type: 'string', example: '2.40.0' },
          lastVerifiedTime: { type: 'string', format: 'date-time' },
          advisoryUrl: { type: 'string', format: 'uri' },
        },
      },
      AuditEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string', format: 'uuid', nullable: true },
          actor: { type: 'string', example: 'user' },
          eventType: { type: 'string', example: 'UPDATE_CONFIRMED' },
          target: { type: 'string', example: 'Git (2.43.0 -> 2.44.0)' },
          metadata: { type: 'string', nullable: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/dashboard': {
      get: {
        summary: 'Get dashboard overview statistics',
        tags: ['Dashboard'],
        security: [{ sessionCookie: [] }],
        responses: {
          200: {
            description: 'Summary statistics for fleet health and update status',
            content: { 'application/json': { schema: { properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/DashboardMetrics' } } } } },
          },
          401: { description: 'Unauthorized session' },
        },
      },
    },
    '/devices': {
      get: {
        summary: 'List paired devices and their online status',
        tags: ['Devices'],
        security: [{ sessionCookie: [] }],
        responses: {
          200: {
            description: 'List of paired devices',
            content: { 'application/json': { schema: { properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Device' } } } } } },
          },
        },
      },
    },
    '/devices/pair': {
      post: {
        summary: 'Securely pair a local Windows host agent',
        tags: ['Devices'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceName', 'osVersion', 'agentVersion'],
                properties: {
                  deviceName: { type: 'string', example: 'DESKTOP-WIN11' },
                  osVersion: { type: 'string', example: 'Windows 11 Pro 10.0.22631' },
                  agentVersion: { type: 'string', example: '1.0.0-mvp' },
                  pairingCode: { type: 'string' },
                  pairingToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Agent paired successfully, returns device ID and bearer token' },
          403: { description: 'Pairing refused or invalid credentials' },
        },
      },
    },
    '/devices/{id}/revoke': {
      post: {
        summary: 'Revoke an agent token and decommission a device',
        tags: ['Devices'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Device revoked' },
        },
      },
    },
    '/devices/{id}/scans': {
      post: {
        summary: 'Start an asynchronous host scan job',
        tags: ['Scans'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          202: { description: 'Scan job queued successfully' },
        },
      },
    },
    '/scans/{id}': {
      get: {
        summary: 'Get status and result of a scan job',
        tags: ['Scans'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Scan job details' },
          404: { description: 'Scan job not found' },
        },
      },
    },
    '/applications': {
      get: {
        summary: 'Search, filter, sort and paginate application inventory',
        tags: ['Applications'],
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'up_to_date', 'update_available', 'unknown', 'unsupported'] } },
          { name: 'source', in: 'query', schema: { type: 'string', enum: ['all', 'winget', 'registry'] } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['displayName', 'updateStatus', 'publisher', 'lastScannedAt'] } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: {
            description: 'Paginated list of applications',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    items: { type: 'array', items: { $ref: '#/components/schemas/Application' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    pageSize: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/applications/{id}': {
      get: {
        summary: 'Get details for a specific application including release metadata and advisories',
        tags: ['Applications'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Application specifications and execution history' },
          404: { description: 'Application not found' },
        },
      },
    },
    '/updates': {
      get: {
        summary: 'List applications with available verified upgrades',
        tags: ['Updates'],
        security: [{ sessionCookie: [] }],
        responses: {
          200: {
            description: 'List of upgrade candidates',
            content: { 'application/json': { schema: { properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Application' } } } } } },
          },
        },
      },
    },
    '/updates/{id}/preview': {
      post: {
        summary: 'Validate and preview an update proposal before confirmation',
        tags: ['Updates'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Update preview and safety check result',
            content: { 'application/json': { schema: { properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/UpdatePreview' } } } } },
          },
          400: { description: 'Invalid application or unsupported package' },
        },
      },
    },
    '/updates/{id}/execute': {
      post: {
        summary: 'Execute a confirmed update after explicit operator authorization',
        tags: ['Updates'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['applicationId', 'targetVersion', 'confirmedByUser'],
                properties: {
                  applicationId: { type: 'string', format: 'uuid' },
                  targetVersion: { type: 'string', example: '2.44.0' },
                  confirmedByUser: { type: 'boolean', enum: [true] },
                },
              },
            },
          },
        },
        responses: {
          202: { description: 'Update job confirmed and queued for agent claim' },
          400: { description: 'Validation failed or unconfirmed by user' },
        },
      },
    },
    '/jobs/{id}': {
      get: {
        summary: 'Get update job progress, logs, and verification status',
        tags: ['Updates'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Update job details' },
          404: { description: 'Job not found' },
        },
      },
    },
    '/jobs/{id}/cancel': {
      post: {
        summary: 'Cancel a queued update job before execution starts',
        tags: ['Updates'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Job cancelled' },
          409: { description: 'Only queued updates can be cancelled' },
        },
      },
    },
    '/history': {
      get: {
        summary: 'Get immutable audit event logs',
        tags: ['History'],
        security: [{ sessionCookie: [] }],
        responses: {
          200: {
            description: 'List of audit events',
            content: { 'application/json': { schema: { properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/AuditEvent' } } } } } },
          },
        },
      },
    },
    '/reports/{kind}': {
      get: {
        summary: 'Export complete inventory or update datasets',
        tags: ['History'],
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'kind', in: 'path', required: true, schema: { type: 'string', enum: ['inventory', 'updates'] } }],
        responses: {
          200: { description: 'Export records' },
        },
      },
    },
    '/security/findings': {
      get: {
        summary: 'Get verified security advisories (OSV) for installed packages',
        tags: ['Security'],
        security: [{ sessionCookie: [] }],
        responses: {
          200: {
            description: 'List of verified security advisories',
            content: { 'application/json': { schema: { properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/SecurityFinding' } } } } } },
          },
        },
      },
    },
  },
};

export function setupSwagger(router: Router) {
  // Expose JSON specification
  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });
}

export function renderSwaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UpdatePilot API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .topbar { display: none !important; }
    .swagger-ui .info .title { color: #f8fafc; }
    .swagger-ui .info p, .swagger-ui .info li { color: #94a3b8; }
    .swagger-ui .scheme-container { background: #0f172a; border-bottom: 1px solid #1e293b; box-shadow: none; }
    .swagger-ui .opblock { border-radius: 8px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}

