import type { AssignmentView } from '../api/agentApi';

export type PickupStep = 'shop' | 'to_hub' | 'done';
export type DeliveryStep = 'hub' | 'en_route' | 'done';

export function pickupStep(status: string): PickupStep {
  if (status === 'ASSIGNED') return 'shop';
  if (status === 'IN_PROGRESS') return 'to_hub';
  return 'done';
}

export function deliveryStep(status: string): DeliveryStep {
  if (status === 'ASSIGNED') return 'hub';
  if (status === 'IN_PROGRESS') return 'en_route';
  return 'done';
}

export function pickupStepLabel(step: PickupStep): string {
  switch (step) {
    case 'shop':
      return 'At shop';
    case 'to_hub':
      return 'To hub';
    case 'done':
      return 'Done';
  }
}

export function deliveryStepLabel(step: DeliveryStep): string {
  switch (step) {
    case 'hub':
      return 'At hub';
    case 'en_route':
      return 'To home';
    case 'done':
      return 'Done';
  }
}

export function pickupHint(step: PickupStep): string {
  switch (step) {
    case 'shop':
      return 'Go to this shop. Take the bag. Then tap the green button.';
    case 'to_hub':
      return 'You have the bag. Take it to the hub. Wait for hub uncle.';
    case 'done':
      return 'Bag reached hub. Good job.';
  }
}

export function deliveryHint(step: DeliveryStep): string {
  switch (step) {
    case 'hub':
      return 'Take the full order from hub. Then go to customer home.';
    case 'en_route':
      return 'Give order to customer. Phone code is 111111 in local/dev.';
    case 'done':
      return 'Delivery done. Good job.';
  }
}

export type OrderPickupGroup = {
  orderId: string;
  orderNumber: string;
  subOrders: AssignmentView[];
};

export function groupPickupsByOrder(tasks: AssignmentView[]): OrderPickupGroup[] {
  const map = new Map<string, OrderPickupGroup>();
  for (const task of tasks) {
    const existing = map.get(task.orderId);
    if (existing) {
      existing.subOrders.push(task);
    } else {
      map.set(task.orderId, {
        orderId: task.orderId,
        orderNumber: task.orderNumber,
        subOrders: [task],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
}

export type AgentWorkSummary = {
  pickupAtShop: number;
  pickupToHub: number;
  deliveryAtHub: number;
  deliveryEnRoute: number;
  totalActive: number;
};

export function summarizeActiveWork(assignments: AssignmentView[]): AgentWorkSummary {
  let pickupAtShop = 0;
  let pickupToHub = 0;
  let deliveryAtHub = 0;
  let deliveryEnRoute = 0;

  for (const a of assignments) {
    if (a.legType === 'PICKUP') {
      if (a.status === 'ASSIGNED') pickupAtShop += 1;
      else if (a.status === 'IN_PROGRESS') pickupToHub += 1;
    } else if (a.legType === 'LAST_MILE') {
      if (a.status === 'ASSIGNED') deliveryAtHub += 1;
      else if (a.status === 'IN_PROGRESS') deliveryEnRoute += 1;
    }
  }

  return {
    pickupAtShop,
    pickupToHub,
    deliveryAtHub,
    deliveryEnRoute,
    totalActive: pickupAtShop + pickupToHub + deliveryAtHub + deliveryEnRoute,
  };
}
