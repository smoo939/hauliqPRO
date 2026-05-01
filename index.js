const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Example route
app.get("/api/login", (req, res) => {
  res.json({ message: "Login endpoint working!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
