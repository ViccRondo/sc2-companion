/**
 * SC2 关键 Timing 窗口
 */

const TIMINGS = [
  {
    time: 60, // 1分钟
    race: 'all',
    advice: '1分钟了，确保第一个建筑正在建造'
  },
  {
    time: 120, // 2分钟
    race: 'terran',
    advice: '2分钟，检查是否有12个SCV在采矿'
  },
  {
    time: 180, // 3分钟
    race: 'all',
    advice: '3分钟，应该有气矿开始采集了'
  },
  {
    time: 240, // 4分钟
    race: 'all',
    advice: '4分钟关键timing，准备或应对4分钟压制'
  },
  {
    time: 300, // 5分钟
    race: 'all',
    advice: '5分钟开矿窗口到了！要么开矿要么压制对手开矿'
  },
  {
    time: 360, // 6分钟
    race: 'all',
    advice: '6分钟，二基地应该运作了'
  },
  {
    time: 420, // 7分钟
    race: 'all',
    advice: '7分钟，准备中期部队或科技'
  },
  {
    time: 480, // 8分钟
    race: 'all',
    advice: '8分钟攻防窗口！注意对手动向'
  },
  {
    time: 540, // 9分钟
    race: 'all',
    advice: '9分钟，中期决战可能即将到来'
  },
  {
    time: 600, // 10分钟
    race: 'all',
    advice: '10分钟大龙窗口！人族可以死神骚扰'
  }
];

function getAdvice(gameTimeSeconds) {
  // 找到最近的一个 timing 点
  const current = TIMINGS.find(t => 
    gameTimeSeconds >= t.time && gameTimeSeconds < t.time + 30
  );
  
  if (current) {
    return {
      type: 'timing',
      priority: 'medium',
      message: current.advice
    };
  }
  
  return null;
}

module.exports = { getAdvice };
