import { Router } from "express";
import { getHomeData, addProduct, getAllProduct } from "../controllers/admin.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = new Router();

router.route('/home').get(verifyJWT, getHomeData);
router.route('/addProduct').post(verifyJWT, addProduct);
router.route('/getAllProducts').get(verifyJWT, getAllProduct);

export default router;