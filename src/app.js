'use strict';
import createApp  from './express_app.js'

const startServer = async () => {
    try {
      const app = await createApp();
  
      const port = process.env.PORT || global.app_config.app_port;
  
      app.listen(port, () => {
        console.log(`Server is started on port ${port}`);
      });
    } catch (err) {
      console.error('Error starting server:', err);
    }
  };
  
  startServer();