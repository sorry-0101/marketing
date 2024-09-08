import { Router } from "express";
import { getHomeData, addProduct, getAllProduct, getUserRecords, addEvent, getEventRecords } from "../controllers/admin.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js"


const router = new Router();

router.route('/home').get(verifyJWT, getHomeData);
router.route('/addProduct').post(verifyJWT, upload.fields([{
	name: "productImg",
	maxCount: 1
}]),
	addProduct);
router.route('/addEvent').post(verifyJWT, addEvent);
router.route('/getAllProducts').get(verifyJWT, getAllProduct);
router.route('/getEventRecords').get(verifyJWT, getEventRecords);
router.route('/getUserRecords').get(verifyJWT, getUserRecords);

export default router;