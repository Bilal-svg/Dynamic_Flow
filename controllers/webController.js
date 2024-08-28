const { db } = require("../connection");
const axios = require("axios");

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
      const { page_id, meta_data, order_id } = page;
      return db.query(
        "INSERT INTO pages (page_id, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)",
        [page_id, JSON.stringify(meta_data), order_id, flowId]
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
          const apiUrls = Object.values(item.api);
          const apiResponses = [];

          for (const apiUrl of apiUrls) {
            try {
              const response = await axios.get(apiUrl);
              apiResponses.push(response.data);
            } catch (apiError) {
              console.error("API call error:", apiError);
              return res
                .status(500)
                .json({ error: "Error fetching data from API" });
            }
          }

          item.apiResponse = apiResponses.flat();
        }
      }
    }

    res.json({ data, token });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
}

module.exports = { handleMetaData, handleGetMetaData, handleGetFlows };
