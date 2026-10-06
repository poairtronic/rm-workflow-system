const pg = require('pg');
const { NestFactory } = require('@nestjs/core');
// Just use a quick query instead of nest factory to see if we can generate a valid jwt
// Wait, generating a JWT requires the secret. Let's just look at sc.service.ts
