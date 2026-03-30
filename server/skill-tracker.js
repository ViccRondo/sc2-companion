/**
 * SC2 游戏状态追踪器
 */

// 知识库
const KNOWLEDGE = {
  timing: require('../skill/src/knowledge/timing'),
  units: require('../skill/src/knowledge/units'),
  strategy: require('../skill/src/knowledge/strategy')
};

class SC2StateTracker {
  constructor() {
    this.lastResources = { minerals: 0, vespene: 0 };
    this.lastFood = { used: 0, cap: 0 };
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
      const timingAdvice = KNOWLEDGE.timing.getAdvice(gameTime);
      if (timingAdvice) {
        advices.push({
          refId: `ref_${++this.refIdCounter}`,
          ...timingAdvice
        });
      }
    }

    // 兵种检测
    if (units && units.enemy) {
      const newEnemyUnits = this.detectNewEnemyUnits(unemyUnits);
      if (newEnemyUnits.length > 0) {
        const counterAdvice = KNOWLEDGE.units.getCounterAdvice(newEnemyUnits);
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
