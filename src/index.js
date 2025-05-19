const express      = require('express');
const initBots     = require('./bots/forwarderBot');
const healthRoutes = require('./routes/health');
const errorHandler = require('./middlewares/errorHandler');
const logger       = require('./utils/logger');
const { PORT }     = require('./config/env');

(async () => {
  // 1) Inisiasi bots
  await initBots();

  // 2) Setup Express
  const app = express();
  app.use(express.json());
  app.use('/', healthRoutes);
  app.use(errorHandler);

  // 3) Jalankan server
  app.listen(PORT, () => 
    logger.info(`Server running on port ${PORT}`)
  );
})();
