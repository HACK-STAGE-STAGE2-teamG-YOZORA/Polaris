import { GET } from '../src/app/api/v1/dashboard/route.js';

async function main() {
  console.log('--- Testing GET /api/v1/dashboard ---');
  try {
    const response = await GET();
    console.log('Response Status:', response.status);
    const json = await response.json();
    console.log('Response Payload:', JSON.stringify(json, null, 2));
  } catch (error) {
    console.error('Error during test execution:', error);
  }
}

main();
