export const GAME = {
  mapHalf: 240,
  playerSpeed: 14,
  sprintSpeed: 18,
  botSpeed: 8,
  maxHp: 100,
  magSize: 30,
  reloadMs: 1500,
  fireDelayMs: 120,
  botCount: 29,
  bulletDamage: 28,
  botDamage: 8,
  botFireMinMs: 620,
  botFireMaxMs: 1050,
  zoneStart: 232,
  zoneEnd: 30,
  zoneShrinkSeconds: 300,
  zoneDamagePerSecond: 9,
  spawnProtectionSeconds: 4
};

export const WEAPONS = {
  AR4:  { id:'AR4',  name:'AR-4',  ammoType:'5.56', mag:30, damage:27, fireDelay:105, reloadMs:1450, range:150 },
  AR7:  { id:'AR7',  name:'AR-7',  ammoType:'5.56', mag:30, damage:32, fireDelay:125, reloadMs:1550, range:155 },
  SMG9: { id:'SMG9', name:'SMG-9', ammoType:'9mm',  mag:35, damage:20, fireDelay:72,  reloadMs:1250, range:95  },
  DMR5: { id:'DMR5', name:'DMR-5', ammoType:'5.56', mag:20, damage:43, fireDelay:235, reloadMs:1700, range:190 },
  LMG5: { id:'LMG5', name:'LMG-5', ammoType:'5.56', mag:45, damage:25, fireDelay:92,  reloadMs:2150, range:145 }
};

export const CAR_CONFIG = {
  maxSpeed: 31,
  reverseSpeed: 12,
  acceleration: 21,
  turnRate: 1.55
};

export const LOOT_CONFIG = {
  weaponCount: 30,
  ammoCount: 42,
  bandageCount: 16,
  armorCount: 10
};
