const http = require('http');

const data = JSON.stringify({
  email: 'admin@airtronic.com',
  password: 'admin'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log("Login response:", body);
    const json = JSON.parse(body);
    const token = json.token || json.accessToken || json.data?.token || json.data?.accessToken;
    
    // Now fetch SC
    http.get({
      hostname: 'localhost',
      port: 3000,
      path: '/api/sc/3cbbac7f-04fa-42d1-a026-8498c273d50c', // id from DB
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, res2 => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        console.log("SC response:", body2);
      });
    });
  });
});

req.write(data);
req.end();
