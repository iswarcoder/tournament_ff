const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const FormData = require('form-data');
const fs = require('fs');

async function testRegistration() {
  const formData = new FormData();
  formData.append('name', 'Test User');
  formData.append('uid', '123456789');
  formData.append('phone', '9876543210');
  formData.append('transactionId', 'TXN123456');

  // Create a dummy file for testing
  const testFile = Buffer.from('dummy image data');
  formData.append('screenshot', testFile, 'test.jpg');

  try {
    const response = await fetch('http://localhost:5001/register', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testRegistration();