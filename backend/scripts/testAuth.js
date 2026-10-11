/**
 * Authentication & Session Persistence Test Suite
 *
 * Tests:
 * 1. Login with demo accounts (Resident, Admin, Worker)
 * 2. Token generation and validation via GET /api/auth/me
 * 3. Role enforcement and user profile return
 * 4. Token verification failure for invalid/tampered token
 * 5. Explicit logout via POST /api/logout and subsequent token revocation verification
 * 6. Expired/revoked token rejection (401)
 */

const http = require('http');

const PORT = process.env.PORT || 5001;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(buf) });
          } catch (_) {
            resolve({ status: res.statusCode, data: buf });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('--- STARTING AUTH & SESSION PERSISTENCE TESTS ---');

  // Test 1: Invalid Login
  console.log('\nTest 1: Invalid credentials rejection');
  const badLogin = await request('POST', '/api/login', {
    email: 'resident@test.com',
    password: 'wrongpassword',
  });
  assert(badLogin.status === 401, 'Invalid credentials return 401');
  assert(badLogin.data.success === false, 'success is false');

  // Test 2: Resident Login
  console.log('\nTest 2: Resident login and token generation');
  const resLogin = await request('POST', '/api/login', {
    email: 'resident@test.com',
    password: 'resident123',
  });
  assert(resLogin.status === 200, 'Resident login returns 200');
  assert(resLogin.data.success === true, 'Resident login success is true');
  assert(!!resLogin.data.token, 'Session token is returned');
  assert(resLogin.data.user.role === 'resident', 'User role is resident');
  const residentToken = resLogin.data.token;

  // Test 3: Session Restoration via /api/auth/me for Resident
  console.log('\nTest 3: Restore session via GET /api/auth/me for Resident');
  const resAuthMe = await request('GET', '/api/auth/me', null, {
    Authorization: `Bearer ${residentToken}`,
  });
  assert(resAuthMe.status === 200, 'GET /api/auth/me returns 200 with valid resident token');
  assert(resAuthMe.data.success === true, 'Auth verification succeeds');
  assert(resAuthMe.data.user.role === 'resident', 'Authenticated user role is resident');

  // Test 4: Admin Login and Session Restoration
  console.log('\nTest 4: Admin login and session restoration');
  const adminLogin = await request('POST', '/api/login', {
    email: 'admin@test.com',
    password: 'admin123',
  });
  assert(adminLogin.status === 200, 'Admin login returns 200');
  assert(!!adminLogin.data.token, 'Admin session token is returned');
  assert(adminLogin.data.user.role === 'admin', 'User role is admin');
  const adminToken = adminLogin.data.token;

  const adminAuthMe = await request('GET', '/api/auth/me', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(adminAuthMe.status === 200, 'GET /api/auth/me returns 200 with valid admin token');
  assert(adminAuthMe.data.user.role === 'admin', 'Authenticated user role is admin');

  // Test 5: Worker Login and Session Restoration
  console.log('\nTest 5: Worker login and session restoration');
  const workerLogin = await request('POST', '/api/login', {
    email: 'worker@test.com',
    password: 'worker123',
  });
  assert(workerLogin.status === 200, 'Worker login returns 200');
  assert(!!workerLogin.data.token, 'Worker session token is returned');
  assert(workerLogin.data.user.role === 'worker', 'User role is worker');
  const workerToken = workerLogin.data.token;

  const workerAuthMe = await request('GET', '/api/auth/me', null, {
    Authorization: `Bearer ${workerToken}`,
  });
  assert(workerAuthMe.status === 200, 'GET /api/auth/me returns 200 with valid worker token');
  assert(workerAuthMe.data.user.role === 'worker', 'Authenticated user role is worker');

  // Test 6: Invalid/Tampered Token Rejection
  console.log('\nTest 6: Invalid / tampered token rejection');
  const invalidAuth = await request('GET', '/api/auth/me', null, {
    Authorization: 'Bearer invalid.token.value',
  });
  assert(invalidAuth.status === 401, 'Invalid token returns 401');

  // Test 7: Missing Authorization Token
  console.log('\nTest 7: Missing authorization token');
  const noAuth = await request('GET', '/api/auth/me');
  assert(noAuth.status === 401, 'Missing token returns 401');

  // Test 8: Explicit Logout and Token Revocation
  console.log('\nTest 8: Explicit logout and token revocation');
  const logoutRes = await request('POST', '/api/logout', null, {
    Authorization: `Bearer ${residentToken}`,
  });
  assert(logoutRes.status === 200, 'POST /api/logout returns 200');
  assert(logoutRes.data.success === true, 'Logout returns success true');

  // Test 9: Verify Revoked Token Can No Longer Be Used
  console.log('\nTest 9: Revoked token cannot restore session');
  const postLogoutAuth = await request('GET', '/api/auth/me', null, {
    Authorization: `Bearer ${residentToken}`,
  });
  assert(postLogoutAuth.status === 401, 'Revoked token rejected with 401');

  console.log('\n🎉 ALL AUTHENTICATION AND SESSION PERSISTENCE TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
