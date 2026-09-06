import { BlackoutWindowToTimeInterval, initiateOperetingHourInIntervals, inserInterval } from "../utils/date-utils";
import { SettlementChannel, SettlementTask, TradeOrder } from "./types";

export class ReflowService {
    reflow(settlementTasks: SettlementTask[], settlementChannels: SettlementChannel[], tradeOrders: TradeOrder[]){

        // first I'll create the axex of time for all the cahnnels
        // I do not really know a time interval, how long to do the axes, so start date will be Monday of the curreny week, and end date today + 28 days, I can change this later or caclcualte a maximum timeline @upgrade
        for( const channel of settlementChannels){
            initiateOperetingHourInIntervals(channel)
        }

        for (const channel of settlementChannels){
            console.log(channel.data.name)
            console.log(channel.data.operatingHours)
            console.log(channel.data.blackoutWindows)
            for(const intreval of channel.data.intervals){
                console.log(`${intreval.starDate} - ${intreval.type} - ${intreval.endDate}`)
            }
        }

        // now let's add the breakes
        for( const channel of settlementChannels){
            for (const blackoutWindow of channel.data.blackoutWindows){
                inserInterval(BlackoutWindowToTimeInterval (blackoutWindow), channel.data.intervals)
            }
        }

        //logging
        for (const channel of settlementChannels){
            console.log(channel.data.name)
            console.log(channel.data.operatingHours)
            console.log(channel.data.blackoutWindows)
            for(const intreval of channel.data.intervals){
                console.log(`${intreval.starDate} - ${intreval.type} - ${intreval.endDate}`)
            }
        }

    }
}