const express = require("express");
const router = express.Router();
const {
  handleMetaData,
  handleGetMetaData,
  handleGetFlows,
  handleGetFlowData,
  handleUpdateFlow,
  handleFeedbackData,
  handleGetMobileData,
  handlePostFlows,
} = require("../controllers/webController");

// Store data from web
router.post("/", handleMetaData);

// Display list of flows
router.get("/flows", handleGetFlows);
router.post("/flows", handlePostFlows);

// Display entire flow data on web
router.get("/flowdata", handleGetFlowData);

//Update Flow Data
router.patch("/flow", handleUpdateFlow);

// Display data for mobile
router.get("/data", handleGetMetaData);

// Store Mobile Data
router.post("/feedback", handleFeedbackData);

// sending form and visionsdk data to Summary page on mobile
router.get("/getfeedback", handleGetMobileData);

module.exports = router;
