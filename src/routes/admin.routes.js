import { Router } from "express";
import {
  getHomeData,
  addProduct,
  getAllProduct,
  getUserRecords,
  addEvent,
  getEventRecords,
  updateEvent,
  deleteEventRecord,
  adminLogin,
  registerAdmin,
  updateProduct,
  deleteProduct,
  uploadSliderImage,
  getSliderImages,
  updateSliderImage,
  deleteSliderImage,
  addPlan,
  updatePlan,
  deletePlan,
  getPlans,
  getAllUserWithdrawalsForAdmin,
  updateWithdrawalStatusByAdmin,
  addCountry,
  getCountries,
  updateCountry,
  deleteCountry,
  sendAdminMessage,
  getAdminMessages,
  deleteAdminMessage,
  deleteUserById,
} from "../controllers/admin.controller.js"; // Import controller functions
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Import JWT verification middleware
import { upload } from "../middlewares/multer.middleware.js"; // Import multer middleware for handling file uploads

const router = new Router(); // Initialize express router

// Route to fetch home data, protected by JWT verification
router.route("/home").get(verifyJWT, getHomeData);

router.route("/registerAdmin").post(
  upload.fields([
    {
      name: "adminImg",
      maxCount: 1,
    },
  ]),
  registerAdmin
);

router.route("/adminLogin").post(adminLogin);

// Route to add a product, protected by JWT verification
// Uses multer to handle single file upload for product image ("productImg")
router.route("/addProduct").post(
  verifyJWT,
  upload.fields([
    {
      name: "productImg",
      maxCount: 1,
    },
  ]),
  addProduct
);

// Route to get all products, protected by JWT verification
router.route("/getAllProducts").get(verifyJWT, getAllProduct);

// Route to deleteProducts products, protected by JWT verification
router.route("/deleteProducts").delete(verifyJWT, deleteProduct);

// Route to updateProduct, protected by JWT verification
router.route("/updateProduct").post(
  verifyJWT,
  upload.fields([
    {
      name: "productImg",
      maxCount: 1,
    },
  ]),
  updateProduct
);

// Route to get user records, protected by JWT verification
router.route("/getUserRecords").get(verifyJWT, getUserRecords);
router.route("/deleteUser/:userId").delete(verifyJWT, deleteUserById);

// Route to add an event, protected by JWT verification
router.route("/addEvent").post(
  verifyJWT,
  upload.fields([
    {
      name: "eventImg",
      maxCount: 1,
    },
  ]),
  addEvent
);

// Route to get all products, protected by JWT verification
router.route("/getAllProducts").get(verifyJWT, getAllProduct);

// Route to get all event records, protected by JWT verification
router.route("/getEventRecords").get(getEventRecords);

// Route to get all event records, protected by JWT verification
router.route("/updateEvent").post(
  verifyJWT,
  upload.fields([
    {
      name: "eventImg",
      maxCount: 1,
    },
  ]),
  updateEvent
);

// Route to get all event records, protected by JWT verification
router.route("/deleteEvent").delete(verifyJWT, deleteEventRecord);

//route add slider
router.route("/addslider").post(
  verifyJWT,
  upload.fields([
    {
      name: "sliderImg",
      maxCount: 1,
    },
  ]),
  uploadSliderImage
);
// Route to get slider
router.route("/getSliderImg").get(getSliderImages);
// Route to update slider
router.route("/updateslider").post(
  verifyJWT,
  upload.fields([
    {
      name: "sliderImg",
      maxCount: 1,
    },
  ]),
  updateSliderImage
);
// Route to delete event records, protected by JWT verification
// router.delete('/deleteslider', deleteSliderImage);
router.route("/deleteslider").delete(verifyJWT, deleteSliderImage);

// Route to add an plan, protected by JWT verification
router.route("/addPlan").post(
  verifyJWT,
  upload.fields([
    {
      name: "planImg",
      maxCount: 1,
    },
  ]),
  addPlan
);
// Route to get all event records, protected by JWT verification
router.route("/getPlanRecords").get(verifyJWT, getPlans);
// Route to get all event records, protected by JWT verification
router.route("/updatePlan").post(
  verifyJWT,
  upload.fields([
    {
      name: "planImg",
      maxCount: 1,
    },
  ]),
  updatePlan
);

// Route to get all event records, protected by JWT verification
router.route("/deletePlan").delete(verifyJWT, deletePlan);

//withrequest  for admin routes
router
  .route("/withdrawalrequests")
  .get(verifyJWT, getAllUserWithdrawalsForAdmin);
//update status in withdral
router
  .route("/withdrawalrequest/status")
  .post(verifyJWT, updateWithdrawalStatusByAdmin);

// @desc Add a new country
// router.post('/addCountries', addCountry);
router.route("/addCountries").post(verifyJWT, addCountry);
// router.get('/getCountries', getCountries);
router.route("/getCountries").get(verifyJWT, getCountries);
// router.post('/updateCountries', updateCountry);
router.route("/updateCountries").post(verifyJWT, updateCountry);
// @desc Delete a country
router.route("/deleteCountries").delete(verifyJWT, deleteCountry);

// Admin Routes

// router.route('sendMessage/:id').post(verifyJWT, sendAdminMessage);
router.route("/sendMessage/:id").post(
  verifyJWT,
  upload.fields([
    {
      name: "chatImg",
      maxCount: 1,
    },
  ]),
  sendAdminMessage
);
// router.route("/getMessages/:id").get(verifyJWT, getAdminMessages);
router.route("/getMessages/:id").get(getAdminMessages);

router.route("/deleteMessage/:id").delete(verifyJWT, deleteAdminMessage);

export default router;
