/**
 * SC2 兵种克制关系
 */

const COUNTERS = {
  // 地面单位克制
  'Marine': ['Zergling', 'Baneling', 'Hydralisk'],
  'Marauder': ['Immortal', 'Roch'],
  'Tank': ['Zergling', 'Baneling'],
  'Thor': ['Bio', 'Muta'],
  'Hellion': ['Zergling'],
  'Hellbat': ['Zergling', 'Marine'],
  
  // 空中单位克制
  'Viking': ['Corruptor', 'Phoenix', 'VoidRay'],
  'Banshee': ['Marine', 'Marauder'],
  'Raven': ['Ultralisk', 'BroodLord'],
  'Battlecruiser': ['Viking', 'Thor'],
  
  // Zerg 克制
  'Zergling': ['Marauder', 'Hellbat'],
  'Baneling': ['Marauder', 'Tank'],
  'Roach': ['Marauder', 'Tank'],
  'Hydralisk': ['Marauder', 'Viking'],
  'Mutalisk': ['Viking', 'Phoenix'],
  'Ultralisk': ['Marauder', 'Tank', 'Thors'],
  'BroodLord': ['Viking', 'Corruptor'],
  
  // Protoss 克制
  'Zealot': ['Marauder', 'Hellbat'],
  'Stalker': ['Marauder', 'Marine'],
  'Sentry': ['Zergling', 'Marine'],
  'Immortal': ['Marauder', 'Tank'],
  'Colossus': ['Marauder', 'Viking'],
  'HighTemplar': ['Zergling', 'Marine'],
  'VoidRay': ['Marine', 'Marauder'],
  'Phoenix': ['Mutalisk', 'Medivac'],
  'Carrier': ['Viking', 'Corruptor'],
  'Mothership': ['Viking', 'Yamato']
};

function getCounterAdvice(enemyUnitTypes) {
  const counters = [];
  
  for (const enemy of enemyUnitTypes) {
    const myUnits = COUNTERS[enemy];
    if (myUnits && myUnits.length > 0) {
      counters.push(`${enemy}怕${myUnits.join('或')}`);
    }
  }
  
  if (counters.length > 0) {
    return {
      type: 'advice',
      priority: 'medium',
      message: `对手单位：${enemyUnitTypes.join(',')}。${counters.join('，')}`
    };
  }
  
  return null;
}

module.exports = { getCounterAdvice, COUNTERS };
