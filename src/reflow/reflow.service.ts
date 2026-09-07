import { BlackoutWindowToTimeInterval, initiateOperatingHourInIntervals as initiateOperatingHourInIntervals, insertInterval as insertInterval } from "../utils/date-utils";
import { SettlementChannel, SettlementTask, TimeInterval, TimeIntervals, TimeIntervalType, TradeOrder } from "./types";
import { DateTime } from 'luxon';

export class ReflowService {
    reflow(settlementTasks: SettlementTask[], settlementChannels: SettlementChannel[], tradeOrders: TradeOrder[]) {

        // first I'll create the axes of time for all the channels
        // I do not really know a time interval, how long to do the axes, so start date will be Monday of the current week, and end date today + 28 days, I can change this later or caclcualte a maximum timeline @upgrade
        for (const channel of settlementChannels) {
            initiateOperatingHourInIntervals(channel)
        }

        // now let's add the breaks
        for (const channel of settlementChannels) {
            for (const blackoutWindow of channel.data.blackoutWindows) {
                insertInterval(BlackoutWindowToTimeInterval(blackoutWindow), channel.data.intervals)
            }
        }

        //first resolve isRegulatoryHold to avoid the cases when a normal task takes a regulatory hold slot 
        settlementTasks.sort(
            (a, b) => Number(b.data.isRegulatoryHold) - Number(a.data.isRegulatoryHold)
        );


        // we need to resolve the task based of dependencies
        let unsolvedTasks = settlementTasks.length
        const taskAlreadyResolved: Record<string, boolean> = {}
        while (unsolvedTasks) {
            let anyTaskResolvedInThisLoop = false
            for (const task of settlementTasks) {
                if (taskAlreadyResolved[task.docId]) {
                    continue
                }
                const { allDependenciesResolved: allDependenciesResolved, resolveAfterDate: resolveAfterDate } = this.checkTaskDependencies(task, settlementTasks)
                if (!allDependenciesResolved) continue

                const channel = settlementChannels.find(c => c.docId === task.data.settlementChannelId)
                if (!channel) throw `Channel ${task.data.settlementChannelId} not found! `
                this.resolveTask(task, channel, resolveAfterDate)

                taskAlreadyResolved[task.docId] = true
                anyTaskResolvedInThisLoop = true
                unsolvedTasks--;
                // I think this also prevent from loop task dependency a depends b and b on a 

            }
            if (!anyTaskResolvedInThisLoop) throw 'Can not find a solution!'
        }

        //logging
        for (const channel of settlementChannels) {
            let i = 0
            console.log(channel.data.name)
            console.log(channel.data.operatingHours)
            console.log(channel.data.blackoutWindows)
            for (const interval of channel.data.intervals) {
                console.log(`${interval.starDate} - ${interval.type}${interval.taskId ? ` - ${interval.taskId}` : ""} - ${interval.endDate}  [${i++}]`)
            }
        }

    }

    resolveTask(settlementTask: SettlementTask, settlementChannel: SettlementChannel, afterDate?: string | null, beforeDate?: string) {
        if (settlementTask.data.isRegulatoryHold) {
            if (settlementTask.data.startDate === null || settlementTask.data.endDate === null) {
                throw "For regulatory hold start date and end date is mandatory"
            }
            insertInterval({
                starDate: settlementTask.data.startDate,
                endDate: settlementTask.data.endDate,
                taskId: settlementTask.docId,
                type: TimeIntervalType.Task
            }, settlementChannel.data.intervals)
            return
        }

        const nextHourIso = DateTime.utc()
            .startOf('hour')
            .plus({ hours: 1 })
            .toUTC().toISO();
        const startingWith = (afterDate
            ? DateTime.max(
                DateTime.fromISO(afterDate),
                DateTime.fromISO(nextHourIso)
            ).toUTC().toISO()
            : nextHourIso)!;

        const availableIntervals = settlementChannel.data.intervals.filter(interval => {
            if (interval.type !== TimeIntervalType.FreeSlot) return false
            if (DateTime.fromISO(interval.endDate).toMillis() <= DateTime.fromISO(startingWith).toMillis()) return false;
            return true
        })
        let numberOfMinutesLeft = settlementTask.data.durationMinutes;
        let intervalsBookedByTheTask: TimeIntervals = []

        for (let interval of availableIntervals) {

            const startDateForThisInterval = DateTime.max(
                DateTime.fromISO(interval.starDate).toUTC(),
                DateTime.fromISO(startingWith).toUTC()
            ).toUTC().toISO()!;
            const availableMinutesInInterval = DateTime
                .fromISO(interval.endDate)
                .diff(
                    DateTime.fromISO(startDateForThisInterval),
                    'minutes'
                )
                .minutes;
            const numberOfMinutestToBook = Math.min(availableMinutesInInterval, numberOfMinutesLeft);
            const intervalToPush: TimeInterval = {
                starDate: startDateForThisInterval,
                endDate: DateTime
                    .fromISO(startDateForThisInterval)
                    .plus({ minutes: numberOfMinutestToBook })
                    .toUTC().toISO()!,
                taskId: settlementTask.docId,
                type: TimeIntervalType.Task
            };
            intervalsBookedByTheTask.push(intervalToPush)
            numberOfMinutesLeft -= numberOfMinutestToBook
            if (numberOfMinutesLeft === 0) break
        }
        if (numberOfMinutesLeft !== 0) throw `Task ${settlementTask.docId} can note be resolved (numberOfMinutesLeft: ${numberOfMinutesLeft})!`

        for (const interval of intervalsBookedByTheTask) {
            insertInterval(interval, settlementChannel.data.intervals)
        }
        settlementTask.data.startDate = intervalsBookedByTheTask[0].starDate
        settlementTask.data.endDate = intervalsBookedByTheTask[intervalsBookedByTheTask.length - 1].endDate
    }

    checkTaskDependencies(task: SettlementTask, allTasks: SettlementTask[]): { allDependenciesResolved: boolean, resolveAfterDate: string | null } {
        if (task.data.dependsOnTaskIds.length === 0) return { allDependenciesResolved: true, resolveAfterDate: null }
        let lstDependentDate: string | null = null
        for (const taskId of task.data.dependsOnTaskIds) {
            const depTask = allTasks.find(t => t.docId === taskId)
            if (!depTask) throw `Task dependency ${taskId} not found!`
            // if end date is not set it means parent task is not resolved
            if (!depTask.data.endDate) return { allDependenciesResolved: false, resolveAfterDate: null }
            if (lstDependentDate === null) { lstDependentDate = depTask.data.endDate }
            else {
                lstDependentDate = DateTime.max(
                    DateTime.fromISO(lstDependentDate),
                    DateTime.fromISO(depTask.data.endDate)
                ).toUTC().toISO()
            }
        }
        return { allDependenciesResolved: true, resolveAfterDate: lstDependentDate }
    }
}