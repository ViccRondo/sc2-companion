/**
 * SC2 游戏状态追踪器
 */

// 内联知识库（避免路径问题）
const KNOWLEDGE = {
  timing: require('./timing'),
  units: require('./units'),
  strategy: require('./strategy')
};

// 简化版 timing 知识库
const TIMINGS = [
  { time: 60, advice: '1分钟了，确保第一个建筑正在建造' },
  { time: 120, advice: '2分钟，检查是否有12个SCV在采矿' },
  { time: 180, advice: '3分钟，应该有气矿开始采集了' },
  { time: 240, advice: '4分钟关键timing，准备或应对4分钟压制' },
  { time: 300, advice: '5分钟开矿窗口到了！要么开矿要么压制对手开矿' },
  { time: 360, advice: '6分钟，二基地应该运作了' },
  { time: 420, advice: '7分钟，准备中期部队或科技' },
  { time: 480, advice: '8分钟攻防窗口！注意对手动向' },
  { time: 540, advice: '9分钟，中期决战可能即将到来' },
  { time: 600, advice: '10分钟大龙窗口！人族可以死神骚扰' }
];

// 兵种克制
const COUNTERS = {
  'Marine': ['Marauder', 'Tank'],
  'Zergling': ['Marauder', 'Hellbat'],
  'Roach': ['Marauder', 'Tank'],
  'Hydralisk': ['Marauder', 'Viking'],
  'Mutalisk': ['Viking', 'Phoenix'],
  'Zealot': ['Marauder', 'Hellbat'],
  'Stalker': ['Marauder', 'Marine'],
  'Immortal': ['Marauder', 'Tank'],
  'Colossus': ['Marauder', 'Viking'],
  'VoidRay': ['Marine', 'Marauder']
};

function getTimingAdvice(gameTimeSeconds) {
  const current = TIMINGS.find(t => 
    gameTimeSeconds >= t.time && gameTimeSeconds < t.time + 30
  );
  
  if (current) {
    return { type: 'timing', priority: 'medium', message: current.advice };
  }
  return null;
}

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

class SC2StateTracker {
  constructor() {
    this.seenEnemyUnits = new Set();
    this.idleStartTime = null;
    this.lastAdviceTime = 0;
    this.adviceCooldown = 5000; // 5秒冷却
    this.refIdCounter = 0;
  }

  reset() {
    this.seenEnemyUnits.clear();
    this.idleStartTime = null;
    this.lastAdviceTime = 0;
    console.log('[Tracker] 状态已重置');
  }

  analyzeEvent(state) {
    const advices = [];

    // 冷却检查
    if (Date.now() - this.lastAdviceTime < this.adviceCooldown) {
      return advices;
    }

    const { resources, foodUsed, foodCap, event, units, gameTime } = state;

    // 资源溢出检测
    if (resources) {
      if (resources.minerals > 1000) {
        advices.push({
          refId: `ref_${++this.refIdCounter}`,
          type: 'alert',
          priority: 'high',
          message: `资源溢出！矿有${resources.minerals}，建议建造更多建筑或开矿`
        });
      }
      if (resources.vespene > 500) {
        advices.push({
          refId: `ref_${++this.refIdCounter}`,
          type: 'alert',
          priority: 'high',
          message: `气矿溢出！气有${resources.vespene}，记得采集或使用`
        });
      }

      // 人口检测
      if (foodUsed >= foodCap) {
        advices.push({
          refId: `ref_${++this.refIdCounter}`,
          type: 'alert',
          priority: 'urgent',
          message: '人口满了！立即补充人口'
        });
      } else if (foodUsed >= foodCap - 5) {
        advices.push({
          refId: `ref_${++this.refIdCounter}`,
          type: 'alert',
          priority: 'medium',
          message: `人口即将满了（${foodUsed}/${foodCap}），准备补人口`
        });
      }
    }

    // idle检测
    if (event === 'idle' && !this.idleStartTime) {
      this.idleStartTime = Date.now();
    } else if (event !== 'idle') {
      this.idleStartTime = null;
    }
    if (this.idleStartTime && Date.now() - this.idleStartTime > 10000) {
      advices.push({
        refId: `ref_${++this.refIdCounter}`,
        type: 'alert',
        priority: 'medium',
        message: '建造队列空闲超过10秒！不要卡人口'
      });
    }

    // timing检测
    if (gameTime) {
      const timingAdvice = getTimingAdvice(gameTime);
      if (timingAdvice) {
        advices.push({
          refId: `ref_${++this.refIdCounter}`,
          ...timingAdvice
        });
      }
    }

    // 兵种检测
    if (units && units.enemy) {
      const newEnemyUnits = this.detectNewEnemyUnits(units.enemy);
      if (newEnemyUnits.length > 0) {
        const counterAdvice = getCounterAdvice(newEnemyUnits);
        if (counterAdvice) {
          advices.push({
            refId: `ref_${++this.refIdCounter}`,
            ...counterAdvice
          });
        }
      }
    }

    if (advices.length > 0) {
      this.lastAdviceTime = Date.now();
    }

    return advices;
  }

  detectNewEnemyUnits(enemyUnits) {
    const newUnits = [];
    if (!enemyUnits) return newUnits;

    for (const unit of enemyUnits) {
      const unitType = unit.type || unit.name || unit;
      if (!this.seenEnemyUnits.has(unitType)) {
        this.seenEnemyUnits.add(unitType);
        newUnits.push(unitType);
      }
    }
    return newUnits;
  }
}

module.exports = { SC2StateTracker };
