'use client';
let owner: string | null = null;
export function claimPortalNotice(name: string) {
  if (owner !== null && owner !== name) return false;
  owner = name; return true;
}
export function releasePortalNotice(name: string) { if (owner === name) owner = null; }
