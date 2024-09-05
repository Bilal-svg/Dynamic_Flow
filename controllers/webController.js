const { db } = require("../connection");
const axios = require("axios");
const uuid = require("uuid");

// Storing all Meta Data
async function handleMetaData(req, res) {
  try {
    const { flow_name, pages } = req.body;

    const [flowResult] = await db.query(
      "INSERT INTO flows (flow_name) VALUES (?)",
      [flow_name]
    );
    const flowId = flowResult.insertId;

    const promises = pages.map((page) => {
      const { step_type, meta_data, order_id } = page;
      return db.query(
        "INSERT INTO pages (step_type, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)",
        [step_type, JSON.stringify(meta_data), order_id, flowId]
      );
    });

    await Promise.all(promises);
    return res.status(200).json({ message: "Data saved successfully!" });
  } catch (error) {
    console.error("Error saving data:", error);
    return res.status(500).json({ error: "Failed to save data" });
  }
}

// Sending single record/row from the database
async function handleGetFlows(req, res) {
  try {
    const [flows] = await db.query("SELECT * FROM flows");
    return res.json(flows);
  } catch (error) {
    console.error("Error fetching flows:", error);
    return res.status(500).json({ error: "Failed to fetch flows" });
  }
}

// Sending single record/row from the database
async function handleGetMetaData(req, res) {
  try {
    const { flow_id } = req.query;
    let token = null;

    let whereClause = "(SELECT MIN(order_id) FROM pages WHERE flow_id = ?)";
    let queryValues = [];

    if (req.headers.x_page_token) {
      const bufferObj = Buffer.from(req.headers.x_page_token, "base64");
      token = JSON.parse(bufferObj.toString("utf8"));
      console.log(token);
      whereClause = "?";
      queryValues.push(token.next_order_id);
    }

    queryValues.push(flow_id);
    queryValues.push(flow_id);
    const query = `SELECT * FROM pages WHERE order_id = ${whereClause} AND flow_id = ? LIMIT 1`;

    let [data] = await db.query(query, queryValues);
    data = data[0];

    // Verify if next page exists
    token = null;
    const [orderInfo] = await db.query(
      "SELECT order_id FROM pages WHERE order_id = ? AND flow_id = ? LIMIT 1",
      [data.order_id + 1, flow_id]
    );
    if (orderInfo.length > 0) {
      token = { next_order_id: orderInfo[0].order_id };
      const buffer = Buffer.from(JSON.stringify(token), "utf-8");
      token = buffer.toString("base64");
    }

    // Fetching data from associated APIs
    if (data.meta_data) {
      for (const item of data.meta_data) {
        if (item.api) {
          //   console.log("item api", item.api);
          const apiUrls = item.api.Url;

          let apiResponse = [];

          //   if (Array.isArray(apiUrls)) {
          //     // Fetch data from all URLs if apiUrls is an array
          //     try {
          //       if (item.api.Type === "get") {
          //         const responses = await Promise.all(
          //           apiUrls.map((url) => axios.get(url))
          //         );
          //         apiResponse = responses.map((response) => response.data);
          //       }
          //       //    else {

          //       // const postdata = {

          //       // }
          //       //     const responses = await Promise.all(
          //       //       apiUrls.map((url) => axios.post(url, postdata))
          //       //     );
          //       //     apiResponse = responses.map((response) => response.data);
          //       //   }
          //     } catch (apiError) {
          //       console.error("API call error:", apiError);
          //       return res
          //         .status(500)
          //         .json({ msg: "Error fetching data from API" });
          //     }
          //   } else
          {
            // Fetch data from a single URL if apiUrls is not an array
            try {
              if (item.api.Type === "get") {
                const apiUrl = item.api.Url;
                const fields = item.api.Success.Response.field;

                try {
                  // Make the GET request to the external API
                  apiResponse = await axios.get(apiUrl);
                  //   console.log(
                  //     "🚀 ~ handleGetMetaData ~ apiResponse:",
                  //     apiResponse
                  //   );

                  const apiData = apiResponse.data;

                  // Filter the data to include only the selected fields
                  const filteredData = apiData.map((item) => {
                    let selectedData = {};
                    fields.forEach((field) => {
                      if (item.hasOwnProperty(field)) {
                        selectedData[field] = item[field];
                      }
                    });
                    return selectedData;
                  });

                  apiResponse = { ...filteredData };
                } catch (error) {
                  // Handle errors
                  console.error("Error fetching data from API:", error);
                  return res
                    .status(500)
                    .json({ error: "Internal Server Error" });
                }
                item.api.Success.Response.data = apiResponse;
              } else {
                const apiUrl = item.api.Url;
                console.log("🚀 ~ handleGetMetaData ~ apiUrl:", apiUrl);
                const body = item.api.Body;
                const pageId = item.api.Body.id;

                // const [postData] = await db.query(
                //   "SELECT page_id,result FROM feedbacks WHERE page_id = ? LIMIT 1",
                //   [pageId]
                // );
                // console.log("🚀 ~ handleGetMetaData ~ postData:", postData);

                // const postData = {
                //   id: "page1.Response.id", // Replace with actual data as needed
                //   sku: "req.body.sku", // Replace with actual data as needed
                // };

                try {
                  //   const fieldExists = async (field) => {
                  //     const [rows] = await db.query(
                  //       `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'feedbacks' AND COLUMN_NAME = ?`,
                  //       [field]
                  //     );
                  //     return rows[0].count > 0;
                  //   };

                  //   const postData = body.map(async (field) => {
                  //     if (await fieldExists(field)) {
                  //       const [rows] = await db.query(
                  //         `SELECT \`${field}\` FROM feedbacks WHERE page_id = ? LIMIT 1`,
                  //         [pageId]
                  //       );
                  //       return rows;
                  //     }
                  //   });

                  //   // Wait for all queries to complete
                  //   const results = await Promise.all(postData);

                  const [feedbackResult] = await db.query(
                    `
                    SELECT feedbacks.result 
                    FROM feedbacks 
                    JOIN pages ON feedbacks.page_id = pages.id 
                    WHERE pages.order_id = ? AND pages.flow_id = ?
                    `,
                    [body.id, req.query.flow_id]
                  );

                  // Check if result has an entry
                  if (feedbackResult.length === 0) {
                    throw new Error(
                      "No feedback found for the given order_id and flow_id"
                    );
                  }

                  // Extract the result
                  const results = feedbackResult[0].result;
                  console.log("🚀 ~ handleGetMetaData ~ result:", results);

                  let postData = {};
                  console.log(typeof body);
                  const bodyKeys = Object.keys(body);
                  const dataToPost = bodyKeys.map((field) => {
                    if (result.hasOwnProperty(field)) {
                      postData[field] = results[field];
                    }
                    return postData;
                  });

                  // Make the GET request to the external API
                  const apiResponse = await axios.post(apiUrl, postData, {
                    headers: {
                      "Content-Type": "application/json",
                    },
                  });
                } catch (error) {
                  // Handle errors
                  console.error("Error fetching data from API:", error);
                  return res
                    .status(500)
                    .json({ error: "Internal Server Error" });
                }
                item.api.Success.Response.data = apiResponse;
              }
            } catch (apiError) {
              console.error("API call error:", apiError);
              return res
                .status(500)
                .json({ msg: "Error fetching data from API", error });
            }
          }

          //   item.apiResponse = apiResponse.flat();
        }
      }
    }

    if (data.order_id === 1) {
      const request_id = uuid.v4();
      return res.json({ data, token, request_id });
    } else {
      return res.json({ data, token });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({ error: "Failed to fetch data" });
  }
}

async function handleFeedbackData(req, res) {
  try {
    const request_id = req.headers.request_id;
    const { page_id, result, flow_id } = req.body;

    // Validate input
    if (!page_id || !result || !request_id || !flow_id) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // Check if feedback already exists
    const [existingData] = await db.query(
      "SELECT * FROM feedbacks WHERE page_id = ? AND request_id = ?",
      [page_id, request_id]
    );

    if (existingData.length > 1) {
      // Update existing feedback
      await db.query(
        "UPDATE feedbacks SET result = ? WHERE page_id = ? AND request_id = ?",
        [JSON.stringify(result), page_id, request_id]
      );
      return res.json({ msg: "Feedback updated successfully" });
    } else {
      // Insert new feedback
      const [data] = await db.query(
        "INSERT INTO feedbacks (result, page_id, request_id) VALUES (?, ?, ?)",
        [JSON.stringify(result), page_id, request_id]
      );
      return res.json({
        msg: "Feedback saved successfully",
        id: data.insertId,
      });
    }
  } catch (error) {
    console.error("Error handling feedback data:", error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
}

async function handleGetMobileData(req, res) {
  const { request_id } = req.headers;
  const [listStoredFeedback] = await db.query(
    "SELECT * FROM feedbacks WHERE request_id = ?",
    [request_id]
  );
  return res.json(listStoredFeedback);
}

module.exports = {
  handleMetaData,
  handleGetMetaData,
  handleGetFlows,
  handleFeedbackData,
  handleGetMobileData,
};
