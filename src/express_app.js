'use-strict';

import dotenv from 'dotenv';
import config from 'config';
import express from 'express';
import cookieParser from "cookie-parser"
import cors from 'cors';
// import setupApiService from './utils/setupApiService';
import connectDB from './utils/setupMongoDb.js';

import userRouter from './routes/user.routes.js'
import  adminRouter from './routes/admin.routes.js'

dotenv.config({path:'./.env'});

const app = express();

export default async (param)=>{

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
        origin:  process.env.CORS_ORIGIN||'*',
        credentials: true
    }));

    app.use(express.static("public"));
    app.use(cookieParser());

    await connectDB(global.app_config.db_services_dtl);



    app.use("/api/users", userRouter);
    app.use("/api/admin", adminRouter);

    // setupApiService(global.app_config.api_service_dtl);
    return app;
}
