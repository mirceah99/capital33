import { DocType, SettlementChannel, SettlementTask, TaskType, TradeOrder } from "../src/reflow/types";

export const settlementChannels: SettlementChannel[] = [{
    docId: "channel-compliance",
    docType: DocType.SettlementChannel,
    data: {
        name: "Compliance Desk",
        operatingHours: [
            {
                dayOfWeek: 0, // 0–6, Sunday = 0
                startHour: 8, // 0-23
                endHour: 17
            }
        ],
        blackoutWindows: [{ startDate: "2026-09-13T08:00:00.000Z", endDate: "2026-09-13T10:00:00.000Z" },
        { startDate: "2026-09-20T14:00:00.000Z", endDate: "2026-09-20T17:00:00.000Z" }
        ],
        intervals: []
    }
},
{
    docId: "channel-wire",
    docType: DocType.SettlementChannel,
    data: {
        name: "Domestic Wire Desk",
        operatingHours: [
            {
                dayOfWeek: 1,
                startHour: 8,
                endHour: 16
            }
        ],
        blackoutWindows: [{ startDate: "2026-08-31T08:00:00.000Z", endDate: "2026-09-07T16:00:00.000Z" }],
        intervals: []
    }
},
{
    docId: "channel-reconciliation",
    docType: DocType.SettlementChannel,
    data: {
        name: "Reconciliation Desk",
        operatingHours: [
            {
                dayOfWeek: 2,
                startHour: 8,
                endHour: 18
            }
        ],
        blackoutWindows: [
            { startDate: "2026-09-15T14:00:00.000Z", endDate: "2026-09-15T16:00:00.000Z" },
            { startDate: "2026-09-08T14:00:00.000Z", endDate: "2026-09-08T18:00:00.000Z" }
        ],
        intervals: []
    }
}]

export const settlementTasks: SettlementTask[] = [
    {
        docId: "task-isRegulatoryHold",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-isRegulatoryHold",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-compliance",

            startDate: "2026-09-13T10:00:00.000Z",
            endDate: "2026-09-13T12:00:00.000Z",
            durationMinutes: 120,

            isRegulatoryHold: true,
            dependsOnTaskIds: [],

            taskType: TaskType.MarginCheck
        }
    },
    {
        docId: "task-a",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-A",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-compliance",

            startDate: null,
            endDate: null,
            durationMinutes: 60,

            isRegulatoryHold: false,
            dependsOnTaskIds: [],

            taskType: TaskType.MarginCheck
        }
    },

    {
        docId: "task-b",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-B",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-wire",

            startDate: null,
            endDate: null,
            durationMinutes: 120,

            isRegulatoryHold: false,

            // Cannot start until task-a finishes
            dependsOnTaskIds: ["task-a"],

            taskType: TaskType.FundTransfer
        }
    },

    {
        docId: "task-c",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-C",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-compliance",

            startDate: null,
            endDate: null,
            durationMinutes: 60,

            isRegulatoryHold: false,

            // Also waits for task-a
            dependsOnTaskIds: ["task-a"],

            taskType: TaskType.ComplianceScreen
        }
    },

    {
        docId: "task-d",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-D",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-reconciliation",

            startDate: null,
            endDate: null,
            durationMinutes: 60,

            isRegulatoryHold: false,

            // Must wait for both fund transfer AND compliance
            dependsOnTaskIds: ["task-b", "task-c"],

            taskType: TaskType.Reconciliation
        }
    },
    {
        docId: "task-e",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-E",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-reconciliation",

            startDate: null,
            endDate: null,
            durationMinutes: 12 * 60,

            isRegulatoryHold: false,

            dependsOnTaskIds: [],

            taskType: TaskType.Reconciliation
        }
    },
    {
        docId: "task-f",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-f",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-wire",

            startDate: null,
            endDate: null,
            durationMinutes: 60,

            isRegulatoryHold: false,

            dependsOnTaskIds: ["task-h"],

            taskType: TaskType.FundTransfer
        }
    },
    {
        docId: "task-h",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-h",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-wire",

            startDate: null,
            endDate: null,
            durationMinutes: 60,

            isRegulatoryHold: false,

            dependsOnTaskIds: ["task-i"],

            taskType: TaskType.FundTransfer
        }
    },
    {
        docId: "task-i",
        docType: DocType.SettlementTask,
        data: {
            taskReference: "STL-001-i",
            tradeOrderId: "order-1",
            settlementChannelId: "channel-wire",

            startDate: null,
            endDate: null,
            durationMinutes: 60,

            isRegulatoryHold: false,

            dependsOnTaskIds: [],

            taskType: TaskType.FundTransfer
        }
    },

];

export const tradeOrders: TradeOrder[] = [
    {
        docId: "order-1",
        docType: DocType.TradeOrder,
        data: {
            tradeOrderNumber: "TRD-001",
            instrumentId: "BOND-ABC",
            quantity: 1000,

            // Target date/time by which this trade should be settled
            settlementDate: "2026-09-08T16:00:00Z"
        }
    }
];