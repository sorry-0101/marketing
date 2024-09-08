'use strict';
import { app } from './express_app.js'
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const startServer = async () => {
	try {
		const port = process.env.PORT || global.app_config.app_port;

		app.listen(port, () => {
			console.log(`Server is started on port ${port}`);
		});
	} catch (err) {
		console.error('Error starting server:', err);
	}
};

startServer();