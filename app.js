const CITIES = [
  { name: "中国 · 上海", lat: 31.2304, lon: 121.4737 },
  { name: "中国 · 北京", lat: 39.9042, lon: 116.4074 },
  { name: "日本 · 东京", lat: 35.6762, lon: 139.6503 },
  { name: "新加坡 · 新加坡", lat: 1.3521, lon: 103.8198 },
  { name: "澳大利亚 · 悉尼", lat: -33.8688, lon: 151.2093 },
  { name: "阿联酋 · 迪拜", lat: 25.2048, lon: 55.2708 },
  { name: "埃及 · 开罗", lat: 30.0444, lon: 31.2357 },
  { name: "肯尼亚 · 内罗毕", lat: -1.2921, lon: 36.8219 },
  { name: "法国 · 巴黎", lat: 48.8566, lon: 2.3522 },
  { name: "英国 · 伦敦", lat: 51.5074, lon: -0.1278 },
  { name: "冰岛 · 雷克雅未克", lat: 64.1466, lon: -21.9426 },
  { name: "美国 · 纽约", lat: 40.7128, lon: -74.0060 },
  { name: "美国 · 洛杉矶", lat: 34.0522, lon: -118.2437 },
  { name: "墨西哥 · 墨西哥城", lat: 19.4326, lon: -99.1332 },
  { name: "巴西 · 里约热内卢", lat: -22.9068, lon: -43.1729 },
  { name: "阿根廷 · 布宜诺斯艾利斯", lat: -34.6037, lon: -58.3816 },
  { name: "自定义坐标", lat: null, lon: null }
];

const $ = (id) => document.getElementById(id);
const els = {
  city: $("citySelect"), latitude: $("latitude"), longitude: $("longitude"),
  date: $("dateSelect"), locate: $("locateBtn"), query: $("queryBtn"),
  title: $("locationTitle"), clock: $("localClock"), marker: $("mapMarker"), glow: $("mapGlow"),
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
  renderEmptyChart();
  updateMap(31.2304, 121.4737);
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
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function updateMap(lat, lon) {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 460;
  els.marker.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  els.glow.setAttribute("cx", x.toFixed(1));
  els.glow.setAttribute("cy", y.toFixed(1));
  els.coordinate.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

async function loadForecast() {
  const lat = Number(els.latitude.value);
  const lon = Number(els.longitude.value);
  if (!validCoordinates(lat, lon)) return showToast("请输入有效经纬度：纬度 -90～90，经度 -180～180。", true);

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
  els.status.style.color = forecast.source === "live" ? "#728f1e" : "#b26d13";
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
    <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d8ff63" stop-opacity=".58"/><stop offset="1" stop-color="#d8ff63" stop-opacity=".02"/></linearGradient></defs>
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
  };
  tick(); clockTimer = setInterval(tick, 30000);
}

function setLoading(loading) {
  els.query.disabled = loading;
  els.query.querySelector("span").textContent = loading ? "正在计算光照…" : "获取照度预测";
}

function showToast(message, warning = false) {
  els.toast.textContent = message;
  els.toast.style.borderLeft = `4px solid ${warning ? "#ff9a45" : "#d8ff63"}`;
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
