import os from 'os';

export function getSystemInfo() {
  const platform = os.platform(); // 'win32'
  const release = os.release();
  const hostname = os.hostname();
  const arch = os.arch();

  // Friendly Windows version determination
  let osDisplayName = `Windows (${release})`;
  if (platform === 'win32') {
    const build = parseInt(release.split('.')[2] || '0', 10);
    if (build >= 22000) {
      osDisplayName = `Windows 11 (Build ${build}, ${arch})`;
    } else {
      osDisplayName = `Windows 10 (Build ${build}, ${arch})`;
    }
  }

  return {
    deviceName: hostname,
    osVersion: osDisplayName,
    agentVersion: '1.0.0-mvp',
    arch,
  };
}
