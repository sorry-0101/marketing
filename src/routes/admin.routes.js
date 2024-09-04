import { Router } from "express";
import { getHomeData, addProduct, getAllProduct } from "../controllers/admin.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = new Router();

router.route('/home').get(getHomeData);
router.route('/addProduct').post(addProduct);
router.route('/getAllProducts').get(getAllProduct);

export default router;