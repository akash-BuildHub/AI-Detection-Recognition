/* ==================================================
   SHARED CAMERA MODULE FOR ALL ALGORITHM PAGES
   ================================================== */

// Builds full RTSP URL (supports full or partial RTSP paths)
function buildRtspUrl(cam) {
  if (!cam) return "";

  // If user entered full RTSP URL, use it directly
  if (cam.rtsp && cam.rtsp.toLowerCase().startsWith("rtsp://")) {
    return cam.rtsp.trim();
  }

  if (!cam.ip || !cam.user || !cam.pass) return "";

  const port = cam.port && cam.port.trim() !== "" ? cam.port.trim() : "554";
  const path = (cam.rtsp || "").replace(/^\/+/, ""); // remove leading slashes

  return `rtsp://${encodeURIComponent(cam.user)}:${encodeURIComponent(cam.pass)}@${cam.ip}:${port}/${path}`;
}

// Global HLS instance (so only one player runs at a time)
let globalHls = null;

// Plays HLS stream inside any <video> element
function playCameraStream(hlsUrl, videoElementId, placeholderId = null) {
  const video = document.getElementById(videoElementId);
  if (!video) return;

  // Hide placeholder text
  if (placeholderId) {
    const ph = document.getElementById(placeholderId);
    if (ph) ph.style.display = "none";
  }

  // Destroy previous HLS session
  if (globalHls) {
    globalHls.destroy();
    globalHls = null;
  }

  // If browser supports HLS.js
  if (Hls.isSupported()) {
    globalHls = new Hls();
    globalHls.loadSource(hlsUrl);
    globalHls.attachMedia(video);
  } else {
    // Safari native HLS
    video.src = hlsUrl;
  }

  video.play().catch(() => {});
}

// Calls backend to start the RTSP → HLS stream
function requestStream(cam, videoElementId, placeholderId = null) {
  const rtspUrl = buildRtspUrl(cam);
  if (!rtspUrl) {
    alert("Camera RTSP details are incomplete.");
    return;
  }

  fetch("/start-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: rtspUrl })
  })
  .then(res => res.json())
  .then(data => {
    if (data.hlsUrl) {
      playCameraStream(data.hlsUrl, videoElementId, placeholderId);
    } else {
      alert("Unable to start stream");
    }
  })
  .catch(err => {
    console.error(err);
    alert("Error starting stream");
  });
}

// Load attached cameras into any left-side list
function loadAttachedCameras(listElementId, onCameraClick) {
  const list = document.getElementById(listElementId);
  if (!list) return;

  list.innerHTML = "";

  const cameras = JSON.parse(localStorage.getItem("cameras") || "[]");

  if (cameras.length === 0) {
    list.innerHTML = `<p class='empty-msg'>No cameras attached.</p>`;
    return;
  }

  cameras.forEach((cam, index) => {
    const btn = document.createElement("button");
    btn.className = "camera-btn";
    btn.innerText = cam.name || `Camera ${index + 1}`;
    btn.onclick = () => onCameraClick(cam);
    list.appendChild(btn);
  });
}