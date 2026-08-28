import { app } from './app.js';

const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Dubbing.io Backend API running on http://localhost:${PORT}`);
});
