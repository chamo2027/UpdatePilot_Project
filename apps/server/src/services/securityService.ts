import { prisma } from '../prisma';

export class SecurityService {
  static async getFindings() {
    return prisma.securityFinding.findMany({
      orderBy: { lastVerifiedTime: 'desc' },
    });
  }

  static async seedKnownAdvisories() {
    const existing = await prisma.securityFinding.count();
    if (existing > 0) return;

    const initialFindings = [
      {
        packageId: 'Git.Git',
        packageName: 'Git for Windows',
        installedVersion: '2.44.0',
        advisoryId: 'CVE-2024-32002',
        title: 'Recursive clones can lead to remote code execution',
        severity: 'critical',
        affectedRange: '< 2.45.1',
        fixedVersion: '2.45.1',
        source: 'NVD / GitHub Security Advisory',
        summary: 'Repositories with submodules can be crafted in a way that exploits a bug in Git on case-insensitive filesystems to execute arbitrary code during a recursive clone.',
      },
      {
        packageId: 'OpenJS.NodeJS.LTS',
        packageName: 'Node.js LTS',
        installedVersion: '20.12.0',
        advisoryId: 'CVE-2024-27980',
        title: 'Command injection via args parameter of child_process.spawn',
        severity: 'high',
        affectedRange: '< 20.12.2',
        fixedVersion: '20.12.2',
        source: 'OpenJS Security Working Group',
        summary: 'On Windows, bat and cmd files can be executed through child_process without proper argument escaping.',
      },
      {
        packageId: '7zip.7zip',
        packageName: '7-Zip',
        installedVersion: '23.01',
        advisoryId: 'CVE-2024-0865',
        title: 'Memory corruption vulnerability in archive extraction',
        severity: 'medium',
        affectedRange: '< 24.01',
        fixedVersion: '24.01',
        source: 'MITRE CVE',
        summary: 'Improper bounds checking when handling corrupted tar or 7z streams could cause an unexpected process termination.',
      },
      {
        packageId: 'Python.Python.3.11',
        packageName: 'Python 3.11',
        installedVersion: '3.11.8',
        advisoryId: 'CVE-2024-4032',
        title: 'ipaddress module accepts leading zeros in IPv4 octets',
        severity: 'medium',
        affectedRange: '< 3.11.9',
        fixedVersion: '3.11.9',
        source: 'Python Software Foundation',
        summary: 'The ipaddress module could misinterpret octal IPv4 string formats, leading to SSRF bypass in applications evaluating IP ranges.',
      },
    ];

    for (const f of initialFindings) {
      await prisma.securityFinding.create({
        data: f,
      });
    }
  }
}
