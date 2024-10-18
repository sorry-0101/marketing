import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  grabProduct,
  createLevel,
  getLevels,
  updateLevel,
  deleteLevel,
} from "../controllers/grab.conrtoller.js";

const router = Router();

// Corrected route definition
router.post("/grabProduct", verifyJWT, grabProduct);
// router.post("/createLevel", verifyJWT, createLevel);
router.get("/getLevel", verifyJWT, getLevels);
router.post("/updateLevel", verifyJWT, updateLevel);
// router.delete("/deleteLevel", verifyJWT, deleteLevel);
// router.route('/').post(createLevel).get(getLevels);

export default router;
