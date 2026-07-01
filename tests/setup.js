// Set up minimal DOM required before script.js loads
document.body.innerHTML = `
  <select id="batteryRating">
    <option value="20C">20C</option>
  </select>
  <select id="batteryCells">
    <option value="6">6S</option>
  </select>
  <input type="number" id="mainGearTeeth" value="77">
  <select id="pinionTeeth"></select>
  <input type="number" id="motorKv" value="890">
  <select id="motorEfficiency"></select>
  <select id="governorMode">
    <option value="mode4">Mode 4</option>
  </select>
  <div id="resVoltage"></div>
  <div id="resRpm"></div>
  <div id="resRpmLabel"></div>
  <table id="throttleTable"><tbody></tbody></table>
  <div id="modalOverlay"></div>
  <canvas id="rpmChart"></canvas>
`;
