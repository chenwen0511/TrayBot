import type { LiveEvent } from '../types'

export const MOCK_WORK_ORDER = {
  id: 'WO-20260629-001',
  totalTrays: 35,
  backpackCapacity: 20,
  pickup: '取料货架 A-03',
  delivery: '送料货架 B-07',
}

export interface WorkflowStep {
  event: Omit<LiveEvent, 'id' | 'timestamp'>
  map: { at?: string; move?: { from: string; to: string } }
  backpackTrays?: number
}

function pickSubSteps(trayIdx: number, withRetry: boolean): WorkflowStep[] {
  const slot = `A-03-L3-S${trayIdx % 3 + 1}`
  const steps: WorkflowStep[] = [
    {
      event: {
        type: 'pick_perceive',
        title: '感知并计算抓取位姿',
        description: `扫描货架层位，计算第 ${trayIdx} 盘抓取位姿 ${slot}`,
      },
      map: { at: 'pickup' },
    },
    {
      event: {
        type: 'pick_validate',
        title: '预想位姿校验',
        description: '碰撞检测通过，夹爪可达，预抓取姿态安全',
      },
      map: { at: 'pickup' },
    },
    {
      event: {
        type: 'pick_execute',
        title: '执行抓取',
        description: '夹爪闭合，提升料盘',
      },
      map: { at: 'pickup' },
    },
  ]
  if (withRetry) {
    steps.push(
      {
        event: {
          type: 'pick_in_hand',
          title: '在手检测未通过',
          description: '夹爪力矩异常，料盘可能滑落，准备重试',
        },
        map: { at: 'pickup' },
      },
      {
        event: {
          type: 'pick_retry',
          title: '抓取重试',
          description: '释放并重新定位，开始第 2 次抓取',
        },
        map: { at: 'pickup' },
      },
      {
        event: {
          type: 'pick_perceive',
          title: '感知并计算抓取位姿',
          description: `扫描货架层位，计算第 ${trayIdx} 盘抓取位姿 ${slot}`,
        },
        map: { at: 'pickup' },
      },
      {
        event: {
          type: 'pick_validate',
          title: '预想位姿校验',
          description: '碰撞检测通过，夹爪可达，预抓取姿态安全',
        },
        map: { at: 'pickup' },
      },
      {
        event: {
          type: 'pick_execute',
          title: '执行抓取',
          description: '夹爪闭合，提升料盘（第 2 次尝试）',
        },
        map: { at: 'pickup' },
      },
    )
  }
  steps.push(
    {
      event: {
        type: 'pick_in_hand',
        title: '在手检测通过',
        description: '力矩与视觉确认料盘稳定夹持',
      },
      map: { at: 'pickup' },
    },
    {
      event: {
        type: 'grab_success',
        title: '抓取成功',
        description: '单盘抓取完成，准备放入背包',
      },
      map: { at: 'pickup' },
    },
  )
  return steps
}

function placeSubSteps(slotIdx: number, withRetry: boolean): WorkflowStep[] {
  const slot = `B-07-L2-S${slotIdx % 4 + 1}`
  const steps: WorkflowStep[] = [
    {
      event: {
        type: 'place_perceive',
        title: '感知并计算放置位姿',
        description: `检测空位，计算第 ${slotIdx} 盘放置位姿 ${slot}`,
      },
      map: { at: 'delivery' },
    },
    {
      event: {
        type: 'place_validate',
        title: '预想位姿校验',
        description: '放置路径无碰撞，料盘与槽位对齐',
      },
      map: { at: 'delivery' },
    },
    {
      event: {
        type: 'place_execute',
        title: '执行放置',
        description: '夹爪下降并释放料盘',
      },
      map: { at: 'delivery' },
    },
  ]
  if (withRetry) {
    steps.push(
      {
        event: {
          type: 'place_verify',
          title: '放置检测未通过',
          description: '视觉复检偏移 3.2mm，超出阈值，准备重试',
        },
        map: { at: 'delivery' },
      },
      {
        event: {
          type: 'place_retry',
          title: '放置重试',
          description: '重新夹持并校准，开始第 2 次放置',
        },
        map: { at: 'delivery' },
      },
      {
        event: {
          type: 'place_perceive',
          title: '感知并计算放置位姿',
          description: `检测空位，计算第 ${slotIdx} 盘放置位姿 ${slot}`,
        },
        map: { at: 'delivery' },
      },
      {
        event: {
          type: 'place_validate',
          title: '预想位姿校验',
          description: '放置路径无碰撞，料盘与槽位对齐',
        },
        map: { at: 'delivery' },
      },
      {
        event: {
          type: 'place_execute',
          title: '执行放置',
          description: '夹爪下降并释放料盘（第 2 次尝试）',
        },
        map: { at: 'delivery' },
      },
    )
  }
  steps.push({
    event: {
      type: 'place_verify',
      title: '放置检测通过',
      description: '视觉确认料盘已正确入槽',
    },
    map: { at: 'delivery' },
  })
  return steps
}

export function buildWorkflow(
  totalTrays = MOCK_WORK_ORDER.totalTrays,
  capacity = MOCK_WORK_ORDER.backpackCapacity,
): WorkflowStep[] {
  const steps: WorkflowStep[] = []
  let delivered = 0
  let batch = 0

  while (delivered < totalTrays) {
    batch += 1
    const remaining = totalTrays - delivered
    const tripSize = Math.min(capacity, remaining)
    const navFrom = batch === 1 ? 'home' : 'delivery'

    if (batch === 1) {
      steps.push({
        event: {
          type: 'order_received',
          title: '收到上料工单',
          description: `工单 ${MOCK_WORK_ORDER.id}：需送 ${totalTrays} 盘，背包容量 ${capacity} 盘`,
          thinking:
            `收到工单 ${MOCK_WORK_ORDER.id}：需送 ${totalTrays} 盘，取料点 ${MOCK_WORK_ORDER.pickup}，送料点 ${MOCK_WORK_ORDER.delivery}。\n` +
            `自检：电量 78%（阈值 20%），通过；夹爪/关节温度正常；背包容量 ${capacity} 盘，预计 ${Math.ceil(totalTrays / capacity)} 趟。\n` +
            '决策：电量与自检均满足，开始执行。',
        },
        map: { at: 'home' },
      })
    }

    steps.push({
      event: {
        type: 'nav_to_pickup',
        title: batch === 1 ? '导航前往取料货架' : '继续前往取料货架',
        description:
          batch === 1
            ? `目标：${MOCK_WORK_ORDER.pickup}，工单共需 ${totalTrays} 盘`
            : `目标：${MOCK_WORK_ORDER.pickup}，背包空，剩余工单 ${remaining} 盘`,
        activeRoute: batch === 1 ? 'home-pickup' : 'delivery-pickup',
      },
      map: { move: { from: navFrom, to: 'pickup' } },
    })

    steps.push({
      event: {
        type: 'arrived_pickup',
        title: '抵达取料货架',
        description: `已到达 ${MOCK_WORK_ORDER.pickup}，开始逐盘抓取`,
      },
      map: { at: 'pickup' },
    })

    for (let i = 0; i < tripSize; i += 1) {
      const trayIdx = delivered + i + 1
      const withRetry = batch === 1 && i === 0
      steps.push(...pickSubSteps(trayIdx, withRetry))
      const backpackCount = i + 1
      steps.push({
        event: {
          type: 'put_backpack',
          title: '已放入背包',
          description: `单盘入包，背包现有 ${backpackCount}/${capacity} 盘`,
        },
        map: { at: 'pickup' },
        backpackTrays: backpackCount,
      })
    }

    steps.push({
      event: {
        type: 'nav_to_delivery',
        title: '导航前往送料货架',
        description: `目标：${MOCK_WORK_ORDER.delivery}，运送 ${tripSize} 盘`,
        activeRoute: 'pickup-delivery',
      },
      map: { move: { from: 'pickup', to: 'delivery' } },
    })

    steps.push({
      event: {
        type: 'arrived_delivery',
        title: '抵达送料货架',
        description: `已到达 ${MOCK_WORK_ORDER.delivery}，开始逐盘放置`,
      },
      map: { at: 'delivery' },
    })

    for (let i = 0; i < tripSize; i += 1) {
      const slotIdx = delivered + i + 1
      const backpackBefore = tripSize - i
      const backpackAfter = backpackBefore - 1
      steps.push({
        event: {
          type: 'taking_out',
          title: '从背包取出料盘',
          description: `取出 1 盘，背包剩余 ${backpackAfter}/${capacity} 盘`,
        },
        map: { at: 'delivery' },
        backpackTrays: backpackAfter,
      })
      const withRetry = batch === 1 && i === 0
      steps.push(...placeSubSteps(slotIdx, withRetry))
      delivered += 1
      steps.push({
        event: {
          type: 'put_shelf_success',
          title: '放入货架成功',
          description: `单盘放置完成，累计 ${delivered}/${totalTrays} 盘`,
        },
        map: { at: 'delivery' },
        backpackTrays: backpackAfter,
      })
    }

    const stillNeed = totalTrays - delivered
    if (stillNeed > 0) {
      steps.push({
        event: {
          type: 'batch_decision',
          title: '决策：继续取料',
          description: `还差 ${stillNeed} 盘，前往取料货架`,
          thinking:
            `工单进度：已送 ${delivered}/${totalTrays} 盘，剩余 ${stillNeed} 盘。\n` +
            '背包已清空，电量 76%，自检正常。\n' +
            `决策：${stillNeed} 盘尚未完成，返回 ${MOCK_WORK_ORDER.pickup} 继续取料。`,
        },
        map: { at: 'delivery' },
      })
    } else {
      steps.push({
        event: {
          type: 'batch_decision',
          title: '决策：返回 HOME',
          description: `工单 ${totalTrays} 盘全部送达完成`,
          thinking:
            `工单 ${MOCK_WORK_ORDER.id} 已全部完成：累计送达 ${delivered}/${totalTrays} 盘。\n` +
            '任务队列无待执行工单，电量 74% 足够返航。\n' +
            '决策：返回 HOME 待命。',
        },
        map: { at: 'delivery' },
      })
      steps.push({
        event: {
          type: 'return_home',
          title: '返回 HOME',
          description: '工单完成，机器人返回 HOME 待命',
          activeRoute: 'delivery-home',
        },
        map: { move: { from: 'delivery', to: 'home' } },
        backpackTrays: 0,
      })
    }
  }

  return steps
}

export const workflowSteps = buildWorkflow()
