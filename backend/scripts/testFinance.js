/**
 * Finance Module API Test Script (isolated)
 *
 * Creates a dedicated test community + admin + resident through the
 * onboarding APIs, approves the resident, then exercises the full
 * finance flow. Cleanup removes the test community at the end.
 *
 * Usage: node scripts/testFinance.js
 */

const http = require('http');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: 'localhost',
        port: 5001,
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
          } catch (e) {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now();
const TEST_EMAIL = `financetest${stamp}@test.com`;
const TEST_PASSWORD = 'TestPass@123';
const TEST_COMMUNITY = `Finance Test ${stamp}`;

async function run() {
  await sleep(3000);

  let pass = 0;
  let fail = 0;
  const check = (name, cond, extra = '') => {
    if (cond) {
      pass += 1;
      console.log(`✅ ${name} ${extra}`);
    } else {
      fail += 1;
      console.log(`❌ ${name} ${extra}`);
    }
  };

  // ---- Create test community ----
  const create = await request('POST', '/api/onboarding/create-community', {
    communityName: TEST_COMMUNITY,
    communityAddress: 'Test Address',
    city: 'Test City',
    state: 'TS',
    pinCode: '123456',
    communityType: 'Apartment',
    gatedCommunity: true,
    adminFullName: 'Test Admin',
    adminEmail: TEST_EMAIL,
    adminPhone: '9999999000',
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
  });
  check('Create test community', create.status === 200 && create.data?.success, create.data?.communityName || create.data?.message);

  // ---- Admin login ----
  const login = await request('POST', '/api/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
  check('Admin login', login.status === 200 && login.data?.success);
  const admin = login.data?.user;
  const h = {
    'x-admin-id': String(admin?.id),
    'x-community-id': String(admin?.communityId),
  };

  // ---- Join resident ----
  const resEmail = `finres${stamp}@test.com`;
  const join = await request('POST', '/api/onboarding/join-community', {
    fullName: 'Test Resident',
    email: resEmail,
    phone: '9999999111',
    communityId: admin?.communityId,
    block: 'A',
    flatNumber: '101',
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
  });
  check('Join resident (pending)', join.status === 200 && join.data?.success && join.data?.status === 'pending');

  // ---- Admin approves resident ----
  const reqs = await request('GET', '/api/admin/resident-requests', null, h);
  const pendingReq = reqs.data?.requests?.find((r) => r.email === resEmail);
  check('List pending resident requests', !!pendingReq);
  if (pendingReq) {
    const approve = await request('PUT', `/api/admin/resident-requests/${pendingReq.requestId}/approve`, {}, h);
    check('Approve resident', approve.status === 200 && approve.data?.success);
  }

  // ---- Resident login ----
  const resLogin = await request('POST', '/api/login', { email: resEmail, password: TEST_PASSWORD });
  check('Resident login', resLogin.status === 200 && resLogin.data?.success);
  const resident = resLogin.data?.user;

  // ---- Save config ----
  const cfg = await request(
    'POST',
    '/api/finance/config',
    { monthlyAmount: 2500, dueDay: 10, lateFee: 100, lateFeeEnabled: true },
    h
  );
  check('Save config', cfg.status === 200 && cfg.data?.success && cfg.data?.config?.monthlyAmount === 2500);

  const getCfg = await request('GET', '/api/finance/config', null, h);
  check('Get config', getCfg.status === 200 && getCfg.data?.config);

  // ---- Generate bills ----
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const gen = await request('POST', '/api/finance/bills/generate', { month }, h);
  check('Generate bills', gen.status === 200 && gen.data?.success && gen.data?.generated >= 1, JSON.stringify({ generated: gen.data?.generated, skipped: gen.data?.skipped }));

  // ---- Idempotency ----
  const gen2 = await request('POST', '/api/finance/bills/generate', { month }, h);
  check('Generate bills idempotent (skips duplicates)', gen2.status === 200 && gen2.data?.skipped > 0 && gen2.data?.generated === 0);

  // ---- List bills ----
  const bills = await request('GET', `/api/finance/bills?month=${month}`, null, h);
  check('List bills', bills.status === 200 && Array.isArray(bills.data?.bills) && bills.data.bills.length > 0);
  const firstBill = bills.data?.bills?.[0];
  check('Bill has required fields', !!firstBill?.communityId && !!firstBill?.residentId && !!firstBill?.month && !!firstBill?.status);

  // ---- Expenses ----
  const exp = await request(
    'POST',
    '/api/finance/expenses',
    { title: 'Water Bill', category: 'water', amount: 15000, vendor: 'Municipal Corp' },
    h
  );
  check('Create expense', exp.status === 201 && exp.data?.expense?._id);

  const expId = exp.data?.expense?._id;
  const upExp = await request(
    'PUT',
    `/api/finance/expenses/${expId}`,
    { amount: 18000, description: 'Updated water bill' },
    h
  );
  check('Update expense', upExp.status === 200 && upExp.data?.expense?.amount === 18000);

  const exps = await request('GET', '/api/finance/expenses', null, h);
  check('List expenses', exps.status === 200 && exps.data?.expenses?.length >= 1);

  // ---- Admin summary ----
  const sum = await request('GET', '/api/finance/summary', null, h);
  check(
    'Admin summary',
    sum.status === 200 &&
      sum.data?.summary &&
      typeof sum.data.summary.totalCollected === 'number' &&
      typeof sum.data.summary.remainingBalance === 'number' &&
      sum.data.summary.categoryBreakdown
  );

  // ---- Resident my bills ----
  const myBills = await request('GET', `/api/finance/my/bills?userId=${resident.id}`, null, {});
  check('Resident my bills', myBills.status === 200 && myBills.data?.bills?.length >= 1);

  // ---- Resident pay bill ----
  const myBill = myBills.data?.bills?.find((b) => b.status !== 'paid');
  if (myBill) {
    const pay = await request(
      'POST',
      `/api/finance/my/bills/${myBill._id}/pay`,
      { userId: resident.id, method: 'upi', referenceNumber: 'TEST-UPI-123' },
      {}
    );
    check('Resident pay bill', pay.status === 200 && pay.data?.bill?.status === 'paid', `receipt=${pay.data?.bill?.receiptNumber}`);

    // ---- Receipt ----
    const receipt = await request('GET', `/api/finance/my/bills/${myBill._id}/receipt?userId=${resident.id}`, null, {});
    check(
      'Resident receipt',
      receipt.status === 200 &&
        receipt.data?.receipt?.bill?.receiptNumber &&
        receipt.data?.receipt?.community?.name,
      `community=${receipt.data?.receipt?.community?.name}`
    );
  } else {
    console.log('⚠️ No unpaid bill found for resident, skipping pay/receipt test');
  }

  // ---- Resident my summary ----
  const mySum = await request('GET', `/api/finance/my/summary?userId=${resident.id}`, null, {});
  check(
    'Resident my summary',
    mySum.status === 200 &&
      mySum.data?.summary &&
      typeof mySum.data.summary.totalCollected === 'number' &&
      typeof mySum.data.summary.myTotalPaid === 'number'
  );

  // ---- Community isolation test (invalid community header) ----
  const iso = await request(
    'GET',
    '/api/finance/bills',
    null,
    { 'x-admin-id': String(admin?.id), 'x-community-id': '000000000000000000000000' }
  );
  check('Community isolation (invalid community rejected)', iso.status === 403);

  // ---- Resident isolation (unknown user) ----
  const isoRes = await request('GET', '/api/finance/my/bills?userId=5f8f8f8f8f8f8f8f8f8f8f8f', null, {});
  check('Resident isolation (unknown user rejected)', isoRes.status === 403);

  console.log(`\n===== RESULTS: ${pass} passed, ${fail} failed =====`);
  process.exit(fail === 0 ? 0 : 1);
}

// Start the server in-process.
require('../server');

run().catch((e) => {
  console.error('TEST ERROR:', e);
  process.exit(1);
});

// Hard safety timeout.
setTimeout(() => {
  console.log('⏰ Test timeout reached. Forcing exit.');
  process.exit(1);
}, 45000);

