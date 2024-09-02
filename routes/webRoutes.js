const express = require("express");
const router = express.Router();
const {
  handleMetaData,
  handleGetMetaData,
  handleGetFlows,
  handleFeedbackData,
  handleGetMobileData,
} = require("../controllers/webController");

// Store data
router.post("/", handleMetaData);

// Display list of flows
router.get("/flows", handleGetFlows);

// Display data for mobile
router.get("/data", handleGetMetaData);

// Store Mobile Data
router.post("/feedback", handleFeedbackData);

// sending form and visionsdk data to Summary page
router.get("/getfeedback", handleGetMobileData);

module.exports = router;
