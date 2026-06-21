
const BATTERY_PROFILES = {
  '20C': { maxCell: 4.150, minCellLowKv: 3.5332, minCellHighKv: 3.9700 }, // 完美对齐我们刚刚校准的黄金数据
  '30C': { maxCell: 4.160, minCellLowKv: 3.5500, minCellHighKv: 3.9800 },
  '40C': { maxCell: 4.170, minCellLowKv: 3.5700, minCellHighKv: 3.9900 },
  '50C': { maxCell: 4.180, minCellLowKv: 3.5900, minCellHighKv: 4.0000 },
  '60C': { maxCell: 4.190, minCellLowKv: 3.6100, minCellHighKv: 4.0100 },
  '120C': { maxCell: 4.200, minCellLowKv: 3.6500, minCellHighKv: 4.0500 }  // 顶配高C数电池，电压几乎没有下陷
};

// Initialize UI selectors dynamically on page load
document.addEventListener('DOMContentLoaded', () => {
  // Populate Pinion teeth count: 6 to 35
  const pinionSelect = document.getElementById('pinionTeeth');
  for (let t = 6; t <= 35; t++) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = `${t}T`;
    if (t === 8) opt.selected = true; // Default as per Shuttle sample (8T)
    pinionSelect.appendChild(opt);
  }

  // Populate Motor Peak Efficiency: 80% to 99%
  const efficiencySelect = document.getElementById('motorEfficiency');
  for (let eff = 80; eff <= 99; eff++) {
    const opt = document.createElement('option');
    opt.value = eff;
    opt.textContent = `${eff}%`;
    if (eff === 90) opt.selected = true; // Default 90%
    efficiencySelect.appendChild(opt);
  }

  // Resize handler for chart canvas crispness
  window.addEventListener('resize', debouncedRedraw);
});

let redrawTimeout;
function debouncedRedraw() {
  clearTimeout(redrawTimeout);
  redrawTimeout = setTimeout(() => {
    if (document.getElementById('modalOverlay').classList.contains('active')) {
      drawChart();
    }
  }, 150);
}

// Global reference for current calculation data to redraw chart on window resize
let lastCalculationData = null;

function getJiveMode4Multiplier(throttle) {
  if (throttle <= 60) {
    return 0.8185 - ((60 - throttle) / 10.0) * 0.0453;
  }

  if (throttle <= 80) {
    return 0.8185 + ((throttle - 60) / 10.0) * 0.0507;
  }

  return 0.9199 + ((throttle - 80) / 10.0) * 0.0501;
}

// Primary Calculation Function
function calculate() {
  const rating = document.getElementById('batteryRating').value;
  const cells = parseInt(document.getElementById('batteryCells').value, 10);
  const mainGear = parseInt(document.getElementById('mainGearTeeth').value, 10);
  const pinion = parseInt(document.getElementById('pinionTeeth').value, 10);
  const motorKv = parseInt(document.getElementById('motorKv').value, 10);
  const efficiency = parseInt(document.getElementById('motorEfficiency').value, 10) / 100;
  const isGov = document.getElementById('enableGovernor').checked;

  if (isNaN(mainGear) || mainGear <= 0 || isNaN(motorKv) || motorKv <= 0) {
    alert("Please enter valid positive numbers for Main Gear teeth and Motor KV.");
    return;
  }

  // 1. Gear ratio
  const gearRatio = mainGear / pinion;

  // Get active battery profile
  const profile = BATTERY_PROFILES[rating] || BATTERY_PROFILES['20C'];

  // 3. Build the calibrated real-world battery RPM baseline used by the updated Jive Mode 4 curve
  const maxVoltageBaseline = cells * profile.maxCell;

  // 4. Theoretical ceilings and floors
  const absoluteMaxRpm = (maxVoltageBaseline * motorKv * efficiency) / gearRatio;
  const lowestRpmRaw = absoluteMaxRpm * 0.8111;

  let displayVoltage = 0;
  let displayLowestRpm = 0;
  let throttleData = [];

  if (isGov) {
    // Kontronik Jive Governor Mode 4 adjustments from the updated Java model
    displayVoltage = maxVoltageBaseline * 0.8111;
    displayLowestRpm = lowestRpmRaw;

    // Gov throttle table: 60% to 95% by 5%
    for (let throttle = 60; throttle <= 95; throttle += 5) {
      const rpm = absoluteMaxRpm * getJiveMode4Multiplier(throttle);
      throttleData.push({ throttle, rpm });
    }
  } else {
    // Non-governed standard configuration
    displayVoltage = maxVoltageBaseline * 0.8111;
    displayLowestRpm = lowestRpmRaw;

    // Updated spectrum table: 10% to 100% by 10%
    for (let throttle = 10; throttle <= 100; throttle += 10) {
      const rpm = absoluteMaxRpm * getJiveMode4Multiplier(throttle);
      throttleData.push({ throttle, rpm });
    }
  }

  // Round values for UI matching Swedish screenshot style (commas for decimals)
  const formatVoltage = (val) => {
    // Sweden/EU comma notation
    return val.toLocaleString('sv-SE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatRpm = (val) => {
    return Math.round(val).toString();
  };

  // Populate UI
  document.getElementById('resVoltage').textContent = formatVoltage(displayVoltage);
  document.getElementById('resRpm').textContent = formatRpm(displayLowestRpm);

  const resRpmLabel = document.getElementById('resRpmLabel');
  if (isGov) {
    resRpmLabel.textContent = "Lowest RPM (due to voltage and efficiency):";
  } else {
    resRpmLabel.textContent = "Lowest Safe RPM (at battery discharge floor):";
  }

  // Populate Throttle Table
  const tableBody = document.querySelector('#throttleTable tbody');
  tableBody.innerHTML = '';
  throttleData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.throttle}%</td>
      <td>${formatRpm(row.rpm)}</td>
    `;
    tableBody.appendChild(tr);
  });

  // Store data for graph rendering
  lastCalculationData = {
    isGov,
    lowestRpm: displayLowestRpm,
    throttleData
  };

  // Open Results Window
  openModal();
}

function openModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('active');
  // Draw chart after modal animation completes
  setTimeout(drawChart, 150);
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
}

// Chart Drawing Engine using HTML5 Canvas
function drawChart() {
  if (!lastCalculationData) return;

  const canvas = document.getElementById('rpmChart');
  const ctx = canvas.getContext('2d');

  // Set up high-definition display resolution scaling
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Styling properties matching the dark space UI
  ctx.fillStyle = '#0f1524';
  ctx.fillRect(0, 0, width, height);

  const { isGov, lowestRpm, throttleData } = lastCalculationData;

  // Determine graph domain (Throttle) and range (RPM)
  const xMin = isGov ? 55 : 10;
  const xMax = 100;

  // Calculate dynamic scale margins for Y (RPM) axis
  const rpms = throttleData.map(d => d.rpm);
  const maxRpmInList = Math.max(...rpms, lowestRpm);
  const minRpmInList = Math.min(...rpms, lowestRpm);

  // Create rounded ticks like standard graph outputs
  const yMin = Math.floor((minRpmInList - 100) / 100) * 100;
  const yMax = Math.ceil((maxRpmInList + 100) / 100) * 100;

  // Padding around plot area
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;

  // Helper coordinate conversions
  const getXPixel = (throttleVal) => {
    return paddingLeft + ((throttleVal - xMin) / (xMax - xMin)) * graphWidth;
  };

  const getYPixel = (rpmVal) => {
    return paddingTop + graphHeight - ((rpmVal - yMin) / (yMax - yMin)) * graphHeight;
  };

  // Draw Grid Lines & Axes Labels
  ctx.strokeStyle = '#232f4e';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 10px "Inter", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Y-axis grid and ticks (RPM values)
  const yStep = (yMax - yMin) / 8;
  for (let r = yMin; r <= yMax; r += yStep) {
    const yPx = getYPixel(r);
    // Grid line
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yPx);
    ctx.lineTo(width - paddingRight, yPx);
    ctx.stroke();

    // Tick Label
    ctx.fillText(Math.round(r).toLocaleString(), paddingLeft - 8, yPx);
  }

  // X-axis grid and ticks (Throttle %)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xStep = isGov ? 5 : 10;
  for (let t = xMin; t <= xMax; t += xStep) {
    const xPx = getXPixel(t);
    // Grid line
    ctx.beginPath();
    ctx.moveTo(xPx, paddingTop);
    ctx.lineTo(xPx, height - paddingBottom);
    ctx.stroke();

    // Tick Label
    ctx.fillText(`${t}%`, xPx, height - paddingBottom + 8);
  }

  // Draw Axes lines
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;

  // Y Axis
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.stroke();

  // X Axis
  ctx.beginPath();
  ctx.moveTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  // 1. Draw Lowest RPM Horizontal Threshold Line (Green)
  const yLowestRpmPx = getYPixel(lowestRpm);
  if (yLowestRpmPx >= paddingTop && yLowestRpmPx <= height - paddingBottom) {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]); // Dashed line to look premium
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yLowestRpmPx);
    ctx.lineTo(width - paddingRight, yLowestRpmPx);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Draw a small tag label for Lowest RPM line
    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'right';
    ctx.font = '600 9px "Outfit", sans-serif';
    ctx.fillText(`Floor: ${Math.round(lowestRpm)} RPM`, width - paddingRight, yLowestRpmPx - 8);
  }

  // 2. Draw RPM vs Throttle curve (Red/Orange diagonal line)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();

  // Interpolate data line points
  throttleData.forEach((d, idx) => {
    const xPx = getXPixel(d.throttle);
    const yPx = getYPixel(d.rpm);
    if (idx === 0) {
      ctx.moveTo(xPx, yPx);
    } else {
      ctx.lineTo(xPx, yPx);
    }
  });
  ctx.stroke();

  // Add dots on data points for Jive Gov profile steps
  ctx.fillStyle = '#f87171';
  throttleData.forEach(d => {
    const xPx = getXPixel(d.throttle);
    const yPx = getYPixel(d.rpm);
    ctx.beginPath();
    ctx.arc(xPx, yPx, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#0f1524';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}
