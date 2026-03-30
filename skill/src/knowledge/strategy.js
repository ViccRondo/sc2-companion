/**
 * SC2 策略建议
 */

const STRATEGIES = {
  early: [
    '前期不要all-in，保持经济平衡',
    '侦查很重要！第一个SCV/Baneling/Probe去对手家',
    '前期损失一个农民等于损失30秒发展时间',
    '人口建筑要提前造，不要卡人口'
  ],
  mid: [
    '中期是多线操作的最佳时机',
    '利用机动性单位骚扰对手经济',
    '保持部队移动，不要站着发呆',
    '二矿运转后开始暴兵'
  ],
  late: [
    '后期决战前确保三矿以上',
    '注意升级！攻防等级很重要',
    '保持后勤（医疗、补给）跟上线',
    '决战位置比人数更重要'
  ]
};

function getStrategyAdvice(gamePhase) {
  const tips = STRATEGIES[gamePhase] || STRATEGIES.mid;
  const tip = tips[Math.floor(Math.random() * tips.length)];
  
  return {
    type: 'advice',
    priority: 'low',
    message: tip
  };
}

module.exports = { getStrategyAdvice, STRATEGIES };
