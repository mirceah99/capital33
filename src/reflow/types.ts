export enum DocType {
  SettlementTask = 'settlementTask',
  SettlementChannel = 'settlementChannel',
  TradeOrder = 'tradeOrder',
}
export enum TaskType {
  MarginCheck = 'marginCheck',
  FundTransfer = 'fundTransfer',
  Disbursement = 'disbursement',
  ComplianceScreen = 'complianceScreen',
  Reconciliation = 'reconciliation',
  RegulatoryHold = 'regulatoryHold',
}
export type OperatingHours = OperetingHour[]
export type OperetingHour = {
    dayOfWeek: number; // 0–6, Sunday = 0
    startHour: number; // 0–23
    endHour: number; // 0–23
}
export type BlackoutWindows = BlackoutWindow[]
export type BlackoutWindow = {
    startDate: string; // ISO 8601
    endDate: string; // ISO 8601
    reason?: string
}
export enum TimeIntervalType {
  Task = 'task', // task in progres
  Blackout = 'blackout', // maintenance 
  FreeSlot = 'freeSlot', // free to be booked by task
  Close = 'close', // closed
}
export type TimeInterval = { starDate: string, endDate: string, taskId: string | null, type: TimeIntervalType }
export type TimeIntervals = TimeInterval[]
export type BaseDocument = {
    docId: string,
    docType: DocType
}

export type SettlementTask = BaseDocument &
{
    data: {
        taskReference: string,
        tradeOrderId: string, // Parent trade order reference  
        settlementChannelId: string
        startDate: string | null,
        endDate: string | null,
        durationMinutes: number,
        isRegulatoryHold: boolean,
        dependsOnTaskIds: string[]
        taskType: TaskType
    }
}

export type SettlementChannel = BaseDocument &
{
    data: {
        name: string;
        operatingHours: OperatingHours,
        blackoutWindows: BlackoutWindows,
        intervals: TimeIntervals // IMHO improvement from the orignal data type, end date shoud be <= start deate to the next element
    }
}

export type TradeOrder = BaseDocument & {
    data: {
        tradeOrderNumber: string; // e.g., "TRD-20240115-042"
        instrumentId: string; // Security or asset identifier
        quantity: number;
        settlementDate: string; // ISO 8601
    }
}