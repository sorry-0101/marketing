import { Router } from "express";
import { getTeamDataByDate } from "../controllers/team.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router(); // Initialize express router
router.route("/getTeamDataByDate").get(verifyJWT, getTeamDataByDate);

export default router; // Export the router for use in the app
