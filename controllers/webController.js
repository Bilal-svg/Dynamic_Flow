const express = require('express');
const {db} = require('../connection');
const axios = require('axios');

// Storing all Meta Data
async function handleMetaData(req, res){
    //validation 
    let flowName = req.body.flow_name;
    const pagesArray   = req.body.pages;
    
    let [flowId] = await db.query('INSERT INTO flows (flow_name) VALUES (?)', [flowName]);
    flowId = flowId.insertId;
    let promises = [];
    for(let page of pagesArray) {
        const {page_id, meta_data, order_id} = page;
        promises.push(db.query('INSERT INTO pages (page_id, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)', [page_id, JSON.stringify(meta_data), order_id, flowId]));
    }
    const insertIds = await Promise.all(promises);
    return res.status(200).json({ message: 'Data saved successfully!'});
}

// Sending single record/row form the database 
async function handleGetFlows(req, res){
    const [flows] = await db.query('SELECT * FROM flows');
    return res.json(flows);
    
}

// Sending single record/row form the database 
async function handleGetMetaData(req, res){
    let token = null;
    // console.log("🚀 ~ handleGetMetaData ~ req:", req.headers)

    let whereClause = "(SELECT MIN(order_id) FROM pages WHERE flow_id = ?)";
    let queryValues = [];
    // console.log(req.headers.x_page_token)
    if(req.headers.x_page_token){

        let bufferObj = Buffer.from(req.headers.x_page_token, "base64");
        // console.log("🚀 ~ handleGetMetaData ~ req.headers.x_page_token,:", req.headers.x_page_token)
        let token = bufferObj.toString("utf8");
        token = JSON.parse(token)
        // console.log("🚀 ~ handleGetMetaData ~ bufferObj:", bufferObj)
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)
        whereClause = "?";
        queryValues.push(token.next_order_id); 
    }

    queryValues.push(req.query.flow_id);
    queryValues.push(req.query.flow_id);
    let query = `SELECT * FROM pages WHERE order_id = ${whereClause} AND flow_id = ? LIMIT 1`;
    // console.log("🚀 ~ handleGetMetaData ~ queryValues:", queryValues)
    // console.log("🚀 ~ handleGetMetaData ~ query:", query);
    let [data] = await db.query(query, queryValues);
    // console.log("🚀 ~ handleGetMetaData ~ [data]:", [data])
    
    data = data[0];
    // console.log("🚀 ~ handleGetMetaData ~ data:", data);
    

    //verify if next page exists
    token = null;
    query = `SELECT order_id FROM pages WHERE order_id = ? AND flow_id = ? LIMIT 1`;
    // console.log("🚀 ~ handleGetMetaData ~ query:", query)
    let [orderInfo] = await db.query(query, [data.order_id+1, req.query.flow_id]);
    orderInfo = orderInfo[0];
    // console.log(orderInfo);
    if(orderInfo) {
        token = {next_order_id: orderInfo.order_id};
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)
        buffer = Buffer.from(JSON.stringify(token), 'utf-8');
        // console.log("🚀 ~ handleGetMetaData ~ buffer:", buffer)
        token = buffer.toString('base64');
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)
        
    }
    
    if (data.meta_data) {
        for (const item of data.meta_data){
            if(item.api){
                const apiUrls = Object.values(item.api)
                // console.log(apiUrls);
                const apiResponse = [];

                // Fetching data for each api 
                for (const apiUrl of apiUrls){
                    const response = await axios.get(apiUrl);
                    apiResponse.push(response.data);
                }
                // console.log("🚀 ~ handleGetMetaData ~ apiResponse:", apiResponse)
                // console.log("🚀 ~ handleGetMetaData ~ item:", item)
                item.apiResponse = apiResponse.flat();
                
            }
        }
        // if(Array.isArray(data.meta_data.api)){
        //     const apiUrls = data.meta_data.api;
        //     const apiResponse = [];
            
        //     for(const apiUrl of apiUrls){
        //         const response = await axios.get(apiUrl);
        //         apiResponse.push(response.data);
        //     }

        //     data.meta_data.dropdown = apiResponse;

            
        // }



        // const apiResponse = await Promise.all(
        //     apiUrls.map(async (apiUrl) => {
        //         try {
                    
        //             const response = await axios.get(apiUrl);
        //             data.meta_data.dropdown = response.data;
                    
        //         } catch (apiError) {
        //             console.error("API call error:", apiError);
        //             return res.status(500).json({ error: "Error fetching data from API" });
        //         }
        //     })
        // ); 
        // const apiUrl = data.meta_data.api;
        // console.log("🚀 ~ handleGetMetaData ~ apiUrl:", apiUrl)
        //&& Object.hasOwn(data.meta_data, 'api')
        
    }
    

    return res.json({data, token});
}


// Send api data to mobile by pageId
// async function handleGetApiData(req, res){
//     const {flowid} = req.headers;
//     const {orderid} = req.query;    
//     const [rows] = await db.query('SELECT * FROM pages WHERE flow_id = ? AND order_id = ?', [flowid, orderid]);
//     const check = Object.hasOwn(rows[0].meta_data, 'api');
//     if(check == true){
//         const apiUrl = rows[0].meta_data.api;
//         // console.log("🚀 ~ handleGetApiData ~ apiUrl:", apiUrl)
//         await axios.get(apiUrl).then(response =>{
//             return res.status(200).json(response.data);
//         });
//     }else{
//         return res.status(400).json({msg: "No Api Available"});
//     }
    // const apiData = rows.map(e => JSON.stringify(e.meta_data));  
    // console.log("apiData", apiData);  
    // const resolveApiData = await handleFetchApiData(apiData);
    // res.status(200).json(resolveApiData);
// }

module.exports = {handleMetaData, handleGetMetaData, handleGetFlows};