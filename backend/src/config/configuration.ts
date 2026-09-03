export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your_development_secret',
    expiresIn: '7d',
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
});
