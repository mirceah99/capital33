import { DateTime } from 'luxon';
import { BlackoutWindow, OperatingHours, SettlementChannel, TimeInterval, TimeIntervals, TimeIntervalType } from '../reflow/types';
// this function will create a full continuous interval( no gaps)
export function initiateOperatingHourInIntervals(channel: SettlementChannel) {

    let operatingHours: OperatingHours = JSON.parse(JSON.stringify(channel.data.operatingHours)) // deep copy because I'll update it
    const intervals: TimeIntervals = channel.data.intervals
    if (intervals.length > 0) return // intervals alread initiates
    const nrOfWeeks = 4; // 4 weeks timeline can be updated
    const startDate = DateTime.utc().startOf('week'); // moday of this week

    // the week starts on Monday, no // 0–6, Sunday = 0 BS!
    operatingHours.forEach(operatingHour => {
        operatingHour.dayOfWeek -= 1
        if (operatingHour.dayOfWeek === -1) operatingHour.dayOfWeek = 6
    })
    for (const operatingHour of operatingHours) {
        let siftingDate = startDate; // immutable object
        for (let i = 0; i < nrOfWeeks; i++) {
            let interval: TimeInterval = {
                starDate: siftingDate.plus({ days: operatingHour.dayOfWeek, hours: operatingHour.startHour }).toUTC().toISO(),
                endDate: siftingDate.plus({ days: operatingHour.dayOfWeek, hours: operatingHour.endHour }).toUTC().toISO(),
                taskId: null,
                type: TimeIntervalType.FreeSlot
            }
            intervals.push(interval)
            siftingDate = startDate.plus({ weeks: i + 1 })
        }
    }
    // sort the intervals
    intervals.sort(
        (a, b) =>
            DateTime.fromISO(a.starDate).toMillis() - DateTime.fromISO(b.starDate).toMillis()
    );

    // add the first Closed interval 
    if (DateTime.fromISO(intervals[0].starDate).toMillis() > startDate.toMillis()) {
        intervals.unshift({
            starDate: startDate.toUTC().toISO(),
            endDate: intervals[0].starDate,
            taskId: null,
            type: TimeIntervalType.Close
        })
    }

    //fill the gaps 
    for (let i = 0; i < intervals.length - 1; i++) {
        if (intervals[i].endDate === intervals[i + 1].starDate) {
            continue;
        }
        const fillGapInterval: TimeInterval = {
            starDate: intervals[i].endDate,
            endDate: intervals[i + 1].starDate,
            taskId: null,
            type: TimeIntervalType.Close
        }
        intervals.splice(i + 1, 0, fillGapInterval) // this can be time consuming
        i++
    }

    // add the last Closed interval 
    if (DateTime.fromISO(intervals[intervals.length - 1].endDate).toMillis() < startDate.plus({ weeks: nrOfWeeks + 1 }).toMillis()) {
        intervals.push({
            starDate: intervals[intervals.length - 1].endDate,
            endDate: startDate.plus({ weeks: nrOfWeeks + 1 }).toISO(),
            taskId: null,
            type: TimeIntervalType.Close
        })
    }

}

// insert interval function will be used on intervals with no gaps 
export function insertInterval(intervalToInsert: TimeInterval, intervals: TimeIntervals) {
    if (intervalToInsert.starDate < intervals[0].starDate || intervalToInsert.endDate > intervals[intervals.length - 1].endDate) {
        throw 'Insert interval failed, out of range!!'
    }
    let startIntervalIndex: number = -1;
    let stopIntervalIndex: number = -1;
    for (let i = 0; i < intervals.length; i++) {
        const interval = intervals[i];
        if (DateTime.fromISO(intervalToInsert.starDate).toMillis() <= DateTime.fromISO(interval.endDate).toMillis() && startIntervalIndex === -1) {
            startIntervalIndex = i;
        }
        if (DateTime.fromISO(intervalToInsert.endDate).toMillis() <= DateTime.fromISO(interval.endDate).toMillis()) {
            stopIntervalIndex = i;
            break
        }
    }
    const skipFirstInterval = intervals[startIntervalIndex].endDate === intervalToInsert.starDate ? 1 : 0
    for (let i = startIntervalIndex + skipFirstInterval; i <= stopIntervalIndex; i++) {
        typeConversionIsAllowed(intervals[i].type, intervalToInsert.type)
    }

    //insert interval contained by bigger interval
    if (startIntervalIndex === stopIntervalIndex) {
        const interval = intervals[startIntervalIndex];
        // same start end date
        if (DateTime.fromISO(intervalToInsert.starDate).toMillis() === DateTime.fromISO(interval.starDate).toMillis() &&
            DateTime.fromISO(intervalToInsert.endDate).toMillis() === DateTime.fromISO(interval.endDate).toMillis()) {
            interval.type = intervalToInsert.type
            interval.taskId = intervalToInsert.taskId;
            return
        }

        // same end date
        if (DateTime.fromISO(intervalToInsert.endDate).toMillis() === DateTime.fromISO(interval.endDate).toMillis()) {
            interval.endDate = intervalToInsert.starDate
            intervals.splice(startIntervalIndex + 1, 0, intervalToInsert)
            return
        }

        // same start date
        if (DateTime.fromISO(intervalToInsert.starDate).toMillis() === DateTime.fromISO(interval.starDate).toMillis()) {
            interval.starDate = intervalToInsert.endDate
            intervals.splice(startIntervalIndex, 0, intervalToInsert)
            return
        }

        // different end date and start date 
        const oldEndDate = interval.endDate
        interval.endDate = intervalToInsert.starDate
        intervals.splice(startIntervalIndex + 1, 0, intervalToInsert)
        intervals.splice(startIntervalIndex + 2, 0, { starDate: intervalToInsert.endDate, endDate: oldEndDate, type: interval.type, taskId: interval.taskId })
        return


    }


    intervals[startIntervalIndex].endDate = intervalToInsert.starDate
    intervals[stopIntervalIndex].starDate = intervalToInsert.endDate

    //insert interval spread over 3 ore more intervals, it means we have to delete middle
    if (stopIntervalIndex - startIntervalIndex >= 2) {
        intervals.splice(startIntervalIndex + 1, stopIntervalIndex - startIntervalIndex - 1)

    }
    intervals.splice(startIntervalIndex + 1, 0, intervalToInsert)

    //delete empty intervals  intervals[stopIntervalIndex].starDate = intervalToInsert.endDate start date can be === end date so is empty intreval
    clearIntervals(intervals)

}

// if in a TimeIntervalType.FreeSlot I want to move to TimeIntervalType.Task it is okay 
// but from   TimeIntervalType.Blackout or TimeIntervalType.Close is not okay to go to TimeIntervalType.Task
function typeConversionIsAllowed(initialType: TimeIntervalType, targetType: TimeIntervalType) {
    if (targetType === TimeIntervalType.Task && initialType !== TimeIntervalType.FreeSlot) {
        throw 'Task interval can be stored only in free slots!'
    }
    if (targetType === TimeIntervalType.Blackout && initialType === TimeIntervalType.Task) {
        throw 'Blackout can not be stored over task, please move the task first!'
    }
    if (targetType === TimeIntervalType.Close && initialType === TimeIntervalType.Task) {
        throw 'Blackout can not be stored over task, please move the task first!'
    }
    if (targetType === TimeIntervalType.FreeSlot && initialType === TimeIntervalType.Task) {
        throw 'FreeSlot can not be stored over task, please move the task first!'
    }
}

export function BlackoutWindowToTimeInterval(blackoutWindow: BlackoutWindow): TimeInterval {
    return {
        starDate: blackoutWindow.startDate,
        endDate: blackoutWindow.endDate,
        taskId: null,
        type: TimeIntervalType.Blackout
    }
}

function clearIntervals(intervals: TimeIntervals) {
    for (let i = 0; i < intervals.length; i++) {
        if (intervals[i].starDate === intervals[i].endDate) {
            intervals.splice(i, 1)
        }
    }
}