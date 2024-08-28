require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { db } = require("./connection");
const webRouter = require("./routes/webRoutes");

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

app.use("/api/web", webRouter);

app.listen(8000, () => console.log("Server Started"));
