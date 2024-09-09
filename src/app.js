'use strict'; // Enforces strict mode in JavaScript

import { app } from './express_app.js'; // Importing the Express app from express_app.js
import dotenv from 'dotenv'; // Import dotenv to load environment variables from .env file
dotenv.config({ path: './.env' }); // Configure dotenv to load variables from .env file

// Async function to start the server
const startServer = async () => {
	try {
		// Get the port from environment variables or fallback to a global app configuration
		const port = process.env.PORT || global.app_config.app_port;

		// Start the Express server and listen on the specified port
		app.listen(port, () => {
			console.log(`Server is started on port ${port}`); // Log success message when the server starts
		});
	} catch (err) {
		// Catch and log any errors that occur while starting the server
		console.error('Error starting server:', err);
	}
};

startServer(); // Invoke the function to start the server
