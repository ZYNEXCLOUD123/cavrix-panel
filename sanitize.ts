import path from 'path';

export function sanitizePath(userPath: string, allowedRoot: string): string | null {
  const resolved = path.resolve(allowedRoot, userPath);
  const normalizedRoot = path.resolve(allowedRoot);

  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    return null;
  }

  // Block symlink-style traversal patterns
  if (userPath.includes('..') || userPath.includes('~')) {
    return null;
  }

  return resolved;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function maskString(str: string, visibleChars = 4): string {
  if (str.length <= visibleChars) return str;
  return '*'.repeat(str.length - visibleChars) + str.slice(-visibleChars);
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'cx_';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const prefix = key.substring(0, 8);
  return { key, hash: key, prefix };
}
