"use strict";

const authPanel = document.querySelector("#auth-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const logoutButton = document.querySelector("#logout-button");
const authMessage = document.querySelector("#auth-message");
const config = window.SAFEWATCH_CONFIG;

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function setAuthenticated(isAuthenticated) {
  authPanel.hidden = isAuthenticated;
  dashboard.hidden = !isAuthenticated;
  logoutButton.hidden = !isAuthenticated;
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDataTimestamp(value) {
  if (!value) return "Giờ: Chưa có dữ liệu cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Giờ: Chưa có dữ liệu cập nhật";
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const dateText = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date).replace(/\//g, " - ");
  return `Giờ: ${time} · ${dateText}`;
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function displayConnection(value, lastUpdated) {
  const state = String(value || "").toLowerCase();
  if (state === "offline" || state === "disconnected") {
    return { label: "Mất kết nối", status: "offline" };
  }
  if (state === "weak") return { label: "Kết nối yếu", status: "warning" };
  if (state === "good" || state === "online" || state === "connected") {
    const updatedAt = lastUpdated ? new Date(lastUpdated).getTime() : Number.NaN;
    if (!Number.isFinite(updatedAt)) {
      return { label: "Chưa rõ trạng thái", status: "warning" };
    }
    if (Date.now() - updatedAt > 180_000) {
      return { label: "Mất kết nối (dữ liệu cũ)", status: "offline" };
    }
    return { label: "Đã kết nối", status: "online" };
  }
  return { label: "Chưa rõ trạng thái", status: "warning" };
}

function makeChart(values) {
  if (!values.length) {
    document.querySelector("#chart-line").setAttribute("d", "");
    document.querySelector("#chart-area").setAttribute("d", "");
    document.querySelector("#chart-point").setAttribute("r", "0");
    document.querySelector("#sparkline-path").setAttribute("d", "");
    return;
  }

  const points = values.map((value, index) => {
    const x = values.length < 2 ? 350 : (index / (values.length - 1)) * 700;
    const y = 160 - ((Math.max(60, Math.min(120, value)) - 60) / 60) * 135;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  document.querySelector("#chart-line").setAttribute("d", line);
  document.querySelector("#chart-area").setAttribute(
    "d",
    `${line} L${points[points.length - 1][0].toFixed(1)} 175 L${points[0][0].toFixed(1)} 175 Z`,
  );
  const [lastX, lastY] = points[points.length - 1];
  const point = document.querySelector("#chart-point");
  point.setAttribute("cx", lastX.toFixed(1));
  point.setAttribute("cy", lastY.toFixed(1));
  point.setAttribute("r", "4");

  const sparklinePoints = values.map((value, index) => {
    const x = values.length < 2 ? 85 : (index / (values.length - 1)) * 170;
    const y = 34 - ((Math.max(60, Math.min(120, value)) - 60) / 60) * 30;
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  document.querySelector("#sparkline-path").setAttribute("d", sparklinePoints.join(" "));
}

function renderAlerts(alerts) {
  const list = document.querySelector("#alerts-list");
  list.replaceChildren();
  const visibleAlerts = alerts.slice(0, 3);

  if (!visibleAlerts.length) {
    const empty = document.createElement("p");
    empty.className = "empty-alerts";
    empty.textContent = "Chưa có cảnh báo trong hệ thống.";
    list.append(empty);
    return;
  }

  for (const alert of visibleAlerts) {
    const row = document.createElement("div");
    row.className = "alert-row";

    const symbol = document.createElement("div");
    symbol.className = "alert-symbol";
    const symbolIcon = document.createElement("i");
    symbolIcon.className = `bi ${alert.isUrgent ? "bi-exclamation-triangle-fill" : "bi-info-circle-fill"}`;
    symbolIcon.setAttribute("aria-hidden", "true");
    symbol.append(symbolIcon);

    const copy = document.createElement("div");
    copy.className = "alert-copy";
    const title = document.createElement("strong");
    title.textContent = alert.message || alert.type || "Cảnh báo";
    const description = document.createElement("span");
    description.textContent = `${alert.type || "Sự kiện"} · ${alert.status || "Không rõ trạng thái"}`;
    copy.append(title, description);

    const type = document.createElement("span");
    type.className = "alert-type";
    type.textContent = String(alert.severity || "THÔNG TIN").toUpperCase();

    const time = document.createElement("time");
    time.dateTime = alert.eventAt || "";
    time.textContent = formatTime(alert.eventAt);
    row.append(symbol, copy, type, time);
    list.append(row);
  }
}

function renderDashboard(payload) {
  const patient = payload.user || {};
  const device = payload.device || {};
  const history = Array.isArray(payload.heartRateHistory) ? payload.heartRateHistory : [];
  const alerts = Array.isArray(payload.alertHistory) ? payload.alertHistory : [];
  const readings = history
    .map((reading) => asNumber(reading.heartRate))
    .filter((value) => value !== null);
  const currentHeartRate = asNumber(device.heartRate);
  const historyHeartRate = readings.length ? readings[readings.length - 1] : null;
  const displayedHeartRate = currentHeartRate === null ? historyHeartRate : currentHeartRate;

  document.querySelector("#patient-name").textContent = patient.fullName || "Chưa có tên";
  const deviceName = device.name || `Đồng hồ của ${patient.fullName || "bệnh nhân"}`;
  document.querySelector(".patient-avatar").textContent =
    (patient.fullName || "S").trim().charAt(0).toLocaleUpperCase("vi-VN");
  document.querySelector("#header-device-name").textContent = deviceName;
  document.querySelector("#device-name").textContent = deviceName;
  document.querySelector("#patient-status").lastChild.textContent =
    patient.monitoringStatus === "active" ? "Đang theo dõi" : "Theo dõi tạm dừng";
  const connection = displayConnection(device.connectionStatus, device.lastUpdated);
  const connectionLabel = document.querySelector("#connection-status");
  connectionLabel.textContent = connection.label;
  connectionLabel.className = `connection-state is-${connection.status}`;
  document.querySelector("#battery").textContent =
    asNumber(device.battery) === null ? "—" : `${asNumber(device.battery)}%`;
  const batteryLevel = asNumber(device.battery);
  document.querySelector("#battery-level").style.width =
    `${Math.max(0, Math.min(100, batteryLevel === null ? 0 : batteryLevel))}%`;
  document.querySelector("#monitoring-status").textContent =
    patient.monitoringStatus === "active" ? "Đang bật" : "Đang tắt";
  const oxygenSaturation = asNumber(device.spo2);
  document.querySelector("#spo2").textContent =
    oxygenSaturation === null ? "—" : String(oxygenSaturation);
  document.querySelector("#spo2-status").textContent =
    oxygenSaturation === null ? "Chưa có dữ liệu SpO₂" : "Chỉ số gần nhất từ thiết bị";
  document.querySelector("#spo2-progress").style.width =
    `${Math.max(0, Math.min(100, oxygenSaturation === null ? 0 : oxygenSaturation))}%`;

  const heartRateText = displayedHeartRate === null ? "—" : String(displayedHeartRate);
  document.querySelector("#heart-rate").textContent = heartRateText;
  document.querySelector("#chart-heart-rate").textContent = heartRateText;
  document.querySelector("#heart-rate-status").textContent =
    displayedHeartRate === null
      ? "Chưa có dữ liệu nhịp tim"
      : displayedHeartRate >= 60 && displayedHeartRate <= 100
        ? "Trong ngưỡng tham khảo"
        : "Ngoài ngưỡng tham khảo";
  document.querySelector("#chart-range").lastChild.textContent =
    displayedHeartRate === null ? "Chưa có dữ liệu" : "Ngưỡng tham khảo 60–100 bpm";
  makeChart(readings);

  const recentFalls = alerts.filter((alert) => {
    const isFall = String(alert.type || "").toLowerCase().replace(/_/g, "") === "fall";
    const time = new Date(alert.eventAt).getTime();
    return isFall &&
      Number.isFinite(time) &&
      time <= Date.now() &&
      Date.now() - time <= 24 * 60 * 60 * 1000;
  }).length;
  document.querySelector("#alert-count").textContent = String(Math.min(alerts.length, 3));
  const reportedFallCount = asNumber(payload.recentFallCount);
  document.querySelector("#fall-count").textContent =
    String(reportedFallCount === null ? recentFalls : reportedFallCount);
  document.querySelector("#fall-status").textContent = device.fallStatus
    ? `Trạng thái thiết bị: ${device.fallStatus}`
    : recentFalls
      ? "Có cảnh báo té ngã trong 24 giờ"
      : "Không có cảnh báo té ngã trong 24 giờ";

  const latitude = asNumber(device.latitude);
  const longitude = asNumber(device.longitude);
  const hasLocation =
    latitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude !== null &&
    longitude >= -180 &&
    longitude <= 180;
  const locationStatus = document.querySelector("#location-status");
  const locationCoordinates = document.querySelector("#location-coordinates");
  const mapLink = document.querySelector("#map-link");
  const mapContainer = document.querySelector("#map-container");
  const mapNode = document.querySelector("#satellite-map");
  if (hasLocation) {
    locationStatus.lastChild.textContent = "Có tọa độ GPS";
    locationStatus.classList.remove("no-location");
    locationCoordinates.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    document.querySelector("#location-updated").textContent =
      `Cập nhật: ${formatDateTime(device.locationUpdatedAt || device.lastUpdated)}`;
    satelliteMap?.remove();
    mapContainer.classList.add("has-gps");
    mapLink.href = `https://www.google.com/maps?q=${latitude},${longitude}&t=k`;
    mapLink.hidden = false;
    if (window.L) {
      mapNode.hidden = false;
      satelliteMap = window.L.map(mapNode).setView([latitude, longitude], 16);
      window.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
        },
      ).addTo(satelliteMap);
      window.L.marker([latitude, longitude]).addTo(satelliteMap)
        .bindPopup("Vị trí thiết bị").openPopup();
    } else {
      mapNode.hidden = true;
      document.querySelector("#location-updated").textContent =
        "Không tải được thư viện bản đồ vệ tinh. Hãy kiểm tra kết nối Internet.";
    }
  } else {
    locationStatus.lastChild.textContent = "Chưa có GPS";
    locationStatus.classList.add("no-location");
    locationCoordinates.textContent = "Thiết bị chưa gửi tọa độ";
    document.querySelector("#location-updated").textContent = "Bản đồ phía trên chỉ là minh họa; chưa có GPS trong database";
    satelliteMap?.remove();
    satelliteMap = undefined;
    mapNode.hidden = true;
    mapContainer.classList.remove("has-gps");
    mapLink.hidden = true;
  }

  document.querySelector("#current-datetime").textContent = formatDataTimestamp(
    payload.latestTelemetryAt || device.lastUpdated,
  );
  renderAlerts(alerts);
}

let client;
let dashboardLoad;
let satelliteMap;

async function loadDashboard() {
  if (dashboardLoad) return dashboardLoad;
  dashboardLoad = (async () => {
    showMessage("Đang tải dữ liệu được cấp quyền…");
    const { data, error } = await client.rpc("get_sw0002_dashboard");
    if (error) throw new Error(error.message || "Không thể tải dữ liệu thiết bị.");
    if (!data) throw new Error("Không tìm thấy thiết bị trong database.");
    if (!data.device) throw new Error("Hồ sơ chưa được gắn với thiết bị cần theo dõi.");
    renderDashboard(data);
    setAuthenticated(true);
    showMessage("Đã tải dữ liệu từ Supabase.");
  })()
    .catch((error) => {
      setAuthenticated(false);
      logoutButton.hidden = false;
      showMessage(error.message || "Không thể kết nối Supabase.", true);
    })
    .finally(() => {
      dashboardLoad = undefined;
    });
  return dashboardLoad;
}

if (
  !config ||
  !config.url ||
  !config.publishableKey ||
  !window.supabase ||
  !window.supabase.createClient
) {
  showMessage("Thiếu cấu hình Supabase. Kiểm tra config.js và tải thư viện Supabase JS.", true);
  loginButton.disabled = true;
} else {
  client = window.supabase.createClient(config.url, config.publishableKey);

  client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      if (session) {
        logoutButton.hidden = false;
        void loadDashboard();
      } else {
        setAuthenticated(false);
        showMessage("Đăng nhập để xem dữ liệu thiết bị.");
      }
    }, 0);
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginButton.disabled = true;
    showMessage("Đang xác thực tài khoản…");
    try {
      const formData = new FormData(loginForm);
      const { error } = await client.auth.signInWithPassword({
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || ""),
      });
      if (error) {
        showMessage(error.message || "Đăng nhập thất bại.", true);
        return;
      }
      await loadDashboard();
    } catch (error) {
      showMessage(error.message || "Không thể kết nối Supabase.", true);
    } finally {
      loginButton.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) showMessage(error.message || "Không thể đăng xuất.", true);
    } catch (error) {
      showMessage(error.message || "Không thể đăng xuất.", true);
    } finally {
      logoutButton.disabled = false;
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      showMessage(error.message || "Không thể khôi phục phiên đăng nhập.", true);
      return;
    }
    if (data.session) void loadDashboard();
  }).catch((error) => {
    showMessage(error.message || "Không thể khôi phục phiên đăng nhập.", true);
  });

  window.setInterval(() => {
    if (!dashboard.hidden) void loadDashboard();
  }, 60_000);
}
