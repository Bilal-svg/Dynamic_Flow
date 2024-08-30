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
    res.status(200).json({ message: "Data saved successfully!" });
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
}

// Sending single record/row from the database
async function handleGetFlows(req, res) {
  try {
    const [flows] = await db.query("SELECT * FROM flows");
    res.json(flows);
  } catch (error) {
    console.error("Error fetching flows:", error);
    res.status(500).json({ error: "Failed to fetch flows" });
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

          if (Array.isArray(apiUrls)) {
            // Fetch data from all URLs if apiUrls is an array
            try {
              const responses = await Promise.all(
                apiUrls.map((url) => axios.get(url))
              );
              apiResponse = responses.map((response) => response.data);
            } catch (apiError) {
              console.error("API call error:", apiError);
              return res
                .status(500)
                .json({ msg: "Error fetching data from API" });
            }
          } else {
            // Fetch data from a single URL if apiUrls is not an array
            try {
              const response = await axios.get(apiUrls);
              apiResponse.push(response.data);
            } catch (apiError) {
              console.error("API call error:", apiError);
              return res
                .status(500)
                .json({ msg: "Error fetching data from API" });
            }
          }

          item.apiResponse = apiResponse.flat();
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
    res.status(500).json({ error: "Failed to fetch data" });
  }
}

async function handleFeedbackData(req, res) {
  try {
    const request_id = req.headers.request_id;
    const { page_id, result } = req.body;

    // Validate input
    if (!page_id || !result || !request_id) {
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

module.exports = {
  handleMetaData,
  handleGetMetaData,
  handleGetFlows,
  handleFeedbackData,
};
