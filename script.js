// ===== Settings =====
const ROOM_TEMP = 20;          // °C
const BREW_TEMP = 92;          // °C the water must reach before brewing
const TANK_MAX = 1000;         // ml
const HOPPER_MAX = 100;        // grams of beans
const AUTO_OFF_SECONDS = 45;   // shortened from a real machine's ~30 minutes
const TICK_MS = 100;           // how often the simulation updates
const CUP_SIZES = { espresso: 40, medium: 180, large: 300 }; // ml
const SIZE_NAMES = { espresso: "Espresso cup", medium: "Mug", large: "Travel mug" };

const STATE_LABELS = {
  off: "OFF",
  heating: "HEATING",
  ready: "READY",
  brewing: "BREWING",
  paused: "PAUSED",
  done: "COFFEE READY",
};

// ===== State variables =====
let machineState = "off";      // "off" | "heating" | "ready" | "brewing" | "paused" | "done"
let temperature = ROOM_TEMP;
let waterLevel = 600;
let beansLevel = 40;
let cupPresent = true;
let cupContents = 0;           // ml of coffee in the cup
let brewSize = "medium";
let strength = 3;              // 1 (mild) to 5 (bold)
let brewProgress = 0;          // 0 to 100 percent
let idleSeconds = 0;
let message = "Press Power to start.";

// ===== Page elements =====
const el = (id) => document.getElementById(id);
const powerBtn = el("powerBtn");
const brewBtn = el("brewBtn");
const sizeSelect = el("sizeSelect");
const strengthRange = el("strengthRange");
const cupBtn = el("cupBtn");
const waterBtn = el("waterBtn");
const beansBtn = el("beansBtn");

// ===== Helpers =====
function waterNeeded() {
  return CUP_SIZES[brewSize];
}

function beansNeeded() {
  return Math.round(CUP_SIZES[brewSize] / 20) + strength * 2;
}

const startTime = Date.now();

// kind is one of: "state", "action", "blocked", "warning"
function addLog(kind, text, reason) {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const stamp = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const item = document.createElement("li");
  item.className = `log-${kind}`;
  item.innerHTML = `<span class="stamp">${stamp}</span> <strong>${text}</strong> <span class="reason">${reason}</span>`;
  const list = el("logList");
  list.prepend(item);
  while (list.children.length > 60) list.lastChild.remove();
}

// Every state change goes through here so it gets logged.
function setState(nextState, reason) {
  if (nextState === machineState) return;
  addLog("state", `${STATE_LABELS[machineState]} → ${STATE_LABELS[nextState]}`, reason);
  machineState = nextState;
  idleSeconds = 0;
}

// ===== User actions =====
function pressPower() {
  idleSeconds = 0;

  if (machineState === "off") {
    if (temperature >= BREW_TEMP) {
      setState("ready", "Power pressed, water still hot");
      message = "Still hot from last time. Ready right away.";
    } else {
      setState("heating", "Power pressed");
      message = "Heating water...";
    }
  } else {
    let reason = "Power pressed";
    if (machineState === "brewing" || machineState === "paused") {
      message = "Brew cancelled. Machine off.";
      reason = `Power pressed, brew cancelled at ${Math.round(brewProgress)}% (${Math.round(cupContents)} ml poured)`;
    } else {
      message = "Press Power to start.";
    }
    brewProgress = 0;
    setState("off", reason);
  }
}

function pressBrew() {
  idleSeconds = 0;

  if (machineState === "off") {
    message = "The machine is off. Press Power first.";
  } else if (machineState === "heating") {
    message = `Still heating (${Math.round(temperature)}°C of ${BREW_TEMP}°C). Hang on.`;
  } else if (machineState === "brewing") {
    message = "Already brewing!";
  } else if (machineState === "paused") {
    message = "Put the cup back to keep brewing.";
  } else if (!cupPresent) {
    message = "No cup! Place a cup under the spout.";
  } else if (cupContents > 0) {
    message = "That cup already has coffee. Take it first.";
  } else if (waterLevel < waterNeeded()) {
    message = `Not enough water: need ${waterNeeded()} ml, tank has ${Math.round(waterLevel)} ml.`;
  } else if (beansLevel < beansNeeded()) {
    message = `Not enough beans: need ${beansNeeded()} g, hopper has ${beansLevel} g.`;
  } else {
    beansLevel -= beansNeeded();
    brewProgress = 0;
    setState("brewing",
      `Brew pressed: ${brewSize}, strength ${strength}, using ${waterNeeded()} ml water and ${beansNeeded()} g beans`);
    message = "Grinding and brewing...";
    return;
  }

  addLog("blocked", "Brew refused", message);
}

function toggleCup() {
  idleSeconds = 0;
  cupPresent = !cupPresent;

  if (!cupPresent) {
    if (machineState === "brewing") {
      setState("paused", "Cup removed mid-brew");
      message = "Drip-stop! Brewing paused until the cup is back.";
    } else if (machineState === "done") {
      cupContents = 0;
      setState("ready", "Cup taken");
      message = "Enjoy your coffee!";
    } else {
      const leftover = Math.round(cupContents);
      cupContents = 0;
      message = "Cup removed.";
      addLog("action", "Cup removed", leftover > 0 ? `Took a partial cup (${leftover} ml)` : "Empty cup");
    }
  } else {
    if (machineState === "paused") {
      setState("brewing", `Cup put back, resuming at ${Math.round(brewProgress)}%`);
      message = "Resuming brew...";
    } else {
      message = "Cup placed under the spout.";
      addLog("action", "Cup placed", `${SIZE_NAMES[brewSize]} under the spout`);
    }
  }
}

function refillWater() {
  idleSeconds = 0;
  if (machineState === "brewing" || machineState === "paused") {
    message = "Can't open the tank while brewing.";
    addLog("blocked", "Water refill refused", message);
  } else {
    const before = Math.round(waterLevel);
    waterLevel = TANK_MAX;
    message = "Water tank refilled.";
    addLog("action", "Water refilled", `${before} ml → ${TANK_MAX} ml`);
  }
}

function refillBeans() {
  idleSeconds = 0;
  if (machineState === "brewing" || machineState === "paused") {
    message = "Can't open the hopper while brewing.";
    addLog("blocked", "Bean refill refused", message);
  } else {
    const before = beansLevel;
    beansLevel = HOPPER_MAX;
    message = "Bean hopper refilled.";
    addLog("action", "Beans refilled", `${before} g → ${HOPPER_MAX} g`);
  }
}

// ===== Time passing =====
// Called every TICK_MS. Some state changes happen on their own, not from a click.
function tick() {
  const seconds = TICK_MS / 1000;

  if (machineState === "off") {
    temperature = Math.max(ROOM_TEMP, temperature - 0.3);
  } else if (machineState === "heating") {
    temperature = Math.min(BREW_TEMP, temperature + 1.5);
    if (temperature >= BREW_TEMP) {
      setState("ready", "Reached brew temperature");
      message = "Ready to brew.";
    }
  } else if (machineState === "ready" || machineState === "done") {
    idleSeconds += seconds;
    if (idleSeconds >= AUTO_OFF_SECONDS) {
      setState("off", `No activity for ${AUTO_OFF_SECONDS}s`);
      message = "Auto-off to save energy.";
    }
  } else if (machineState === "brewing") {
    const brewSeconds = 4 + strength; // stronger brews drip slower
    const before = brewProgress;
    brewProgress = Math.min(100, brewProgress + 100 / (brewSeconds * 1000 / TICK_MS));
    const poured = waterNeeded() * (brewProgress - before) / 100;
    waterLevel -= poured;
    cupContents += poured;

    if (brewProgress >= 100) {
      setState("done", `Brew finished: ${waterNeeded()} ml poured in about ${brewSeconds}s`);
      message = "Coffee's ready! Take your cup.";
    }
  }
}

// ===== Visual feedback =====
function setLight(id, isOn) {
  el(id).classList.toggle("on", isOn);
}

function render() {
  const brewingNow = machineState === "brewing" || machineState === "paused";

  document.body.className = `state-${machineState}`;
  el("statusText").textContent = STATE_LABELS[machineState];
  el("tempText").textContent = Math.round(temperature);

  let shownMessage = message;
  const secondsLeft = Math.ceil(AUTO_OFF_SECONDS - idleSeconds);
  if ((machineState === "ready" || machineState === "done") && secondsLeft <= 10) {
    shownMessage = `Auto-off in ${secondsLeft}s...`;
  }
  el("messageText").textContent = shownMessage;

  el("brewBar").style.width = `${brewingNow || machineState === "done" ? brewProgress : 0}%`;

  el("waterFill").style.height = `${(waterLevel / TANK_MAX) * 100}%`;
  el("waterText").textContent = `${Math.round(waterLevel)} ml`;
  el("beansFill").style.height = `${(beansLevel / HOPPER_MAX) * 100}%`;
  el("beansText").textContent = `${beansLevel} g`;

  setLight("lightPower", machineState !== "off");
  setLight("lightHeating", machineState === "heating");
  setLight("lightReady", machineState === "ready" || machineState === "done");
  setLight("lightWater", !brewingNow && waterLevel < waterNeeded());
  setLight("lightBeans", !brewingNow && beansLevel < beansNeeded());

  const cup = el("cup");
  cup.className = `cup ${brewSize}${cupPresent ? "" : " absent"}`;
  el("cupFill").style.height = `${Math.min(100, (cupContents / CUP_SIZES[brewSize]) * 100)}%`;
  el("stream").classList.toggle("flowing", machineState === "brewing");

  cupBtn.textContent = cupPresent ? "Remove cup" : "Place cup";
  el("strengthText").textContent = strength;
  el("needsText").textContent =
    `This brew needs ${waterNeeded()} ml of water and ${beansNeeded()} g of beans.`;

  sizeSelect.disabled = brewingNow;
  strengthRange.disabled = brewingNow;
}

// ===== Wiring inputs to actions =====
powerBtn.addEventListener("click", () => { pressPower(); render(); });
brewBtn.addEventListener("click", () => { pressBrew(); render(); });
cupBtn.addEventListener("click", () => { toggleCup(); render(); });
waterBtn.addEventListener("click", () => { refillWater(); render(); });
beansBtn.addEventListener("click", () => { refillBeans(); render(); });

sizeSelect.addEventListener("change", () => {
  brewSize = sizeSelect.value;
  idleSeconds = 0;
  addLog("action", "Cup size changed", `${SIZE_NAMES[brewSize]} (${CUP_SIZES[brewSize]} ml)`);
  render();
});

strengthRange.addEventListener("input", () => {
  strength = Number(strengthRange.value);
  idleSeconds = 0;
  render();
});

// "input" fires continuously while dragging; "change" fires once on release, so log here.
strengthRange.addEventListener("change", () => {
  addLog("action", "Strength changed", `${strength} / 5, next brew uses ${beansNeeded()} g beans`);
});

// Log a warning only when a supply first runs low, not on every tick.
let waterWarned = false;
let beansWarned = false;

function checkSupplies() {
  if (machineState === "brewing" || machineState === "paused") return;

  const waterLow = waterLevel < waterNeeded();
  const beansLow = beansLevel < beansNeeded();

  if (waterLow && !waterWarned) {
    addLog("warning", "Water low", `Tank has ${Math.round(waterLevel)} ml, next brew needs ${waterNeeded()} ml`);
  }
  if (beansLow && !beansWarned) {
    addLog("warning", "Beans low", `Hopper has ${beansLevel} g, next brew needs ${beansNeeded()} g`);
  }
  waterWarned = waterLow;
  beansWarned = beansLow;
}

setInterval(() => { tick(); checkSupplies(); render(); }, TICK_MS);
render();
