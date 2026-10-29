import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

// Isolated routing checks: no application server or database queries required.
process.env.JWT_SECRET = 'agreement-routing-test-secret-at-least-32-characters';

const portals = [
  { host: 'sa.nisaab360.app', prefix: '/sa', role: 'SUPER_ADMIN' },
  { host: 'superadmin.nisaab360.app', prefix: '/sa', role: 'SUPER_ADMIN' },
  { host: 'sa.localhost:3000', prefix: '/sa', role: 'SUPER_ADMIN' },
  { host: 'employee.nisaab360.app', prefix: '/employee', role: 'EMPLOYEE' },
  { host: 'employee.localhost:3000', prefix: '/employee', role: 'EMPLOYEE' },
];

for (const host of ['student.nisaab360.app', 'staff.nisaab360.app', 'parent.nisaab360.app', 'institution.nisaab360.app', 'employee.nisaab360.app', 'sa.nisaab360.app', 'school.nisaab360.app', 'student.localhost:3000']) {
  test(`updated terms remain a shared public document on ${host}`, async () => {
    const response = await proxy(new NextRequest(`http://${host}/terms-of-service`, { headers: { host } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-middleware-next'), '1');
    assert.equal(response.headers.get('x-middleware-rewrite'), null);
  });
}

for (const { host, prefix, role } of portals) {
  test(`agreement stays reachable and dashboard stays protected on ${host}`, async () => {
    const token = await new SignJWT({ userId: 1, role, mustChangePassword: false })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const headers = { host, cookie: `access_token=${token}` };
    const url = `http://${host}/agreement-nisaab360?id=42`;
    const request = new NextRequest(url, { headers });
    const agreement = await proxy(request);
    assert.equal(agreement.status, 200);
    assert.equal(agreement.headers.get('x-middleware-next'), '1');
    assert.equal(agreement.headers.get('x-middleware-rewrite'), null);
    assert.equal(request.nextUrl.searchParams.get('id'), '42');

    for (const query of ['?id=1&_rsc=regression', '?_rsc=regression']) {
      const prefetch = await proxy(new NextRequest(`http://${host}/agreement-nisaab360${query}`, {
        headers: { ...headers, rsc: '1', 'next-router-prefetch': '1' },
      }));
      assert.equal(prefetch.status, 200);
      assert.equal(prefetch.headers.get('x-middleware-next'), '1');
      assert.equal(prefetch.headers.get('x-middleware-rewrite'), null);
    }

    const dashboard = await proxy(new NextRequest(`http://${host}/dashboard`, { headers }));
    assert.equal(new URL(dashboard.headers.get('x-middleware-rewrite')!).pathname, `${prefix}/dashboard`);

    const anonymous = await proxy(new NextRequest(`http://${host}/dashboard`, { headers: { host } }));
    assert.equal(anonymous.status, 307);
    assert.equal(new URL(anonymous.headers.get('location')!).pathname,
      role === 'SUPER_ADMIN' ? '/login/super-admin' : '/employee-login');
  });
}

test('agreement still enforces required password changes', async () => {
  const token = await new SignJWT({ userId: 1, role: 'SUPER_ADMIN', mustChangePassword: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const response = await proxy(new NextRequest('http://sa.nisaab360.app/agreement-nisaab360?id=42', {
    headers: { host: 'sa.nisaab360.app', cookie: `access_token=${token}` },
  }));
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location')!).pathname, '/force-password-change');
});
