import { GET } from '@/app/api/v1/dashboard/route';

async function main() {
  console.log('--- Testing GET /api/v1/dashboard ---');
  try {
    const response = await GET(new Request('http://localhost/api/v1/dashboard'));
    console.log('Response Status:', response.status);
    const json = await response.json();
    console.log('Response Payload:', JSON.stringify(json, null, 2));
  } catch (error) {
    console.error('Error during test execution:', error);
  }
}

main();
