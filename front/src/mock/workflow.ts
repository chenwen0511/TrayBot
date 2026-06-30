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
    const batchSize = Math.min(capacity, remaining)
    const navFrom = batch === 1 ? 'home' : 'delivery'

    if (batch === 1) {
      steps.push({
        event: {
          type: 'order_received',
          title: '收到上料工单',
          description: `工单 ${MOCK_WORK_ORDER.id}：需送 ${totalTrays} 盘，背包容量 ${capacity} 盘/次`,
          thinking:
            `解析工单：总量 ${totalTrays} 盘，source=${MOCK_WORK_ORDER.pickup}，target=${MOCK_WORK_ORDER.delivery}。` +
            `背包容量 ${capacity} 盘，预计需 ${Math.ceil(totalTrays / capacity)} 批次完成。` +
            `当前位于 HOME，电量 78%，状态空闲，可接单。`,
        },
        map: { at: 'home' },
      })
    }

    steps.push({
      event: {
        type: 'nav_to_pickup',
        title: batch === 1 ? '正在从 HOME 出发前往取料货架' : '继续前往取料货架',
        description: `目标：${MOCK_WORK_ORDER.pickup}，本轮取 ${batchSize} 盘（剩余 ${remaining} 盘）`,
      },
      map: { move: { from: navFrom, to: 'pickup' } },
    })

    steps.push({
      event: {
        type: 'arrived_pickup',
        title: '抵达取料货架',
        description: `已到达 ${MOCK_WORK_ORDER.pickup}，开始定位目标托盘`,
        ...(batch === 1
          ? {
              thinking:
                '定位误差 2.1cm，在允许范围内。扫描货架层位：第 3 层检测到 2 个托盘候选。比对工单物料编码，锁定目标位 A-03-L3-S2。',
            }
          : {}),
      },
      map: { at: 'pickup' },
    })

    steps.push({
      event: {
        type: 'target_locked',
        title: '目标盘已锁定',
        description: `视觉识别确认目标托盘，本轮需取 ${batchSize} 盘`,
      },
      map: { at: 'pickup' },
    })

    steps.push({
      event: {
        type: 'grab_success',
        title: '抓取成功',
        description: `夹爪抓取完成，本轮 ${batchSize} 盘已稳定`,
      },
      map: { at: 'pickup' },
    })

    steps.push({
      event: {
        type: 'put_backpack',
        title: '已放入背包',
        description: `${batchSize} 盘已装入背包（${batchSize}/${capacity}）`,
      },
      map: { at: 'pickup' },
    })

    steps.push({
      event: {
        type: 'nav_to_delivery',
        title: '正在转场',
        description: `目标：${MOCK_WORK_ORDER.delivery}，运送 ${batchSize} 盘`,
      },
      map: { move: { from: 'pickup', to: 'delivery' } },
    })

    steps.push({
      event: {
        type: 'arrived_delivery',
        title: '抵达送料货架',
        description: `已到达 ${MOCK_WORK_ORDER.delivery}，准备放料`,
      },
      map: { at: 'delivery' },
    })

    steps.push({
      event: {
        type: 'taking_out',
        title: '正在取出',
        description: `从背包取出 ${batchSize} 盘，准备放入货架`,
      },
      map: { at: 'delivery' },
    })

    delivered += batchSize

    steps.push({
      event: {
        type: 'put_shelf_success',
        title: '放入货架成功',
        description: `本轮送达 ${batchSize} 盘，累计 ${delivered}/${totalTrays} 盘`,
      },
      map: { at: 'delivery' },
    })

    const stillNeed = totalTrays - delivered

    if (stillNeed > 0) {
      steps.push({
        event: {
          type: 'batch_decision',
          title: '决策：继续取料',
          description: `工单需 ${totalTrays} 盘，已送 ${delivered} 盘，还差 ${stillNeed} 盘`,
          thinking:
            `工单总量 ${totalTrays} 盘，背包容量 ${capacity} 盘/次。` +
            `本轮已送 ${batchSize} 盘，累计 ${delivered}/${totalTrays}，剩余 ${stillNeed} 盘。` +
            `${stillNeed} ≤ ${capacity}，无需回 HOME 充电或待命，直接从送料点前往取料货架继续下一批次。` +
            `决策：前往 ${MOCK_WORK_ORDER.pickup}。`,
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
            `累计送达 ${delivered}/${totalTrays} 盘，工单已完成。` +
            `查询任务队列：无其他待执行工单。电量 74%，足够返回 HOME。` +
            `决策：从 ${MOCK_WORK_ORDER.delivery} 返回 HOME 待命。`,
        },
        map: { at: 'delivery' },
      })

      steps.push({
        event: {
          type: 'return_home',
          title: '没有任务，机器人返回 HOME',
          description: '任务队列空，自动返回 HOME 待命',
        },
        map: { move: { from: 'delivery', to: 'home' } },
      })
    }
  }

  return steps
}

/** 预生成完整流程（35 盘 / 容量 20 → 2 批次） */
export const workflowSteps = buildWorkflow()
