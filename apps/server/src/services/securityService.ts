import { z } from 'zod';
import { prisma } from '../prisma';

export interface MappedPackage {
  packageId: string;
  name: string;
  upstream: string;
  ecosystem: string;
  versionPattern: RegExp;
}

export const SUPPORTED_PACKAGES: Record<string, MappedPackage> = {
  'GitHub.cli': {
    packageId: 'GitHub.cli',
    name: 'GitHub CLI',
    upstream: 'github.com/cli/cli/v2',
    ecosystem: 'Go',
    versionPattern: /^2\.\d+\.\d+$/,
  },
  'Git.Git': {
    packageId: 'Git.Git',
    name: 'Git for Windows',
    upstream: 'github.com/git/git',
    ecosystem: 'Go',
    versionPattern: /^2\.\d+\.\d+$/,
  },
};

const responseSchema = z.object({
  vulns: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9-]+$/),
    summary: z.string().optional(),
    withdrawn: z.string().optional(),
    affected: z.array(z.object({
      package: z.object({ name: z.string(), ecosystem: z.string() }).optional(),
    })).optional(),
    database_specific: z.object({ severity: z.string().optional() }).optional(),
  })).optional(),
  next_page_token: z.string().optional(),
});

export type Finding = {
  id: string;
  advisoryId: string;
  title: string;
  summary: string;
  severity: string;
  packageId: string;
  packageName: string;
  source: string;
  affectedRange: string;
  lastVerifiedTime: string;
  advisoryUrl: string;
};

const cache = new Map<string, { expires: number; findings: Promise<Finding[]> }>();

export async function queryPackageAdvisories(pkg: MappedPackage, version: string, fetcher = fetch): Promise<Finding[]> {
  if (!pkg.versionPattern.test(version)) return [];
  const response = await fetcher('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package: { name: pkg.upstream, ecosystem: pkg.ecosystem }, version }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error('OSV advisory service unavailable.');
  const data = responseSchema.parse(await response.json());
  const checked = new Date().toISOString();
  return (data.vulns || [])
    .filter(advisory => !advisory.withdrawn && advisory.affected?.some(item =>
      item.package?.name === pkg.upstream && item.package.ecosystem === pkg.ecosystem))
    .map(advisory => {
      const severity = advisory.database_specific?.severity?.toLowerCase();
      return {
        id: advisory.id + ':' + pkg.packageId + ':' + version,
        advisoryId: advisory.id,
        title: advisory.summary || advisory.id,
        summary: 'OSV matched this upstream version. Check the source for platform and configuration details.',
        severity: severity && ['critical', 'high', 'medium', 'low'].includes(severity) ? severity : 'unknown',
        packageId: pkg.packageId,
        packageName: pkg.name,
        source: 'OSV',
        affectedRange: version,
        lastVerifiedTime: checked,
        advisoryUrl: 'https://osv.dev/vulnerability/' + advisory.id,
      };
    });
}

export async function queryGitHubCliAdvisories(version: string, fetcher = fetch): Promise<Finding[]> {
  const pkg = SUPPORTED_PACKAGES['GitHub.cli'];
  const findings = await queryPackageAdvisories(pkg, version, fetcher);
  return findings.map(f => ({ ...f, id: f.advisoryId + ':' + version }));
}

export class SecurityService {
  static async getFindings(applicationId?: string) {
    if (process.env.ENABLE_OSV_ADVISORIES !== 'true') return [];
    const supportedIds = Object.keys(SUPPORTED_PACKAGES);
    const packages = await prisma.application.findMany({
      where: {
        id: applicationId,
        packageId: { in: supportedIds },
        source: 'winget',
        updateStatus: { in: ['up_to_date', 'update_available'] },
        device: { status: { not: 'unpaired' } },
      },
      select: { packageId: true, installedVersion: true },
      distinct: ['packageId', 'installedVersion'],
      take: 24,
    });

    const findings = await Promise.all(packages.map(({ packageId, installedVersion }) => {
      const pkg = packageId ? SUPPORTED_PACKAGES[packageId] : undefined;
      if (!pkg) return Promise.resolve([]);
      const cacheKey = `${pkg.packageId}:${installedVersion}`;
      const now = Date.now();
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > now) return cached.findings;
      const entry = {
        expires: now + 60 * 60_000,
        findings: pkg.packageId === 'GitHub.cli'
          ? queryGitHubCliAdvisories(installedVersion)
          : queryPackageAdvisories(pkg, installedVersion),
      };
      entry.findings = entry.findings.catch(() => {
        entry.expires = Date.now() + 5 * 60_000;
        return [];
      });
      if (cache.size >= 128) cache.clear();
      cache.set(cacheKey, entry);
      return entry.findings;
    }));
    return findings.flat();
  }
}
