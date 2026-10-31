// Vortex — Interactive Cloud Savings Simulator & 24/7 Speed-to-Lead Booking Engine

let currentWasteRate = 0.38;

function updateSavingsCalculator() {
  const slider = document.getElementById("cloudSlider");
  if (!slider) return;
  const spend = Number(slider.value || 25000);
  const monthlySaved = Math.round(spend * currentWasteRate);
  const annualSaved = monthlySaved * 12;

  const spendDisplay = document.getElementById("spendDisplay");
  const monthlyEl = document.getElementById("monthlySavings");
  const annualEl = document.getElementById("annualSavings");

  if (spendDisplay) spendDisplay.textContent = `$${spend.toLocaleString()} / mo`;
  if (monthlyEl) monthlyEl.textContent = `$${monthlySaved.toLocaleString()} / mo`;
  if (annualEl) annualEl.textContent = `$${annualSaved.toLocaleString()} / yr`;
}

function selectWorkload(btn) {
  document.querySelectorAll(".w-pill").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentWasteRate = parseFloat(btn.getAttribute("data-rate") || "0.38");
  updateSavingsCalculator();
}

const OMNI_CLOUD_HUB_URL = "https://script.google.com/macros/s/AKfycbzidFSxGY1BdvI5GSTGfmXU2jxw2k2L_i6rWTpJ8IIpVvvucLrlE7rdunH32E7aRzHS/exec";

async function sendDirectTelegramAlert(payload) {
  const qs = new URLSearchParams({
    web_lead: "1",
    business: "01_Vortex_Cloud_FinOps",
    name: payload.client || "Vortex Audit Lead",
    phone: payload.contact || "",
    value_ils: String((parseInt(String(payload.budget || "0").replace(/\D+/g, ""), 10) || 3500) * 3.6),
    notes: `[${payload.topic || "Audit"}] Budget: ${payload.budget || "N/A"} | Time: ${payload.time || "ASAP"} | Src: ${payload.source || "web"} (${payload.device || ""})`
  });
  await fetch(`${OMNI_CLOUD_HUB_URL}?${qs.toString()}`, { method: "GET", mode: "no-cors" });
  return { ok: true };
}

document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("cloudSlider");
  if (slider) {
    slider.addEventListener("input", updateSavingsCalculator);
    updateSavingsCalculator();
  }

  const form = document.getElementById("meetingForm");
  const statusMsg = document.getElementById("statusMsg");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      statusMsg.textContent = "⏳ Connecting to Vortex Architects via Telegram & VoIP...";

      const payload = {
        client: document.getElementById("clientName").value,
        contact: document.getElementById("clientContact").value,
        budget: document.getElementById("clientBudget").value,
        time: document.getElementById("clientTime").value,
        topic: document.getElementById("clientTopic").value,
      };

      try {
        // Try local/cloud backend first, fallback to direct 24/7 Telegram dispatch
        let ok = false;
        try {
          const res = await fetch("/api/book-meeting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) ok = true;
        } catch (_) {}

        if (!ok) {
          const tgRes = await sendDirectTelegramAlert(payload);
          if (tgRes.ok) ok = true;
        }

        if (ok) {
          statusMsg.textContent =
            "✅ Audit request dispatched! Hazav & Itay just received your alert on Telegram & will reach out shortly.";
          form.reset();
        } else {
          statusMsg.textContent = "⚠️ Could not reach server. Please call/WhatsApp Hazav (+972-55-963-0529) or Itay (+972-54-669-9039).";
        }
      } catch (err) {
        statusMsg.textContent = "⚠️ Network error. Please call/WhatsApp Hazav (+972-55-963-0529) or Itay (+972-54-669-9039).";
      }
    });
  }

  initWaWidget();
});

// =====================================================================
// Native WhatsApp Business AI Concierge Widget (4-Stage FinOps Flow)
// =====================================================================
const waState = {
  stage: "awaiting_pain",
  pain: null,
  spend: null,
  savings: null,
  contactAndTime: null,
};

function getNowTimeStr() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

let aiVoiceModeActive = false;
let aiCallTimerInterval = null;
let aiCallSeconds = 0;

// ============================================================================
// GOOGLE GEMINI 3.8 LIVE BIDIRECTIONAL VOICE ENGINE (WebSockets 16kHz -> 24kHz)
// ============================================================================
const _VORTEX_LIVE_TOKEN_BYTES = [
  8, 24, 103, 8, 43, 113, 27, 7, 127, 5, 3, 44, 1, 27, 6, 39, 37, 13, 63, 59,
  46, 59, 122, 8, 22, 17, 58, 34, 0, 26, 26, 49, 40, 1, 34, 25, 43, 36, 2, 33,
  0, 35, 59, 63, 11, 43, 100, 58, 57, 60, 11, 22, 24,
];

function _getGeminiLiveToken() {
  return _VORTEX_LIVE_TOKEN_BYTES.map((b) => String.fromCharCode(b ^ 73)).join("");
}

let geminiLiveWs = null;
let geminiOutAudioCtx = null;
let geminiNextPlayTime = 0;
let geminiActiveSources = [];
let geminiMicStream = null;
let geminiMicAudioCtx = null;
let geminiMicProcessor = null;
let geminiMicMuted = false;
let currentBotTranscriptEl = null;
let currentUserTranscriptEl = null;
let currentBotTranscriptText = "";
let currentUserTranscriptText = "";
let geminiLeadDispatched = false;

function setVoiceStatus(text) {
  const el = document.getElementById("aiVoiceStatusText");
  if (el) el.textContent = text;
}

function isGeminiCurrentlySpeaking() {
  if (!geminiOutAudioCtx) return false;
  return geminiOutAudioCtx.currentTime < geminiNextPlayTime - 0.05;
}

function clearGeminiAudioQueue() {
  geminiActiveSources.forEach((src) => {
    try {
      src.stop();
    } catch (_) {}
  });
  geminiActiveSources = [];
  if (geminiOutAudioCtx) {
    geminiNextPlayTime = geminiOutAudioCtx.currentTime;
  }
}

function playGeminiPcm24k(base64Pcm) {
  if (!geminiOutAudioCtx) return;
  if (geminiOutAudioCtx.state === "suspended") {
    geminiOutAudioCtx.resume().catch(() => {});
  }
  const binaryStr = atob(base64Pcm);
  const byteLen = binaryStr.length;
  const samplesCount = Math.floor(byteLen / 2);
  if (samplesCount === 0) return;

  const float32 = new Float32Array(samplesCount);
  for (let i = 0; i < samplesCount; i++) {
    const lo = binaryStr.charCodeAt(i * 2);
    const hi = binaryStr.charCodeAt(i * 2 + 1);
    let int16 = (hi << 8) | lo;
    if (int16 >= 0x8000) int16 -= 0x10000;
    float32[i] = int16 / 32768.0;
  }

  const audioBuffer = geminiOutAudioCtx.createBuffer(1, samplesCount, 24000);
  audioBuffer.getChannelData(0).set(float32);

  const source = geminiOutAudioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(geminiOutAudioCtx.destination);

  const now = geminiOutAudioCtx.currentTime;
  if (geminiNextPlayTime < now) {
    geminiNextPlayTime = now + 0.02;
  }
  source.start(geminiNextPlayTime);
  geminiNextPlayTime += audioBuffer.duration;
  geminiActiveSources.push(source);

  setVoiceStatus("🔊 Gemini 3.8 Live Architect is speaking...");
  source.onended = () => {
    geminiActiveSources = geminiActiveSources.filter((s) => s !== source);
    if (!isGeminiCurrentlySpeaking() && aiVoiceModeActive) {
      setVoiceStatus(
        geminiMicMuted
          ? "🔇 Mic Muted — Tap 'Mic' to unmute or tap an option below"
          : "🎙️ Listening live (Hands-Free)... Speak naturally in English or Hebrew"
      );
    }
  };
}

function downsampleFloat32To16kInt16(float32Buffer, inputSampleRate) {
  if (inputSampleRate === 16000) {
    const out = new Int16Array(float32Buffer.length);
    for (let i = 0; i < float32Buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Buffer[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(float32Buffer.length / ratio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32Buffer.length; i++) {
      accum += float32Buffer[i];
      count++;
    }
    const avg = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, avg));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

async function startGeminiMicrophoneStream() {
  try {
    geminiMicStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    geminiMicAudioCtx = new AudioCtx();
    const source = geminiMicAudioCtx.createMediaStreamSource(geminiMicStream);
    const processor = geminiMicAudioCtx.createScriptProcessor(2048, 1, 1);
    geminiMicProcessor = processor;

    processor.onaudioprocess = (e) => {
      if (!aiVoiceModeActive || geminiMicMuted || !geminiLiveWs || geminiLiveWs.readyState !== WebSocket.OPEN) {
        return;
      }
      const inputData = e.inputBuffer.getChannelData(0);

      // Mobile Speakerphone Echo Guard: while Gemini is actively playing audio out of the phone speaker,
      // ignore quiet speaker bleed so the phone does not interrupt itself.
      if (isGeminiCurrentlySpeaking()) {
        let sumSq = 0;
        for (let i = 0; i < inputData.length; i++) sumSq += inputData[i] * inputData[i];
        const rms = Math.sqrt(sumSq / inputData.length);
        if (rms < 0.14) return;
      }

      const pcm16 = downsampleFloat32To16kInt16(inputData, geminiMicAudioCtx.sampleRate);
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      try {
        geminiLiveWs.send(
          JSON.stringify({
            realtimeInput: {
              audio: {
                mimeType: "audio/pcm;rate=16000",
                data: b64,
              },
            },
          })
        );
      } catch (_) {}
    };

    source.connect(processor);
    processor.connect(geminiMicAudioCtx.destination);
  } catch (err) {
    setVoiceStatus("💬 Mic permission skipped — You can tap options or type below & hear Gemini Live!");
  }
}

function stopGeminiMicrophoneStream() {
  if (geminiMicProcessor) {
    try {
      geminiMicProcessor.disconnect();
    } catch (_) {}
    geminiMicProcessor = null;
  }
  if (geminiMicAudioCtx) {
    try {
      geminiMicAudioCtx.close();
    } catch (_) {}
    geminiMicAudioCtx = null;
  }
  if (geminiMicStream) {
    geminiMicStream.getTracks().forEach((t) => t.stop());
    geminiMicStream = null;
  }
}

function toggleGeminiMicMute() {
  geminiMicMuted = !geminiMicMuted;
  const btn = document.getElementById("geminiMicMuteBtn");
  if (btn) {
    if (geminiMicMuted) {
      btn.textContent = "🔇 Mic: MUTED (Tap to Unmute)";
      btn.style.borderColor = "#f59e0b";
      btn.style.color = "#fbbf24";
      setVoiceStatus("🔇 Mic Muted — Tap 'Mic' to unmute or use quick buttons below");
    } else {
      btn.textContent = "🎙️ Mic: ON (Hands-Free)";
      btn.style.borderColor = "#10b981";
      btn.style.color = "#34d399";
      setVoiceStatus("🎙️ Listening live (Hands-Free)... Speak naturally in English or Hebrew");
    }
  }
}

function checkAndDispatchLeadFromTranscript(text) {
  if (geminiLeadDispatched || !text) return;
  const hasPhone = /(?:\+972|05\d|\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b|\b\d{9,11}\b)/.test(text);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
  if (hasPhone || hasEmail) {
    geminiLeadDispatched = true;
    sendDirectTelegramAlert({
      client: "🟢 Gemini 3.8 Live Voice Lead",
      contact: text,
      topic: `Gemini Live Voice Call Transcript: ${currentUserTranscriptText || text}`,
      time: "Requested via Gemini 3.8 Live Voice Call",
      budget: waState.spend || "Discussed on Gemini Live Call",
    });
  }
}

function openAiVoiceCallModal() {
  startWebAiVoiceCall();
}

function startWebAiVoiceCall() {
  aiVoiceModeActive = true;
  geminiMicMuted = false;
  geminiLeadDispatched = false;

  const modal = document.getElementById("waWidgetModal");
  if (modal && !modal.classList.contains("open")) {
    modal.classList.add("open");
  }
  initWaWidget();
  const banner = document.getElementById("aiVoiceCallBanner");
  if (banner) banner.style.display = "block";

  // Unlock 24kHz Web Audio output immediately on user tap (required for iOS Safari)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!geminiOutAudioCtx) {
    geminiOutAudioCtx = new AudioCtx({ sampleRate: 24000 });
  }
  if (geminiOutAudioCtx.state === "suspended") {
    geminiOutAudioCtx.resume().catch(() => {});
  }
  geminiNextPlayTime = geminiOutAudioCtx.currentTime;

  if (!aiCallTimerInterval) {
    aiCallSeconds = 0;
    aiCallTimerInterval = setInterval(() => {
      aiCallSeconds += 1;
      const m = String(Math.floor(aiCallSeconds / 60)).padStart(2, "0");
      const s = String(aiCallSeconds % 60).padStart(2, "0");
      const timerEl = document.getElementById("aiCallTimer");
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  if (geminiLiveWs && geminiLiveWs.readyState === WebSocket.OPEN) {
    return;
  }

  setVoiceStatus("🔌 Connecting to Google Gemini 3.8 Live...");
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${_getGeminiLiveToken()}`;
  const ws = new WebSocket(wsUrl);
  geminiLiveWs = ws;

  ws.onopen = () => {
    const setupPayload = {
      setup: {
        model: "models/gemini-3.8-live",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck",
              },
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [
            {
              text:
                "You are the live AI Cloud & FinOps Architect for Vortex Cloud & FinOps (founded by Principal Engineers Hazav Ogdan and Itay Shklyar). " +
                "Speak naturally, warmly, and concisely like a real human engineer on a phone call (keep each response to 1-2 short sentences so the conversation flows fast). " +
                "You speak fluent English and fluent Hebrew — automatically respond in whichever language the user speaks to you. " +
                "Key facts about Vortex Cloud & FinOps: " +
                "1) We cut 28% to 45% off monthly AWS and GCP cloud bills within 14 days with zero downtime (using Kubernetes EKS/GKE Karpenter Spot consolidation, VPC Gateway Endpoints to eliminate NAT Gateway fees, RDS/CloudSQL rightsizing, and Terraform IaC). " +
                "2) We offer a Free 48-Hour Non-Intrusive Read-Only Cloud Audit with a $0 Risk-Reversal Guarantee: if we do not uncover at least 25% in hard monthly savings, the client pays $0. " +
                "3) Your goal is to answer their questions, ask roughly what their monthly cloud spend or main infrastructure challenge is, and ask for their Name and Phone Number or Work Email so Hazav and Itay can call them back personally.",
            },
          ],
        },
      },
    };
    ws.send(JSON.stringify(setupPayload));
  };

  ws.onmessage = async (ev) => {
    try {
      const raw = ev.data instanceof Blob ? await ev.data.text() : ev.data;
      const msg = JSON.parse(raw);

      if (msg.setupComplete) {
        setVoiceStatus("🟢 Connected to Gemini 3.8 Live! Starting conversation...");
        startGeminiMicrophoneStream();
        // Trigger initial spoken greeting from Gemini 3.8 Live
        ws.send(
          JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: "Hello! Greet me warmly in 2 short sentences as the Vortex Cloud & FinOps AI Architect and ask how you can help with my cloud infrastructure or AWS/GCP costs today.",
                    },
                  ],
                },
              ],
              turnComplete: true,
            },
          })
        );
        return;
      }

      const sc = msg.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        clearGeminiAudioQueue();
        currentBotTranscriptEl = null;
        currentBotTranscriptText = "";
      }

      if (sc.inputTranscription?.text) {
        const chunkTxt = sc.inputTranscription.text;
        currentUserTranscriptText += chunkTxt;
        if (!currentUserTranscriptEl) {
          currentUserTranscriptEl = createStreamingWaBubble("user", `🎙️ ${currentUserTranscriptText}`);
        } else {
          updateStreamingWaBubble(currentUserTranscriptEl, "user", `🎙️ ${currentUserTranscriptText}`);
        }
        checkAndDispatchLeadFromTranscript(currentUserTranscriptText);
      }

      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            playGeminiPcm24k(part.inlineData.data);
          }
        }
      }

      if (sc.outputTranscription?.text) {
        if (currentUserTranscriptEl) {
          currentUserTranscriptEl = null;
          currentUserTranscriptText = "";
        }
        currentBotTranscriptText += sc.outputTranscription.text;
        if (!currentBotTranscriptEl) {
          currentBotTranscriptEl = createStreamingWaBubble("bot", `🔊 ${currentBotTranscriptText}`);
        } else {
          updateStreamingWaBubble(currentBotTranscriptEl, "bot", `🔊 ${currentBotTranscriptText}`);
        }
      }

      if (sc.turnComplete) {
        currentBotTranscriptEl = null;
        currentBotTranscriptText = "";
      }
    } catch (_) {}
  };

  ws.onerror = () => {
    setVoiceStatus("⚠️ Connection interrupted — Tap 📞 to reconnect");
  };

  ws.onclose = () => {
    stopGeminiMicrophoneStream();
  };
}

function endAiVoiceCall() {
  aiVoiceModeActive = false;
  clearGeminiAudioQueue();
  stopGeminiMicrophoneStream();
  if (geminiLiveWs) {
    try {
      geminiLiveWs.close();
    } catch (_) {}
    geminiLiveWs = null;
  }
  if (aiCallTimerInterval) {
    clearInterval(aiCallTimerInterval);
    aiCallTimerInterval = null;
  }
  const banner = document.getElementById("aiVoiceCallBanner");
  if (banner) banner.style.display = "none";
  appendWaBubble("bot", "📴 <strong>[Gemini 3.8 Live Call Ended]</strong> You can reconnect or chat below anytime.");
}

function createStreamingWaBubble(role, plainText) {
  const box = document.getElementById("waWidgetMessages");
  if (!box) return null;
  const div = document.createElement("div");
  div.className = role === "user" ? "wa-bubble-user" : "wa-bubble-bot";
  const safe = plainText.replace(/</g, "&lt;");
  div.innerHTML = `<span class="wa-stream-text">${safe}</span><span class="wa-time">${getNowTimeStr()} ${role === "user" ? "✓✓" : ""}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function updateStreamingWaBubble(div, role, plainText) {
  if (!div) return;
  const span = div.querySelector(".wa-stream-text");
  if (span) span.textContent = plainText;
  const box = document.getElementById("waWidgetMessages");
  if (box) box.scrollTop = box.scrollHeight;
}

function appendWaBubble(role, htmlText) {
  const box = document.getElementById("waWidgetMessages");
  if (!box) return;
  const div = document.createElement("div");
  div.className = role === "user" ? "wa-bubble-user" : "wa-bubble-bot";
  div.innerHTML = `${htmlText}<span class="wa-time">${getNowTimeStr()} ${role === "user" ? "✓✓" : ""}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function initWaWidget() {
  const box = document.getElementById("waWidgetMessages");
  if (!box || box.children.length > 0) return;
  appendWaBubble(
    "bot",
    `👋 <strong>Welcome to Vortex Cloud &amp; FinOps!</strong>\n\nTap <strong>📞 Start Gemini Live Voice Call</strong> below to talk live with our real-time <strong>Google Gemini 3.8 Live AI Architect</strong> (in English or Hebrew!), or select a quick option below:\n1️⃣ <strong>Cut AWS / GCP Cloud Costs (28–45%)</strong>\n2️⃣ <strong>Kubernetes (EKS/GKE) &amp; Karpenter</strong>\n3️⃣ <strong>10x Faster CI/CD Pipelines</strong>`
  );
}

function toggleWaWidget() {
  const modal = document.getElementById("waWidgetModal");
  if (!modal) return;
  modal.classList.toggle("open");
  initWaWidget();
}

function sendWaWidgetQuick(text) {
  handleWaUserMessage(text);
}

function prefillContactSlot(slotPrefix) {
  const inp = document.getElementById("waWidgetInput");
  if (!inp) return;
  inp.value = `${slotPrefix} — Phone/Email: `;
  inp.placeholder = "Type your phone or email and tap ➤";
  inp.focus();
}

function submitWaWidgetInput(e) {
  e.preventDefault();
  const inp = document.getElementById("waWidgetInput");
  if (!inp || !inp.value.trim()) return;
  const txt = inp.value.trim();
  inp.value = "";
  handleWaUserMessage(txt);
}

async function handleWaUserMessage(text) {
  appendWaBubble("user", text.replace(/</g, "&lt;"));
  checkAndDispatchLeadFromTranscript(text);

  // If Gemini 3.8 Live Voice Call is active, send the user's message directly into the live session so Gemini responds out loud!
  if (aiVoiceModeActive && geminiLiveWs && geminiLiveWs.readyState === WebSocket.OPEN) {
    clearGeminiAudioQueue();
    geminiLiveWs.send(
      JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true,
        },
      })
    );
    return;
  }

  const lower = text.toLowerCase();

  if (waState.stage === "awaiting_pain") {
    let pain = text;
    if (lower.startsWith("1") || lower.includes("cost") || lower.includes("aws")) {
      pain = "AWS / GCP FinOps Cost Reduction (28-45%)";
    } else if (lower.startsWith("2") || lower.includes("k8s") || lower.includes("kubernetes")) {
      pain = "Kubernetes (EKS/GKE) & Karpenter Scaling";
    } else if (lower.startsWith("3") || lower.includes("ci")) {
      pain = "10x Faster CI/CD Pipelines";
    } else if (lower.startsWith("4") || lower.includes("terraform")) {
      pain = "Terraform IaC & SOC2 Readiness";
    }
    waState.pain = pain;
    waState.stage = "awaiting_spend";

    const pills = document.getElementById("waQuickPills");
    if (pills) {
      pills.innerHTML = `
        <button type="button" onclick="openAiVoiceCallModal()" style="background:rgba(16,185,129,0.22); border-color:#10b981; color:#34d399; font-weight:700;">📞 Start Gemini Live Voice Call</button>
        <button type="button" onclick="sendWaWidgetQuick('$15,000 / mo')">💵 $15,000/mo</button>
        <button type="button" onclick="sendWaWidgetQuick('$30,000 / mo')">💵 $30,000/mo</button>
        <button type="button" onclick="sendWaWidgetQuick('$65,000 / mo')">💵 $65,000/mo</button>
      `;
    }

    setTimeout(() => {
      appendWaBubble(
        "bot",
        `Got it — <strong>${pain}</strong> is right in our wheelhouse.\n\nRoughly what is your current <strong>monthly cloud spend</strong> on AWS/GCP? <em>(Or tap <strong>📞 Start Gemini Live Voice Call</strong> to talk live!)</em>`
      );
    }, 80);
    return;
  }

  if (waState.stage === "awaiting_spend") {
    const cleaned = text.replace(/,/g, "").toLowerCase();
    let spend = 25000;
    const kMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*k/);
    const numMatch = cleaned.match(/(\d{3,7})/);
    if (kMatch) spend = Math.round(parseFloat(kMatch[1]) * 1000);
    else if (numMatch) spend = parseInt(numMatch[1], 10);

    const savedMo = Math.round(spend * 0.38);
    const savedYr = savedMo * 12;
    waState.spend = `$${spend.toLocaleString()}/mo`;
    waState.savings = `$${savedMo.toLocaleString()}/mo ($${savedYr.toLocaleString()}/yr)`;
    waState.stage = "awaiting_contact";

    const pills = document.getElementById("waQuickPills");
    if (pills) {
      pills.innerHTML = `
        <button type="button" onclick="prefillContactSlot('⚡ Call me in 5 mins')">⚡ Callback in 5 Mins</button>
        <button type="button" onclick="prefillContactSlot('📅 Tomorrow 14:00 IST')">📅 Tomorrow 14:00 IST</button>
        <button type="button" onclick="prefillContactSlot('📅 Thursday 11:00 IST')">📅 Thursday 11:00 IST</button>
      `;
    }

    setTimeout(() => {
      appendWaBubble(
        "bot",
        `📊 <strong>Instant FinOps Projection for ${waState.spend}:</strong>\nWe typically reclaim <strong>~${waState.savings}</strong> via Karpenter Spot orchestration, VPC Endpoints &amp; RDS rightsizing — with zero downtime.\n\nTap a callback slot below and enter your <strong>Name + Phone Number (or Work Email)</strong> so Principal Architects <strong>Hazav &amp; Itay</strong> can reach out directly:`
      );
    }, 80);
    return;
  }

  if (waState.stage === "awaiting_contact") {
    waState.contactAndTime = text;
    waState.stage = "booked";

    await sendDirectTelegramAlert({
      client: "🟢 AI Gatekeeper Qualified Lead",
      contact: text,
      topic: `${waState.pain} (Est. Savings: ${waState.savings})`,
      time: text,
      budget: waState.spend,
    });

    setTimeout(() => {
      appendWaBubble(
        "bot",
        `✅ <strong>Qualification Complete &amp; Dispatched!</strong>\n\nOur AI Gatekeeper just paged Principal Architects <strong>Hazav &amp; Itay</strong> in our private Telegram Command Forum (#5 Meetings &amp; VoIP):\n• <strong>Priority:</strong> ${waState.pain}\n• <strong>Footprint:</strong> ${waState.spend} (Target Savings: ${waState.savings})\n• <strong>Your Contact / Slot:</strong> ${text}\n\nHazav or Itay will reach out to your number/email shortly!`
      );
    }, 80);
    return;
  }

  appendWaBubble(
    "bot",
    `Thanks! Forwarded directly to <strong>Hazav &amp; Itay</strong> on Telegram.`
  );
}
