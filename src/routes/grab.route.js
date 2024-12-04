import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
	grabProduct,
	createLevel,
	getLevels,
	updateLevel,
	deleteLevel,
	userShareCount,
	getProductsByUserId,
	getGrabCount
} from "../controllers/grab.conrtoller.js";

const router = Router();

// Corrected route definition
router.post("/grabProduct", verifyJWT, grabProduct);
// router.post("/createLevel", verifyJWT, createLevel);
router.get("/getLevel", verifyJWT, getLevels);
router.post("/updateLevel", verifyJWT, updateLevel);
router.post("/userShareCount", verifyJWT, userShareCount);
router.post("/grabProductsUser", getProductsByUserId);
// router.delete("/deleteLevel", verifyJWT, deleteLevel);
// router.route('/').post(createLevel).get(getLevels);
router.get("/getGrabCount", getGrabCount);

export default router;
