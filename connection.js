const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

db.getConnection()
  .then((connection) => {
    console.log("MySQL Connected");
    connection.release(); // Release the connection back to the pool
  })
  .catch((err) => {
    console.error("Error connecting to MySQL:", err);
  });

module.exports = { db };
