import fetch from 'node-fetch';

async function testDraft() {
  // 1. Login as admin
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@airtronic.com',
      password: 'airtronic123A@'
    })
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status, loginData.user?.role);
  const token = loginData.accessToken || loginData.token;
  if (!token) {
    console.error('No token returned:', loginData);
    return;
  }

  // 2. Get active products
  const prodRes = await fetch('http://localhost:3000/api/products?isActive=true&pageSize=5', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const prodData = await prodRes.json();
  const products = prodData.data || prodData;
  console.log('Got products count:', products.length);
  if (!products.length) {
    console.error('No products found');
    return;
  }

  const testProduct = products[0];
  console.log('Using product:', testProduct.id, testProduct.name);

  // 3. Test draft payload matching the screenshot:
  const payload = {
    poNumber: 'po123',
    scs: [
      {
        scNumber: '123',
        productName: 'd23',
        items: [
          {
            productId: testProduct.id,
            spec: '3ed',
            quantity: 132
          }
        ]
      }
    ]
  };

  const draftRes = await fetch('http://localhost:3000/api/rm/draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const draftData = await draftRes.text();
  console.log('Draft response status:', draftRes.status);
  console.log('Draft response body:', draftData);
}

testDraft().catch(console.error);
