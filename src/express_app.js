'use-strict';

import dotenv from 'dotenv';
import config from 'config';
import express from 'express';
import cookieParser from "cookie-parser"
import cors from 'cors';
// import setupApiService from './utils/setupApiService';


// dotenv.config({ path: './.env' });

const app = express();

global.app_config = config.get('app_config');

// Body parser, reading data from body into req.body
app.use(express.json({
	limit: '100mb'
}));

// URL Encoding for req.body
app.use(express.urlencoded({
	limit: '100mb',
	extended: true,
	parameterLimit: 1000000
}));

app.use(cors({
	origin: process.env.CORS_ORIGIN || '*',
	credentials: true
}));


// importing routes
import userRouter from './routes/user.routes.js'
import adminRouter from './routes/admin.routes.js'

app.use(express.static("public"));
app.use(cookieParser());

// importing db setup file
import connectDB from './utils/setupMongoDb.js';
await connectDB(global.app_config.db_services_dtl);



app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);

export { app }
