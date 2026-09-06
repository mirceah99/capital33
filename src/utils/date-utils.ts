import { DateTime } from 'luxon';
import { BlackoutWindow, OperatingHours, SettlementChannel, TimeInterval, TimeIntervals, TimeIntervalType } from '../reflow/types';
// this function will create a full countinous interval( no gaps)
export function initiateOperetingHourInIntervals(channel: SettlementChannel) {

    let operatingHours: OperatingHours = JSON.parse(JSON.stringify(channel.data.operatingHours)) // deep copy becaus I'll update it
    const intervals: TimeIntervals = channel.data.intervals
    if (intervals.length > 0) return // intervals alread initiates
    const nrOfWeeks = 4; // 4 weeks timeline can be updated
    const startDate = DateTime.utc().startOf('week'); // moday of this week

    // the week starts on Monday, no // 0–6, Sunday = 0 BS!
    operatingHours.forEach(operationgHour => {
        operationgHour.dayOfWeek -= 1
        if (operationgHour.dayOfWeek === -1) operationgHour.dayOfWeek = 6
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
        const fillGapIntereval: TimeInterval = {
            starDate: intervals[i].endDate,
            endDate: intervals[i + 1].starDate,
            taskId: null,
            type: TimeIntervalType.Close
        }
        intervals.splice(i + 1, 0, fillGapIntereval) // this can be time consuming
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
export function inserInterval(intrevalToInsert: TimeInterval, intervals: TimeIntervals) {
    if (intrevalToInsert.starDate < intervals[0].starDate || intrevalToInsert.endDate > intervals[intervals.length - 1].endDate) {
        throw 'Insert intreval failed, out of range!!'
    }
    let startIntervalIndex: number = -1;
    let stopIntrevalIndex: number = -1;
    for (let i = 0; i < intervals.length; i++) {
        const intreval = intervals[i];
        if (DateTime.fromISO(intrevalToInsert.starDate).toMillis() <= DateTime.fromISO(intreval.endDate).toMillis() && startIntervalIndex === -1) {
            startIntervalIndex = i;
        }
        if (DateTime.fromISO(intrevalToInsert.endDate).toMillis() <= DateTime.fromISO(intreval.endDate).toMillis()) {
            stopIntrevalIndex = i;
            break
        }
    }
    const skipFirstIntreval = intervals[startIntervalIndex].endDate === intrevalToInsert.starDate ? 1 : 0
    for (let i = startIntervalIndex + skipFirstIntreval; i <= stopIntrevalIndex; i++) {
        typeConversionIsAllowed(intervals[i].type, intrevalToInsert.type)
    }

    //insert intreval contained by bigger interval
    if (startIntervalIndex === stopIntrevalIndex) {
        const intreval = intervals[startIntervalIndex];
        // same start end date
        if (DateTime.fromISO(intrevalToInsert.starDate).toMillis() === DateTime.fromISO(intreval.starDate).toMillis() &&
            DateTime.fromISO(intrevalToInsert.endDate).toMillis() === DateTime.fromISO(intreval.endDate).toMillis()) {
            intreval.type = intrevalToInsert.type
            intreval.taskId = intrevalToInsert.taskId;
            return
        }

        // same end date
        if (DateTime.fromISO(intrevalToInsert.endDate).toMillis() === DateTime.fromISO(intreval.endDate).toMillis()) {
            intreval.endDate = intrevalToInsert.starDate
            intervals.splice(startIntervalIndex + 1, 0, intrevalToInsert)
            return
        }

        // same start date
        if (DateTime.fromISO(intrevalToInsert.starDate).toMillis() === DateTime.fromISO(intreval.starDate).toMillis()) {
            intreval.starDate = intrevalToInsert.endDate
            intervals.splice(startIntervalIndex, 0, intrevalToInsert)
            return
        }

        // different end date and start date 
        const oldEndDate = intreval.endDate
        intreval.endDate = intrevalToInsert.starDate
        intervals.splice(startIntervalIndex + 1, 0, intrevalToInsert)
        intervals.splice(startIntervalIndex + 2, 0, { starDate: intrevalToInsert.endDate, endDate: oldEndDate, type: intreval.type, taskId: intreval.taskId })
        return


    }


    intervals[startIntervalIndex].endDate = intrevalToInsert.starDate
    intervals[stopIntrevalIndex].starDate = intrevalToInsert.endDate

    //insert intreval spread over 3 ore more intrevals, it means we have to delete middle
    if (stopIntrevalIndex - startIntervalIndex >= 2) {
        intervals.splice(startIntervalIndex + 1, stopIntrevalIndex - startIntervalIndex - 1)

    }
    intervals.splice(startIntervalIndex + 1, 0, intrevalToInsert)

    //delete enpty intrevals  intervals[stopIntrevalIndex].starDate = intrevalToInsert.endDate start date can be === end date so is empty intreval
    clearIntrevals(intervals)

}

// if in a TimeIntervalType.FreeSlot I want to move to TimeIntervalType.Task it is okay 
// but from   TimeIntervalType.Blackout or TimeIntervalType.Close is not okay to go to TimeIntervalType.Task
function typeConversionIsAllowed(initialType: TimeIntervalType, targetType: TimeIntervalType) {
    if (targetType === TimeIntervalType.Task && initialType !== TimeIntervalType.FreeSlot) {
        throw 'Task intreval can be sloted only in free slots!'
    }
    if (targetType === TimeIntervalType.Blackout && initialType === TimeIntervalType.Task) {
        throw 'Blackout can not be sloted over task, please move the task first!'
    }
    if (targetType === TimeIntervalType.Close && initialType === TimeIntervalType.Task) {
        throw 'Blackout can not be sloted over task, please move the task first!'
    }
    if (targetType === TimeIntervalType.FreeSlot && initialType === TimeIntervalType.Task) {
        throw 'FreeSlot can not be sloted over task, please move the task first!'
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

function clearIntrevals(intervals: TimeIntervals) {
    for (let i = 0; i < intervals.length; i++) {
        if (intervals[i].starDate === intervals[i].endDate) {
            intervals.splice(i, 1)
        }
    }
}