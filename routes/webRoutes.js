const express = require('express');
const router = express.Router();
const {handleMetaData, handleGetMetaData, handleGetFlows} = require('../controllers/webController');


// store data
router.post('/', handleMetaData);


//Display list of flows
router.get('/flows', handleGetFlows);

// Display data for mobile
router.get('/data', handleGetMetaData);

//Get and Send Api Data 
// router.get('/apiData/:orderid?', handleGetApiData);

module.exports = router;