require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");

const app = express();

// CORS configuration:
// We allow all origins by reflecting the request origin.
// This is more robust than '*' especially when credentials/custom headers are involved.
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  methods: "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-access-token, Cache-Control, Pragma",
  credentials: true,
};

console.log("CORS origin configured:", Array.isArray(corsOptions.origin) ? corsOptions.origin.join(",") : corsOptions.origin);

app.use(cors(corsOptions));

const requestMaxSize = "50mb";
// parse requests of content-type - application/json
app.use(express.json({ limit: requestMaxSize }));

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: requestMaxSize }));

// Serve uploaded/generated files so FE can open them by URL
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadDir));

const dbType = process.env.DATABASE_TYPE || 'postgres';
console.log("Initializing models...");
//const db = require("./app/models");
const dbModel = require("./app/models");
console.log("Models initialized");
console.log("Initializing db...");
dbModel.initDB(dbType);
const db = dbModel.db;
console.log("Synchronizing db...");

db.sequelize.sync()
  .then(() => {
    console.log("Database synchronized");
  })
  .catch((err) => {
    console.log("Failed to synchronize db: " + err.message);
  });

// // drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

// simple route
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <script>
          setTimeout(() => window.location.href = "/api-docs", 8000);
        </script>
      </head>
      <body style="text-align: center; font-size: 20px">
        <h1>Welcome to user-service</h1>
        <span style="color:#999999">Connecting to ${dbType} database</span></br></br>
        <span>Redirecting to <a href="/api-docs">/api-docs</a>...</span>
      </body>
    </html>
  `);
});


console.log("Initializing routes...");
require("./app/routes/routes.js")(app);

const USE_HTTPS = false;
const DEFAULT_PORT = USE_HTTPS ? 443 : 3210;
// set port, listen for requests
const PORT = process.env.PORT || DEFAULT_PORT;

let server;
if (USE_HTTPS) {
  console.log("Using https...");
  // const options = {
  //   key: fs.readFileSync("./app/config/key.pem"),
  //   cert: fs.readFileSync("./app/config/cert.pem"),
  // };
  server = https.createServer(app);
} else {
  console.log("Using http...");
  server = http.createServer(app);
}

console.log("Initializing swagger...");
require("./swagger.js")(app, (USE_HTTPS ? `https` : `http`) + `://localhost:${PORT}`);

console.log("Initializing websocket/room...");
require("./app/collab/room.js")(server, corsOptions, db, dbType);
//require("./app/collab/room.js")(server, corsOptions);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
