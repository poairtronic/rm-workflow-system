import fetch from 'node-fetch';
import 'dotenv/config';

async function run() {
  let r = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email: 'stores@airtronic.com', password: 'Password@123'})});
  const token = (await r.json()).accessToken;
  r = await fetch('http://localhost:3000/api/inventory/balances?productId=01c7f65b-f6fc-4a60-93ac-491fb39b9852', {headers: {'Authorization': 'Bearer '+token}});
  console.log(JSON.stringify(await r.json(), null, 2));
}
run().catch(console.error);
