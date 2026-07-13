const http = require("http");

http.get("http://localhost:3000/api/telemetry-realtime", (res) => {
  console.log("Local Status Code:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    console.log("Local Response length:", data.length);
    try {
      const parsed = JSON.parse(data);
      console.log("Is array:", Array.isArray(parsed));
      console.log("Array length:", parsed.length);
      if (parsed.length > 0) {
        console.log("First item:", parsed[0]);
      }
    } catch (e) {
      console.error("Parse error:", e.message);
      console.log("Raw output first 500 chars:", data.substring(0, 500));
    }
  });
}).on("error", (err) => {
  console.error("Local request error:", err.message);
});
