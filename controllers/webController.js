const { db } = require("../connection");
const axios = require("axios");
const uuid = require("uuid");

// Storing all Meta Data
async function handleMetaData(req, res) {
  try {
    const { flow_name, pages, variable } = req.body;

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

    const [variabledata] = await db.query(
      "INSERT INTO flowvariables (variables, flow_id) VALUES (?, ?)",
      [JSON.stringify(variable), flowId]
    );
    console.log("🚀 ~ handleMetaData ~ variabledata:", variabledata);

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

async function handlePostFlows(req, res) {
  const x = req.body;
  console.log(x);
  return res.json("Successfully got Data");
}

async function handleGetFlowData(req, res) {
  const [pages] = await db.query(
    "SELECT step_type,meta_data,flow_id,order_id FROM pages WHERE flow_id = ? and isDeleted = ?",
    [req.query.flow_id, false]
  );
  return res.json({ pages });
}

async function handleUpdateFlow(req, res) {
  //   const { flow_id } = req.query;
  //   const pages = req.body.pages;

  //   const promises = pages.map(async (page) => {
  //     const { step_type, meta_data, order_id } = page;
  //     const [update] = await db.query(
  //       "UPDATE pages SET step_type = ?, meta_data = ? WHERE flow_id = ? and order_id =?",
  //       [step_type, JSON.stringify(meta_data), flow_id, order_id]
  //     );
  //   });

  //   const [updateFlow] = await db.query("SELECT * FROM pages WHERE flow_id = ?", [
  //     flow_id,
  //   ]);
  //   console.log("🚀 ~ handleUpdateFlow ~ updateFlow:", updateFlow);
  //   const updatedFlow = await Promise.all(updateFlow);

  //   console.log("🚀 ~ handleUpdateFlow ~ updatedFlow:", updatedFlow);
  //   return res
  //     .status(200)
  //     .json({ message: "Data saved successfully!", updatedFlow });

  try {
    const { flow_id } = req.query;
    const { pages } = req.body;

    try {
      const [deleted] = await db.query(
        "UPDATE pages SET isDeleted = TRUE WHERE flow_id = ?",
        [flow_id]
      );
      console.log(`Rows affected: ${deleted.affectedRows}`);
    } catch (error) {
      console.error("Error updating pages:", error);
    }

    const promises = pages.map((page) => {
      const { step_type, meta_data, order_id } = page;
      return db.query(
        "INSERT INTO pages (step_type, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)",
        [step_type, JSON.stringify(meta_data), order_id, flow_id]
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
async function handleGetMetaData(req, res) {
  try {
    const { flow_id } = req.query;
    let token = null;

    let whereClause = `(SELECT MIN(order_id) FROM pages WHERE order_id != 0 AND flow_id = ? AND isDeleted = FALSE)`;
    let queryValues = [];

    if (req.headers.x_page_token) {
      const bufferObj = Buffer.from(req.headers.x_page_token, "base64");
      token = JSON.parse(bufferObj.toString("utf8"));
      whereClause = "?";
      queryValues.push(token.next_order_id);
    }

    queryValues.push(flow_id);
    queryValues.push(flow_id);

    const query = `SELECT * FROM pages WHERE order_id = ${whereClause} AND flow_id = ? AND isDeleted = FALSE LIMIT 1`;
    let [data] = await db.query(query, queryValues);
    data = data[0];

    // Verify if next page exists
    token = null;
    const [orderInfo] = await db.query(
      "SELECT order_id FROM pages WHERE order_id = ? AND flow_id = ? AND isDeleted = FALSE LIMIT 1",
      [data.order_id + 1, flow_id]
    );
    if (orderInfo.length > 0) {
      token = { next_order_id: orderInfo[0].order_id };
      const buffer = Buffer.from(JSON.stringify(token), "utf-8");
      token = buffer.toString("base64");
    }

    let [apidetails] = await db.query(
      "SELECT * FROM pages WHERE order_id = ? AND flow_id = ? AND isDeleted = FALSE",
      [0, flow_id]
    );
    apidetails = apidetails[0];

    if (data.meta_data) {
      for (const item of data.meta_data) {
        if (item.inputs) {
          for (let input of item.inputs) {
            let xyz = null;
            let varMatch = null;

            for (let key in input) {
              const value = input[key];
              if (Array.isArray(value)) {
                value.forEach((val) => {
                  if (
                    typeof val === "string" &&
                    val.includes("{{") &&
                    val.includes("}}")
                  ) {
                    xyz = key;
                    varMatch = val.replace(/\{\{(.*?)\}\}/, "$1").trim();
                  }
                });
              }
            }

            if (xyz && input.hasOwnProperty(xyz)) {
              for (let apiObj of apidetails) {
                if (
                  apiObj.meta_data[0].details.Success.Response.Variable ===
                  varMatch
                ) {
                  let httpType = apiObj.meta_data[0].details.Type.toLowerCase();
                  const flowid = data.flow_id;
                  const apiUrls = apiObj.meta_data[0].details.Url;

                  if (Array.isArray(apiUrls)) {
                    return res.json({
                      msg: "Url key has multiple values, only single is required",
                    });
                  }

                  if (httpType === "get") {
                    let params = "";
                    let firstParam = true;

                    for (let fld in apiObj.meta_data[0].details.Param) {
                      if (firstParam) {
                        firstParam = false;
                        params += "?";
                      } else {
                        params += "&";
                      }

                      let paramsUrl = [];
                      let [searching] = await db.query(
                        "SELECT * FROM flowvariables WHERE flow_id = ?",
                        [flowid]
                      );
                      searching = searching[0];

                      if (!searching) {
                        console.log("No Variables data found");
                      }

                      const variables = searching.variable;
                      for (let item of variables) {
                        if (
                          item.key === apiObj.meta_data[0].details.Param[fld]
                        ) {
                          let [mobileData] = await db.query(
                            "SELECT feedbacks.* FROM feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE pages.flow_id = ?",
                            [flowid]
                          );
                          const mobileDatas = mobileData[0];
                          let reqVariables = mobileDatas.result[item.key];
                          paramsUrl.push(reqVariables);
                        }
                      }
                      params += fld + "=" + paramsUrl;
                    }

                    let API_URL = apiUrls + params;
                    const response = await axios.get(API_URL);
                    let apiResponse = response.data;

                    let extractedData;
                    if (
                      apiObj.meta_data[0].details.Success.Response.field
                        .length > 0
                    ) {
                      if (Array.isArray(apiResponse)) {
                        extractedData = apiResponse.map((data) => {
                          let extData = {};
                          for (let fld of apiObj.meta_data[0].details.Success
                            .Response.field) {
                            extData[fld] = data[fld];
                          }
                          return extData;
                        });
                      } else {
                        let extData = {};
                        for (let fld of apiObj.meta_data[0].details.Success
                          .Response.field) {
                          extData[fld] = apiResponse[fld];
                        }
                        extractedData = [extData];
                      }
                    } else {
                      extractedData = null;
                    }
                    input[xyz] = extractedData;
                  } else if (httpType === "post") {
                    let body = apiObj.meta_data[0].details.Body;
                    const entries = Object.entries(body);
                    let reqVariablesdata = [];

                    for (let [key, value] of entries) {
                      const match = value.replace(/\{\{(.*?)\}\}/, "$1").trim();
                      let [searching] = await db.query(
                        "SELECT * FROM flowvariables WHERE flow_id = ?",
                        [flowid]
                      );
                      searching = searching[0];

                      if (!searching) {
                        console.log("No Variables found");
                      }

                      const variables = searching.variable;
                      for (let item of variables) {
                        if (item.key === match) {
                          let [mobileData] = await db.query(
                            "SELECT feedbacks.* FROM feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE pages.flow_id = ?",
                            [flowid]
                          );
                          const mobileDatas = mobileData[0];
                          if (mobileDatas) {
                            let reqVariables = mobileDatas.result[item.key];
                            reqVariablesdata.push(reqVariables);
                          }
                        }
                      }
                    }

                    const response = await axios.post(
                      apiUrls,
                      reqVariablesdata
                    );

                    // input[xyz] = response.status;
                  }
                }
              }
            }
          }
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

function extractVariableName(templateString) {
  // Regex to match the template format {{variable}}
  const match = templateString.match(/{{(.*?)}}/);
  return match ? match[1] : null;
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
    console.log("🚀 ~ handleFeedbackData ~ existingData:", existingData.length);
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
  handlePostFlows,
  handleUpdateFlow,
  handleGetFlowData,
  handleFeedbackData,
  handleGetMobileData,
};
