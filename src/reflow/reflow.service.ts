import { BlackoutWindowToTimeInterval, initiateOperetingHourInIntervals, inserInterval } from "../utils/date-utils";
import { SettlementChannel, SettlementTask, TimeInterval, TimeIntervals, TimeIntervalType, TradeOrder } from "./types";
import { DateTime } from 'luxon';

export class ReflowService {
    reflow(settlementTasks: SettlementTask[], settlementChannels: SettlementChannel[], tradeOrders: TradeOrder[]) {

        // first I'll create the axex of time for all the cahnnels
        // I do not really know a time interval, how long to do the axes, so start date will be Monday of the curreny week, and end date today + 28 days, I can change this later or caclcualte a maximum timeline @upgrade
        for (const channel of settlementChannels) {
            initiateOperetingHourInIntervals(channel)
        }

        // now let's add the breakes
        for (const channel of settlementChannels) {
            for (const blackoutWindow of channel.data.blackoutWindows) {
                inserInterval(BlackoutWindowToTimeInterval(blackoutWindow), channel.data.intervals)
            }
        }

        for (const task of settlementTasks) {
            const channel = settlementChannels.find(c => c.docId === task.data.settlementChannelId)
            if (!channel) throw `Channel ${task.data.settlementChannelId} not found! `
            this.resolveTaks(task, channel)
        }

        //logging
        for (const channel of settlementChannels) {
            let i = 0
            console.log(channel.data.name)
            console.log(channel.data.operatingHours)
            console.log(channel.data.blackoutWindows)
            for (const intreval of channel.data.intervals) {
                console.log(`${intreval.starDate} - ${intreval.type}${intreval.taskId ? ` - ${intreval.taskId}` : ""} - ${intreval.endDate}  [${i++}]`)
            }
        }

    }

    resolveTaks(settlementTask: SettlementTask, settlementChannel: SettlementChannel, afterDate?: string, beforeDate?: string) {
        if (settlementTask.data.isRegulatoryHold) {
            if (settlementTask.data.startDate === null || settlementTask.data.endDate === null) {
                throw "For reguraltory hold stard date and end date is mandatory"
            }
            inserInterval({
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

        const availableIntervals = settlementChannel.data.intervals.filter(intreval => {
            if (intreval.type !== TimeIntervalType.FreeSlot) return false
            if (DateTime.fromISO(intreval.endDate).toMillis() <= DateTime.fromISO(startingWith).toMillis()) return false;
            return true
        })
        let numberOfMinutesLeft = settlementTask.data.durationMinutes;
        let intrevalsBookedByTheTask: TimeIntervals = []

        for (let intreval of availableIntervals) {

            const startDateForThisIntreval = DateTime.max(
                DateTime.fromISO(intreval.starDate).toUTC(),
                DateTime.fromISO(startingWith).toUTC()
            ).toUTC().toISO()!;
            const availableMinutesInIntreval = DateTime
                .fromISO(intreval.endDate)
                .diff(
                    DateTime.fromISO(startDateForThisIntreval),
                    'minutes'
                )
                .minutes;
            const numberOfMiuntestToBook = Math.min(availableMinutesInIntreval, numberOfMinutesLeft);
            const intrevalToPush: TimeInterval = {
                starDate: startDateForThisIntreval,
                endDate: DateTime
                    .fromISO(startDateForThisIntreval)
                    .plus({ minutes: numberOfMiuntestToBook })
                    .toUTC().toISO()!,
                taskId: settlementTask.docId,
                type: TimeIntervalType.Task
            };
            intrevalsBookedByTheTask.push(intrevalToPush)
            numberOfMinutesLeft -= numberOfMiuntestToBook
            if (numberOfMinutesLeft === 0) break
        }
        if (numberOfMinutesLeft !== 0) throw `Task ${settlementTask.docId} can note be resolved!`
        console.log(`intrevalsBookedByTheTask:`, intrevalsBookedByTheTask)

        for (const intreval of intrevalsBookedByTheTask) {
            inserInterval(intreval, settlementChannel.data.intervals)
        }
        settlementTask.data.startDate = intrevalsBookedByTheTask[0].starDate
        settlementTask.data.endDate = intrevalsBookedByTheTask[intrevalsBookedByTheTask.length - 1].endDate
    }
}