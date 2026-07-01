const {
  BATTERY_PROFILES,
  getJiveMode4Multiplier,
  calculateJiveMode4,
  calculateHeliJiveMode6,
  calculateJivePro,
} = require('../script.js');

describe('getJiveMode4Multiplier', () => {
  test('returns 0.8185 at 60% throttle', () => {
    expect(getJiveMode4Multiplier(60)).toBeCloseTo(0.8185, 4);
  });

  test('returns 0.7732 at 50% throttle (below 60)', () => {
    expect(getJiveMode4Multiplier(50)).toBeCloseTo(0.7732, 4);
  });

  test('returns 0.8692 at 70% throttle (60-80 range)', () => {
    expect(getJiveMode4Multiplier(70)).toBeCloseTo(0.8692, 4);
  });

  test('returns 0.9700 at 90% throttle (above 80)', () => {
    expect(getJiveMode4Multiplier(90)).toBeCloseTo(0.9700, 4);
  });

  test('returns 0.8185 at 60% boundary', () => {
    expect(getJiveMode4Multiplier(60)).toBeCloseTo(0.8185, 4);
  });

  test('returns 0.9199 at 80% boundary', () => {
    expect(getJiveMode4Multiplier(80)).toBeCloseTo(0.9199, 4);
  });
});

describe('BATTERY_PROFILES', () => {
  test('has all expected C-ratings', () => {
    const ratings = Object.keys(BATTERY_PROFILES);
    expect(ratings).toEqual(['20C', '30C', '40C', '50C', '60C', '120C']);
  });

  test('20C profile has correct values', () => {
    const profile = BATTERY_PROFILES['20C'];
    expect(profile.maxCell).toBeCloseTo(4.150, 3);
    expect(profile.minCellLowKv).toBeCloseTo(3.5332, 4);
    expect(profile.minCellHighKv).toBeCloseTo(3.9700, 4);
  });

  test('120C profile has highest voltage values', () => {
    const profile = BATTERY_PROFILES['120C'];
    expect(profile.maxCell).toBeCloseTo(4.200, 3);
    expect(profile.minCellLowKv).toBeCloseTo(3.6500, 4);
    expect(profile.minCellHighKv).toBeCloseTo(4.0500, 4);
  });
});

describe('calculateJiveMode4', () => {
  const profile = BATTERY_PROFILES['20C'];

  test('returns correct structure', () => {
    const result = calculateJiveMode4(6, 890, 8, 77, 0.90, profile);
    expect(result).toHaveProperty('displayVoltage');
    expect(result).toHaveProperty('displayLowestRpm');
    expect(result).toHaveProperty('rpmLabel');
    expect(result).toHaveProperty('throttleData');
    expect(result).toHaveProperty('xMin', 0);
    expect(result).toHaveProperty('xStep', 5);
  });

  test('throttleData has 21 entries (0-100 in steps of 5)', () => {
    const result = calculateJiveMode4(6, 890, 8, 77, 0.90, profile);
    expect(result.throttleData).toHaveLength(21);
  });

  test('first throttle entry is at 0%, last at 100%', () => {
    const result = calculateJiveMode4(6, 890, 8, 77, 0.90, profile);
    expect(result.throttleData[0].throttle).toBe(0);
    expect(result.throttleData[20].throttle).toBe(100);
  });

  test('RPM decreases as throttle decreases', () => {
    const result = calculateJiveMode4(6, 890, 8, 77, 0.90, profile);
    for (let i = 1; i < result.throttleData.length; i++) {
      expect(result.throttleData[i].rpm).toBeGreaterThan(result.throttleData[i - 1].rpm);
    }
  });

  test('displayLowestRpm is the minimum possible RPM using 0.8111 factor', () => {
    const result = calculateJiveMode4(6, 890, 8, 77, 0.90, profile);
    const gearRatio = 77 / 8;
    const maxVoltageBaseline = 6 * profile.maxCell;
    const absoluteMaxRpm = (maxVoltageBaseline * 890 * 0.90) / gearRatio;
    expect(result.displayLowestRpm).toBeCloseTo(absoluteMaxRpm * 0.8111, 1);
  });

  test('RPM values are positive', () => {
    const result = calculateJiveMode4(6, 890, 8, 77, 0.90, profile);
    result.throttleData.forEach(entry => {
      expect(entry.rpm).toBeGreaterThan(0);
    });
  });
});

describe('calculateHeliJiveMode6', () => {
  test('returns correct structure', () => {
    const result = calculateHeliJiveMode6(6, 890, 8, 77);
    expect(result).toHaveProperty('displayVoltage');
    expect(result).toHaveProperty('displayLowestRpm');
    expect(result).toHaveProperty('rpmLabel');
    expect(result).toHaveProperty('throttleData');
    expect(result.throttleData).toHaveLength(21);
  });

  test('displayVoltage uses 3.9416 per cell', () => {
    const result = calculateHeliJiveMode6(6, 890, 8, 77);
    expect(result.displayVoltage).toBeCloseTo(6 * 3.9416, 4);
  });

  test('RPM at 0% throttle is 17% of max', () => {
    const result = calculateHeliJiveMode6(6, 890, 8, 77);
    const gearRatio = 77 / 8;
    const absoluteMaxRpm = (6 * 3.9416 * 890) / gearRatio;
    expect(result.throttleData[0].rpm).toBeCloseTo(absoluteMaxRpm * 0.17, 1);
  });

  test('RPM at 100% throttle is 95.75% of max', () => {
    const result = calculateHeliJiveMode6(6, 890, 8, 77);
    const gearRatio = 77 / 8;
    const absoluteMaxRpm = (6 * 3.9416 * 890) / gearRatio;
    expect(result.throttleData[20].rpm).toBeCloseTo(absoluteMaxRpm * 0.9575, 1);
  });

  test('RPM at 50% throttle is 56.375% of max', () => {
    const result = calculateHeliJiveMode6(6, 890, 8, 77);
    const gearRatio = 77 / 8;
    const absoluteMaxRpm = (6 * 3.9416 * 890) / gearRatio;
    expect(result.throttleData[10].rpm).toBeCloseTo(absoluteMaxRpm * 0.56375, 1);
  });

  test('RPM increases monotonically with throttle', () => {
    const result = calculateHeliJiveMode6(6, 890, 8, 77);
    for (let i = 1; i < result.throttleData.length; i++) {
      expect(result.throttleData[i].rpm).toBeGreaterThan(result.throttleData[i - 1].rpm);
    }
  });
});

describe('calculateJivePro', () => {
  test('returns correct structure', () => {
    const result = calculateJivePro(6, 890, 8, 77);
    expect(result).toHaveProperty('displayVoltage');
    expect(result).toHaveProperty('displayLowestRpm');
    expect(result).toHaveProperty('rpmLabel');
    expect(result).toHaveProperty('throttleData');
    expect(result.throttleData).toHaveLength(21);
  });

  test('displayVoltage uses 4.18 calibration', () => {
    const result = calculateJivePro(6, 890, 8, 77);
    expect(result.displayVoltage).toBeCloseTo(6 * 4.18, 4);
  });

  test('RPM at 90% throttle equals usableGovCeiling', () => {
    const result = calculateJivePro(6, 890, 8, 77);
    const gearRatio = 77 / 8;
    const absoluteLearnedMaxRpm = (6 * 4.18 * 890 * 0.90) / gearRatio;
    const usableGovCeiling = absoluteLearnedMaxRpm * 0.89;
    expect(result.throttleData[18].rpm).toBeCloseTo(usableGovCeiling, 1);
  });

  test('RPM at 0% throttle is 0', () => {
    const result = calculateJivePro(6, 890, 8, 77);
    expect(result.throttleData[0].rpm).toBeCloseTo(0, 1);
  });

  test('RPM at 100% throttle exceeds usable ceiling (throttle/90 extrapolation)', () => {
    const result = calculateJivePro(6, 890, 8, 77);
    const gearRatio = 77 / 8;
    const absoluteLearnedMaxRpm = (6 * 4.18 * 890 * 0.90) / gearRatio;
    const usableGovCeiling = absoluteLearnedMaxRpm * 0.89;
    expect(result.throttleData[20].rpm).toBeGreaterThan(usableGovCeiling);
  });

  test('RPM increases linearly with throttle', () => {
    const result = calculateJivePro(6, 890, 8, 77);
    for (let i = 1; i < result.throttleData.length; i++) {
      expect(result.throttleData[i].rpm).toBeGreaterThan(result.throttleData[i - 1].rpm);
    }
  });
});

describe('calculateJiveMode4 with different battery profiles', () => {
  test('120C profile produces higher RPM than 20C profile at full throttle', () => {
    const lowProfile = BATTERY_PROFILES['20C'];
    const highProfile = BATTERY_PROFILES['120C'];
    const lowResult = calculateJiveMode4(6, 890, 8, 77, 0.90, lowProfile);
    const highResult = calculateJiveMode4(6, 890, 8, 77, 0.90, highProfile);
    expect(highResult.throttleData[20].rpm).toBeGreaterThan(lowResult.throttleData[20].rpm);
  });

  test('higher cell count produces higher RPM', () => {
    const profile = BATTERY_PROFILES['20C'];
    const result6s = calculateJiveMode4(6, 890, 8, 77, 0.90, profile);
    const result12s = calculateJiveMode4(12, 890, 8, 77, 0.90, profile);
    expect(result12s.throttleData[20].rpm).toBeGreaterThan(result6s.throttleData[20].rpm);
  });
});
