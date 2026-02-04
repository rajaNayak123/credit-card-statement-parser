/**
 * Test script to verify signup functionality
 * Run this after starting the server: node test-signup.js
 */

const testSignup = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      credentials: 'include',
      body: JSON.stringify({
        name: 'Test User',
        email: `test${Date.now()}@example.com`, // Unique email
        password: 'testpassword123',
      }),
    });

    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Signup successful!');
    } else {
      console.log('\n❌ Signup failed');
    }
  } catch (error) {
    console.error('Error testing signup:', error.message);
  }
};

testSignup();
