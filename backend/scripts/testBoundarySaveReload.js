const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = 5001;

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

let passCount = 0;
let failCount = 0;

function assert(condition, message, details = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ PASS: ${message} ${details ? '(' + details + ')' : ''}`);
  } else {
    failCount++;
    console.error(`  ❌ FAIL: ${message} ${details ? '(' + details + ')' : ''}`);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('   5-VERTEX POLYGON SAVE & RELOAD VERIFICATION SUITE');
  console.log('======================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.\n');

  const stamp = Date.now();

  // 1. Onboard two test communities: Community 1 and Community 2
  const comm1Res = await request('POST', '/api/onboarding/create-community', {
    communityName: `Five Vertex Comm 1 ${stamp}`,
    communityAddress: 'Gate 1, Block 5',
    city: 'Hyderabad',
    state: 'Telangana',
    pinCode: '500001',
    communityType: 'Gated Community',
    adminFullName: 'Admin Five One',
    adminEmail: `admin5v_1_${stamp}@test.com`,
    adminPhone: '9876543221',
    password: 'Password@123',
    confirmPassword: 'Password@123',
  });
  assert(comm1Res.status === 200 && comm1Res.data.success, 'Created Community 1');
  const communityId1 = comm1Res.data.communityId;

  const login1 = await request('POST', '/api/login', {
    email: `admin5v_1_${stamp}@test.com`,
    password: 'Password@123',
  });
  assert(login1.status === 200 && login1.data.success, 'Logged in Admin 1');
  const adminId1 = login1.data.user.id;
  const token1 = login1.data.token;

  const comm2Res = await request('POST', '/api/onboarding/create-community', {
    communityName: `Five Vertex Comm 2 ${stamp}`,
    communityAddress: 'Gate 2, Block 6',
    city: 'Hyderabad',
    state: 'Telangana',
    pinCode: '500002',
    communityType: 'Gated Community',
    adminFullName: 'Admin Five Two',
    adminEmail: `admin5v_2_${stamp}@test.com`,
    adminPhone: '9876543222',
    password: 'Password@123',
    confirmPassword: 'Password@123',
  });
  assert(comm2Res.status === 200 && comm2Res.data.success, 'Created Community 2');
  const communityId2 = comm2Res.data.communityId;

  const login2 = await request('POST', '/api/login', {
    email: `admin5v_2_${stamp}@test.com`,
    password: 'Password@123',
  });
  assert(login2.status === 200 && login2.data.success, 'Logged in Admin 2');
  const adminId2 = login2.data.user.id;

  const headersAdmin1 = {
    'x-admin-id': String(adminId1),
    'x-community-id': String(communityId1),
  };
  const headersAdmin2 = {
    'x-admin-id': String(adminId2),
    'x-community-id': String(communityId2),
  };

  // 2. Initial state: verify Community 1 boundary is "Not Configured"
  const initGet = await request('GET', '/api/boundary', null, headersAdmin1);
  assert(
    initGet.status === 200 && initGet.data.configured === false && initGet.data.boundary === null,
    'Initial boundary is correctly reported as Not Configured'
  );

  // 3. Test Invalid Polygon: < 3 vertices
  const invalidPolygonFew = await request(
    'POST',
    '/api/boundary',
    {
      mode: 'polygon',
      polygon: [
        { lat: 17.385, lng: 78.4866 },
        { lat: 17.386, lng: 78.4876 },
      ],
      maxAccuracyMeters: 100,
    },
    headersAdmin1
  );
  assert(
    invalidPolygonFew.status === 400 && invalidPolygonFew.data.success === false,
    'Polygon with only 2 vertices rejected with 400 Bad Request'
  );

  // 4. Test Invalid Polygon: out of bounds coordinates
  const invalidPolygonCoords = await request(
    'POST',
    '/api/boundary',
    {
      mode: 'polygon',
      polygon: [
        { lat: 105.0, lng: 78.4866 },
        { lat: 17.386, lng: 78.4876 },
        { lat: 17.387, lng: 78.4886 },
      ],
      maxAccuracyMeters: 100,
    },
    headersAdmin1
  );
  assert(
    invalidPolygonCoords.status === 400 && invalidPolygonCoords.data.success === false,
    'Polygon with latitude > 90 rejected with 400 Bad Request'
  );

  // 5. Save 5-vertex polygon for Community 1
  const fiveVertices = [
    { lat: 17.385044, lng: 78.486671 },
    { lat: 17.387512, lng: 78.489123 },
    { lat: 17.386211, lng: 78.492045 },
    { lat: 17.383891, lng: 78.491234 },
    { lat: 17.383120, lng: 78.487901 },
  ];

  const save5V = await request(
    'POST',
    '/api/boundary',
    {
      mode: 'polygon',
      polygon: fiveVertices,
      maxAccuracyMeters: 80,
      enabled: true,
    },
    headersAdmin1
  );

  assert(
    save5V.status === 200 && save5V.data.success === true,
    '5-vertex polygon saved successfully with 200 OK'
  );
  assert(
    save5V.data.boundary.mode === 'polygon' && save5V.data.boundary.polygon.length === 5,
    'Saved boundary response contains polygon mode and 5 vertices'
  );

  // 6. Reload boundary from backend (GET /api/boundary) and verify persisted status
  const reloadRes = await request('GET', '/api/boundary', null, headersAdmin1);
  assert(
    reloadRes.status === 200 &&
      reloadRes.data.success === true &&
      reloadRes.data.configured === true &&
      reloadRes.data.boundary !== null,
    'Reloaded boundary reports configured: true'
  );
  assert(
    reloadRes.data.boundary.mode === 'polygon' &&
      reloadRes.data.boundary.polygon.length === 5 &&
      reloadRes.data.boundary.enabled === true &&
      reloadRes.data.boundary.maxAccuracyMeters === 80,
    'Reloaded boundary has exact 5 vertices and persisted configuration'
  );

  // 7. Verify direct MongoDB Atlas document
  const dbDoc = await mongoose.connection.db
    .collection('communityboundaries')
    .findOne({ communityId: new mongoose.Types.ObjectId(communityId1) });
  assert(
    dbDoc !== null && dbDoc.mode === 'polygon' && dbDoc.polygon.length === 5,
    'Direct MongoDB Atlas document verified with 5 vertices'
  );
  assert(
    String(dbDoc.createdBy) === String(adminId1) && String(dbDoc.updatedBy) === String(adminId1),
    'Direct MongoDB Atlas document audit metadata verified'
  );

  // 8. Update the 5-vertex polygon: update existing boundary rather than duplicate
  const updatedFiveVertices = [
    { lat: 17.385500, lng: 78.486700 },
    { lat: 17.387600, lng: 78.489200 },
    { lat: 17.386300, lng: 78.492100 },
    { lat: 17.383900, lng: 78.491300 },
    { lat: 17.383200, lng: 78.488000 },
  ];

  const updateRes = await request(
    'POST',
    '/api/boundary',
    {
      mode: 'polygon',
      polygon: updatedFiveVertices,
      maxAccuracyMeters: 50,
      enabled: true,
    },
    headersAdmin1
  );
  assert(updateRes.status === 200 && updateRes.data.success === true, 'Updated existing boundary');

  // Verify document count in DB for Community 1 is still EXACTLY 1 (updated, not duplicated)
  const countInDb = await mongoose.connection.db
    .collection('communityboundaries')
    .countDocuments({ communityId: new mongoose.Types.ObjectId(communityId1) });
  assert(countInDb === 1, 'Exactly one boundary document in DB for Community 1 (no duplicates)');

  // 9. Community Isolation: Community 2 must still be Not Configured
  const comm2Check = await request('GET', '/api/boundary', null, headersAdmin2);
  assert(
    comm2Check.status === 200 && comm2Check.data.configured === false,
    'Community 2 is still Not Configured (tenant isolation confirmed)'
  );

  // 10. Cross-community unauthorized modification attempt
  const crossTamper = await request(
    'POST',
    '/api/boundary',
    {
      mode: 'polygon',
      polygon: fiveVertices,
      communityId: communityId1, // Admin 2 tries to tamper with Community 1
    },
    headersAdmin2
  );
  assert(
    crossTamper.status === 200 && String(crossTamper.data.boundary.communityId) === String(communityId2),
    'Admin 2 client-supplied communityId ignored; boundary saved to Admin 2 community'
  );

  // Confirm Community 1 boundary remained unchanged
  const comm1AfterTamper = await request('GET', '/api/boundary', null, headersAdmin1);
  assert(
    comm1AfterTamper.data.boundary.maxAccuracyMeters === 50,
    'Community 1 boundary untouched after cross-community attempt'
  );

  // 11. Unauthorized access (no headers)
  const noAuth = await request('POST', '/api/boundary', {
    mode: 'polygon',
    polygon: fiveVertices,
  });
  assert(noAuth.status === 403, 'Anonymous save rejected with 403 Forbidden');

  // 12. Test Bearer Token access for GET /api/boundary
  if (token1) {
    const bearerGet = await request('GET', '/api/boundary', null, {
      Authorization: `Bearer ${token1}`,
    });
    assert(
      bearerGet.status === 200 && bearerGet.data.configured === true,
      'Bearer session token resolves community boundary accurately'
    );
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================\n');

  await mongoose.disconnect();

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
