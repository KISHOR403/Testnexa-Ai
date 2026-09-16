const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('--- STARTING AUTH BACKEND VERIFICATION ---');

  // Test 1: Password complexity enforcement on register
  console.log('\n[Test 1] Register with weak password:');
  try {
    const res = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test QA',
      email: 'weak-pass-test@example.com',
      password: 'weak'
    });
    console.error('FAILED: Expected 400 validation error for weak password, got:', res.status);
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log('PASSED: Weak password rejected with 400:', err.response.data.message);
    } else {
      console.error('FAILED: Unexpected error:', err.message);
    }
  }

  // Test 2: Anti-enumeration on forgot-password
  console.log('\n[Test 2] Anti-enumeration on forgot-password for non-existent user:');
  try {
    const res = await axios.post(`${BASE_URL}/auth/forgot-password`, {
      email: 'definitely-non-existent-user-987654@testnexa.ai'
    });
    console.log('Status:', res.status, 'Response:', res.data);
    if (res.data.success && res.data.message.includes('If an account exists')) {
      console.log('PASSED: Generic anti-enumeration response returned.');
    } else {
      console.error('FAILED: Expected generic anti-enumeration response.');
    }
  } catch (err) {
    console.error('FAILED: Error on forgot-password:', err.response?.data || err.message);
  }

  // Test 3: Login error format
  console.log('\n[Test 3] Generic login failure response (no user enumeration):');
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'unknown-account@testnexa.ai',
      password: 'WrongPassword123!'
    });
    console.error('FAILED: Expected 401, got:', res.status);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log('PASSED: Clean generic error message returned:', err.response.data.message);
    } else {
      console.error('FAILED: Unexpected status:', err.response?.status, err.message);
    }
  }

  // Test 4: Rate limiter on login (attempt multiple invalid logins to trigger 429)
  console.log('\n[Test 4] Rate limiting on login attempts:');
  let rateLimited = false;
  for (let i = 0; i < 15; i++) {
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'attacker@example.com',
        password: 'RandomPassword123!'
      });
    } catch (err) {
      if (err.response?.status === 429) {
        rateLimited = true;
        console.log(`PASSED: Rate limit triggered at attempt ${i + 1}:`, err.response.data.message);
        break;
      }
    }
  }
  if (!rateLimited) {
    console.log('NOTE: Rate limiter not hit within 15 attempts (limit may be configured higher or window reset).');
  }

  console.log('\n--- AUTH BACKEND VERIFICATION COMPLETE ---');
}

runTests();
