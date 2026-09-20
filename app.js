const CITIES = [
  { name: "德国 · 柏林 Berlin", lat: 52.5200, lon: 13.4050 },
  { name: "德国 · 汉堡 Hamburg", lat: 53.5511, lon: 9.9937 },
  { name: "德国 · 慕尼黑 München", lat: 48.1351, lon: 11.5820 },
  { name: "德国 · 科隆 Köln", lat: 50.9375, lon: 6.9603 },
  { name: "德国 · 法兰克福 Frankfurt", lat: 50.1109, lon: 8.6821 },
  { name: "德国 · 斯图加特 Stuttgart", lat: 48.7758, lon: 9.1829 },
  { name: "德国 · 莱比锡 Leipzig", lat: 51.3397, lon: 12.3731 },
  { name: "德国 · 德累斯顿 Dresden", lat: 51.0504, lon: 13.7373 },
  { name: "德国 · 杜塞尔多夫 Düsseldorf", lat: 51.2277, lon: 6.7735 },
  { name: "德国 · 汉诺威 Hannover", lat: 52.3759, lon: 9.7320 },
  { name: "德国 · 不来梅 Bremen", lat: 53.0793, lon: 8.8017 },
  { name: "德国 · 纽伦堡 Nürnberg", lat: 49.4521, lon: 11.0767 },
  { name: "德国 · 弗赖堡 Freiburg", lat: 47.9990, lon: 7.8421 },
  { name: "德国地图自定义坐标", lat: null, lon: null }
];

const GERMANY_BOUNDS = { minLat: 47.1, maxLat: 55.2, minLon: 5.5, maxLon: 15.5 };
const MAP_BOUNDS = { left: 72, right: 648, top: 40, bottom: 660 };

const $ = (id) => document.getElementById(id);
const els = {
  city: $("citySelect"), latitude: $("latitude"), longitude: $("longitude"),
  date: $("dateSelect"), locate: $("locateBtn"), query: $("queryBtn"),
  title: $("locationTitle"), clock: $("localClock"), map: $("worldMap"), mapSvg: $("mapSvg"),
  marker: $("mapMarker"), glow: $("mapGlow"), cursor: $("mapCursor"), hoverCoordinate: $("mapHoverCoordinate"),
  sunMarker: $("sunMarker"), sunHalo: $("sunHalo"),
  coordinate: $("mapCoordinate"), peak: $("peakLux"), meter: $("luxMeter"),
  sunrise: $("sunrise"), sunset: $("sunset"), daylight: $("daylight"), chart: $("chart"),
  avg: $("avgLux"), energy: $("solarEnergy"), cloud: $("cloudCover"), status: $("dataStatus"), toast: $("toast")
};

let forecast = null;
let clockTimer = null;

function init() {
  els.city.innerHTML = CITIES.map((city, i) => `<option value="${i}">${city.name}</option>`).join("");
  els.city.addEventListener("change", chooseCity);
  els.latitude.addEventListener("input", customCoordinates);
  els.longitude.addEventListener("input", customCoordinates);
  els.query.addEventListener("click", loadForecast);
  els.date.addEventListener("change", renderSelectedDay);
  els.locate.addEventListener("click", useLocation);
  els.map.addEventListener("pointermove", previewMapPoint);
  els.map.addEventListener("pointerleave", () => els.cursor.setAttribute("transform", "translate(-50 -50)"));
  els.map.addEventListener("click", selectMapPoint);
  els.map.addEventListener("keydown", nudgeMapPoint);
  renderEmptyChart();
  updateMap(52.5200, 13.4050);
  loadForecast();
}

function chooseCity() {
  const city = CITIES[Number(els.city.value)];
  if (city.lat === null) return;
  els.latitude.value = city.lat;
  els.longitude.value = city.lon;
  els.title.textContent = city.name;
  updateMap(city.lat, city.lon);
}

function customCoordinates() {
  els.city.value = String(CITIES.length - 1);
  els.title.textContent = "自定义观测点";
  const lat = Number(els.latitude.value);
  const lon = Number(els.longitude.value);
  if (validCoordinates(lat, lon)) updateMap(lat, lon);
}

function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= GERMANY_BOUNDS.minLat && lat <= GERMANY_BOUNDS.maxLat
    && lon >= GERMANY_BOUNDS.minLon && lon <= GERMANY_BOUNDS.maxLon;
}

function updateMap(lat, lon) {
  const { x, y } = projectGermany(lat, lon);
  els.marker.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  els.glow.setAttribute("cx", x.toFixed(1));
  els.glow.setAttribute("cy", y.toFixed(1));
  els.coordinate.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

function projectGermany(lat, lon) {
  const xRatio = (lon - GERMANY_BOUNDS.minLon) / (GERMANY_BOUNDS.maxLon - GERMANY_BOUNDS.minLon);
  const yRatio = (GERMANY_BOUNDS.maxLat - lat) / (GERMANY_BOUNDS.maxLat - GERMANY_BOUNDS.minLat);
  return {
    x: MAP_BOUNDS.left + xRatio * (MAP_BOUNDS.right - MAP_BOUNDS.left),
    y: MAP_BOUNDS.top + yRatio * (MAP_BOUNDS.bottom - MAP_BOUNDS.top)
  };
}

function mapPointFromEvent(event) {
  const point = els.mapSvg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = els.mapSvg.getScreenCTM();
  if (!matrix) return null;
  const local = point.matrixTransform(matrix.inverse());
  if (local.x < MAP_BOUNDS.left || local.x > MAP_BOUNDS.right || local.y < MAP_BOUNDS.top || local.y > MAP_BOUNDS.bottom) return null;
  const xRatio = (local.x - MAP_BOUNDS.left) / (MAP_BOUNDS.right - MAP_BOUNDS.left);
  const yRatio = (local.y - MAP_BOUNDS.top) / (MAP_BOUNDS.bottom - MAP_BOUNDS.top);
  return {
    x: local.x,
    y: local.y,
    lat: GERMANY_BOUNDS.maxLat - yRatio * (GERMANY_BOUNDS.maxLat - GERMANY_BOUNDS.minLat),
    lon: GERMANY_BOUNDS.minLon + xRatio * (GERMANY_BOUNDS.maxLon - GERMANY_BOUNDS.minLon)
  };
}

function previewMapPoint(event) {
  const point = mapPointFromEvent(event);
  if (!point) return;
  els.cursor.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
  els.hoverCoordinate.textContent = `${formatCoordinate(point.lat, true)} · ${formatCoordinate(point.lon, false)}`;
}

function selectMapPoint(event) {
  const point = mapPointFromEvent(event);
  if (!point) return;
  applyMapSelection(point.lat, point.lon, true);
}

function nudgeMapPoint(event) {
  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  let lat = Number(els.latitude.value);
  let lon = Number(els.longitude.value);
  const step = event.shiftKey ? 1 : 0.1;
  if (event.key === "ArrowUp") lat += step;
  if (event.key === "ArrowDown") lat -= step;
  if (event.key === "ArrowLeft") lon -= step;
  if (event.key === "ArrowRight") lon += step;
  lat = Math.max(GERMANY_BOUNDS.minLat, Math.min(GERMANY_BOUNDS.maxLat, lat));
  lon = Math.max(GERMANY_BOUNDS.minLon, Math.min(GERMANY_BOUNDS.maxLon, lon));
  applyMapSelection(lat, lon, false);
}

function applyMapSelection(lat, lon, queryNow) {
  els.latitude.value = lat.toFixed(4);
  els.longitude.value = lon.toFixed(4);
  els.city.value = String(CITIES.length - 1);
  els.title.textContent = "地图选定点";
  updateMap(lat, lon);
  if (queryNow) loadForecast();
}

function formatCoordinate(value, latitude) {
  const direction = latitude ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
  return `${Math.abs(value).toFixed(2)}° ${direction}`;
}

async function loadForecast() {
  const lat = Number(els.latitude.value);
  const lon = Number(els.longitude.value);
  if (!validCoordinates(lat, lon)) return showToast("请输入德国范围内的坐标：纬度 47.1～55.2，经度 5.5～15.5。", true);

  setLoading(true);
  updateMap(lat, lon);
  try {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      hourly: "shortwave_radiation,direct_radiation,diffuse_radiation,cloud_cover",
      daily: "sunrise,sunset,daylight_duration",
      timezone: "auto", forecast_days: "7"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    forecast = await response.json();
    forecast.source = "live";
    populateDates();
    startClock(forecast.utc_offset_seconds || 0);
    renderSelectedDay();
    showToast("已更新未来 7 天照度预测");
  } catch (error) {
    forecast = createOfflineForecast(lat, lon);
    populateDates();
    startClock(Math.round(lon / 15) * 3600);
    renderSelectedDay();
    showToast("天气接口暂不可用，当前显示晴空天文模型估算。", true);
  } finally {
    setLoading(false);
  }
}

function populateDates() {
  const previous = els.date.value;
  els.date.innerHTML = forecast.daily.time.map((date, index) => {
    const d = new Date(`${date}T12:00:00`);
    const label = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(d);
    return `<option value="${index}">${index === 0 ? "今天 · " : ""}${label}</option>`;
  }).join("");
  if ([...els.date.options].some(o => o.value === previous)) els.date.value = previous;
}

function renderSelectedDay() {
  if (!forecast) return;
  const dayIndex = Number(els.date.value) || 0;
  const date = forecast.daily.time[dayIndex];
  const samples = [];
  forecast.hourly.time.forEach((time, i) => {
    if (time.startsWith(date)) {
      const radiation = Math.max(0, forecast.hourly.shortwave_radiation[i] || 0);
      samples.push({
        hour: time.slice(11, 16),
        radiation,
        lux: radiation * 120,
        cloud: forecast.hourly.cloud_cover[i] ?? 0
      });
    }
  });

  const daylightSamples = samples.filter(s => s.radiation > 0);
  const peak = Math.max(...samples.map(s => s.lux), 0);
  const avg = daylightSamples.length ? daylightSamples.reduce((a, b) => a + b.lux, 0) / daylightSamples.length : 0;
  const energy = samples.reduce((sum, s) => sum + s.radiation, 0) / 1000;
  const clouds = samples.reduce((sum, s) => sum + s.cloud, 0) / Math.max(samples.length, 1);
  const sunrise = timeOnly(forecast.daily.sunrise[dayIndex]);
  const sunset = timeOnly(forecast.daily.sunset[dayIndex]);
  const daylightHours = (forecast.daily.daylight_duration[dayIndex] / 3600).toFixed(1);

  els.peak.textContent = (peak / 1000).toFixed(1);
  els.meter.style.width = `${Math.min(100, peak / 120000 * 100)}%`;
  els.sunrise.textContent = sunrise;
  els.sunset.textContent = sunset;
  els.daylight.textContent = daylightHours;
  els.avg.textContent = `${(avg / 1000).toFixed(1)} klx`;
  els.energy.textContent = `${energy.toFixed(1)} kWh/m²`;
  els.cloud.textContent = `${Math.round(clouds)}%`;
  els.status.textContent = forecast.source === "live" ? "实时预测" : "离线晴空估算";
  els.status.style.color = forecast.source === "live" ? "#46b978" : "#b26d13";
  renderChart(samples);
}

function renderChart(samples) {
  if (!samples.length) return renderEmptyChart();
  const W = 1060, H = 270, left = 46, right = 18, top = 18, bottom = 35;
  const innerW = W - left - right, innerH = H - top - bottom;
  const maxLux = Math.max(10000, ...samples.map(s => s.lux));
  const maxRad = Math.max(100, ...samples.map(s => s.radiation));
  const x = i => left + i / (samples.length - 1) * innerW;
  const yLux = v => top + innerH - (v / maxLux) * innerH;
  const yRad = v => top + innerH - (v / maxRad) * innerH;
  const line = samples.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yLux(s.lux).toFixed(1)}`).join(" ");
  const radLine = samples.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yRad(s.radiation).toFixed(1)}`).join(" ");
  const area = `${line} L${x(samples.length - 1)},${top + innerH} L${left},${top + innerH} Z`;
  const yGrid = [0, .25, .5, .75, 1].map(p => {
    const y = top + innerH * (1 - p);
    return `<line class="grid" x1="${left}" y1="${y}" x2="${W-right}" y2="${y}"/><text x="2" y="${y+3}">${(maxLux*p/1000).toFixed(0)}k</text>`;
  }).join("");
  const xLabels = samples.map((s, i) => i % 3 === 0 ? `<text text-anchor="middle" x="${x(i)}" y="${H-8}">${s.hour}</text>` : "").join("");
  const points = samples.map((s, i) => i % 3 === 0 && s.lux > 0 ? `<circle class="point" cx="${x(i)}" cy="${yLux(s.lux)}" r="3"><title>${s.hour} · ${(s.lux/1000).toFixed(1)} klx</title></circle>` : "").join("");

  els.chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="24小时照度曲线">
    <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffd436" stop-opacity=".48"/><stop offset="1" stop-color="#ffd436" stop-opacity=".02"/></linearGradient></defs>
    ${yGrid}<path class="area" d="${area}"/><path class="radiation-line" d="${radLine}"/><path class="line" d="${line}"/>${points}${xLabels}
  </svg>`;
}

function renderEmptyChart() {
  els.chart.innerHTML = '<div class="empty-chart">选择地点后，这里将显示 24 小时照度变化</div>';
}

function createOfflineForecast(lat, lon) {
  const daily = { time: [], sunrise: [], sunset: [], daylight_duration: [] };
  const hourly = { time: [], shortwave_radiation: [], direct_radiation: [], diffuse_radiation: [], cloud_cover: [] };
  for (let day = 0; day < 7; day++) {
    const d = new Date(); d.setDate(d.getDate() + day);
    const date = localISODate(d);
    const doy = dayOfYear(d);
    const declination = 23.44 * Math.sin((2 * Math.PI / 365) * (doy - 81));
    const latRad = lat * Math.PI / 180, decRad = declination * Math.PI / 180;
    const cosH = Math.max(-1, Math.min(1, -Math.tan(latRad) * Math.tan(decRad)));
    const dayLength = 2 * Math.acos(cosH) * 12 / Math.PI;
    const sunrise = 12 - dayLength / 2, sunset = 12 + dayLength / 2;
    daily.time.push(date);
    daily.sunrise.push(`${date}T${decimalTime(sunrise)}`);
    daily.sunset.push(`${date}T${decimalTime(sunset)}`);
    daily.daylight_duration.push(dayLength * 3600);
    for (let hour = 0; hour < 24; hour++) {
      const progress = (hour + .5 - sunrise) / Math.max(dayLength, .1);
      const solarShape = progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) : 0;
      const seasonalPeak = 850 + 130 * Math.cos(latRad - decRad);
      const radiation = Math.max(0, seasonalPeak * Math.pow(solarShape, 1.22));
      hourly.time.push(`${date}T${String(hour).padStart(2, "0")}:00`);
      hourly.shortwave_radiation.push(radiation);
      hourly.direct_radiation.push(radiation * .75);
      hourly.diffuse_radiation.push(radiation * .25);
      hourly.cloud_cover.push(0);
    }
  }
  return { daily, hourly, utc_offset_seconds: Math.round(lon / 15) * 3600, source: "offline" };
}

function useLocation() {
  if (!navigator.geolocation) return showToast("当前浏览器不支持定位。", true);
  els.locate.disabled = true;
  navigator.geolocation.getCurrentPosition(pos => {
    if (!validCoordinates(pos.coords.latitude, pos.coords.longitude)) {
      els.locate.disabled = false;
      showToast("检测到当前位置不在德国范围内，请从德国地图中选择地点。", true);
      return;
    }
    els.latitude.value = pos.coords.latitude.toFixed(4);
    els.longitude.value = pos.coords.longitude.toFixed(4);
    els.city.value = String(CITIES.length - 1);
    els.title.textContent = "我的当前位置";
    els.locate.disabled = false;
    loadForecast();
  }, () => {
    els.locate.disabled = false;
    showToast("无法获取位置，请允许定位或手动输入坐标。", true);
  }, { enableHighAccuracy: false, timeout: 8000 });
}

function startClock(offsetSeconds) {
  clearInterval(clockTimer);
  const tick = () => {
    const local = new Date(Date.now() + offsetSeconds * 1000);
    els.clock.textContent = `${String(local.getUTCHours()).padStart(2,"0")}:${String(local.getUTCMinutes()).padStart(2,"0")}`;
    updateSunPoint(new Date());
  };
  tick(); clockTimer = setInterval(tick, 30000);
}

function updateSunPoint(now) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === "hour")?.value || 0) % 24;
  const minute = Number(parts.find(part => part.type === "minute")?.value || 0);
  const localHours = hour + minute / 60;
  const progress = Math.max(0, Math.min(1, (localHours - 5.5) / 15));
  const x = 105 + progress * 510;
  const y = 135 - Math.sin(progress * Math.PI) * 80;
  const isDayArc = localHours >= 5.5 && localHours <= 20.5;
  els.sunMarker.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  els.sunHalo.setAttribute("cx", x.toFixed(1));
  els.sunHalo.setAttribute("cy", y.toFixed(1));
  els.sunMarker.style.opacity = isDayArc ? "1" : ".25";
  els.sunHalo.style.opacity = isDayArc ? ".76" : ".12";
}

function setLoading(loading) {
  els.query.disabled = loading;
  els.query.querySelector("span").textContent = loading ? "正在计算光照…" : "获取照度预测";
}

function showToast(message, warning = false) {
  els.toast.textContent = message;
  els.toast.style.borderLeft = `4px solid ${warning ? "#ff9a45" : "#ffd436"}`;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3500);
}

function timeOnly(value) { return value ? value.slice(11, 16) : "--:--"; }
function localISODate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
function decimalTime(value) {
  const h = Math.max(0, Math.min(23, Math.floor(value)));
  const m = Math.round((value - Math.floor(value)) * 60);
  return `${String(h + Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
}

init();
