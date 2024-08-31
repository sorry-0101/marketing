import { Router } from "express";
import { getHomeData } from "../controllers/admin.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = new Router();

router.route('/home').get(getHomeData);

export default router;