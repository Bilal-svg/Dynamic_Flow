const express = require("express");
const router = express.Router();
const {
  handleMetaData,
  handleGetMetaData,
  handleGetFlows,
} = require("../controllers/webController");

// Store data
router.post("/", handleMetaData);

// Display list of flows
router.get("/flows", handleGetFlows);

// Display data for mobile
router.get("/data", handleGetMetaData);

module.exports = router;
