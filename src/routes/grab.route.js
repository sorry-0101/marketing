'use strict'

import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { grabProduct } from "../controllers/grab.conrtoller.js";


const route = Router();

route.post('/grabProduct').post(verifyJWT, grabProduct)