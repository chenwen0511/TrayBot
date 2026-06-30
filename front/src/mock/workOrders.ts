import { MOCK_WORK_ORDER } from './workflow'
import type { WorkOrder } from '../types'

export const initialWorkOrders: WorkOrder[] = [
  {
    id: 'WO-20260628-012',
    totalTrays: 20,
    deliveredTrays: 20,
    pickup: '取料货架 A-03',
    delivery: '送料货架 B-07',
    status: 'completed',
  },
  {
    id: 'WO-20260628-008',
    totalTrays: 35,
    deliveredTrays: 35,
    pickup: '取料货架 A-02',
    delivery: '送料货架 B-05',
    status: 'completed',
  },
  {
    id: MOCK_WORK_ORDER.id,
    totalTrays: MOCK_WORK_ORDER.totalTrays,
    deliveredTrays: 0,
    pickup: MOCK_WORK_ORDER.pickup,
    delivery: MOCK_WORK_ORDER.delivery,
    status: 'in_progress',
  },
  {
    id: 'WO-20260629-002',
    totalTrays: 20,
    deliveredTrays: 0,
    pickup: '取料货架 A-05',
    delivery: '送料货架 B-02',
    status: 'pending',
  },
  {
    id: 'WO-20260629-003',
    totalTrays: 40,
    deliveredTrays: 0,
    pickup: '取料货架 A-01',
    delivery: '送料货架 B-09',
    status: 'pending',
  },
]
