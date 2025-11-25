const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, "public")));

// Serve generated HLS streams
const streamsDir = path.join(__dirname, "streams");
if (!fs.existsSync(streamsDir)) fs.mkdirSync(streamsDir);
app.use("/streams", express.static(streamsDir));

// Track running ffmpeg sessions
const runningStreams = {};

// Start RTSP → HLS stream
app.post("/start-stream", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing RTSP URL" });
  }

  const id = uuidv4();
  const outDir = path.join(streamsDir, id);
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "index.m3u8");

  const args = [
    "-i", url,
    "-fflags", "nobuffer",
    "-rtsp_transport", "tcp",
    "-an",
    "-c:v", "copy",
    "-hls_time", "1",
    "-hls_list_size", "3",
    "-hls_flags", "delete_segments+append_list",
    "-f", "hls",
    outPath
  ];

  const ffmpeg = spawn("ffmpeg", args);
  runningStreams[id] = ffmpeg;

  ffmpeg.stderr.on("data", data => console.log(`[FFmpeg ${id}] ${data}`));

  ffmpeg.on("close", code => {
    console.log(`FFmpeg ${id} exited with code ${code}`);
    delete runningStreams[id];
  });

  res.json({ id, hlsUrl: `/streams/${id}/index.m3u8` });
});

// Stop a stream
app.post("/stop-stream", (req, res) => {
  const { id } = req.body;

  if (id && runningStreams[id]) {
    runningStreams[id].kill("SIGINT");
    delete runningStreams[id];
  }

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));