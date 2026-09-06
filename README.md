# capital33
Settlement Schedule Reflow - Technical

Terminology:
- Trade Order (settlement) = a big task (for example, buy $1M in treasury bonds)
- Settlement Task = a small part of the big task (for example, bid for the bonds, pay for the bonds, or do a compliance check)
- Settlement Channel (desk) = a team; each team can do different settlement tasks


TODO:
- be careful with time zones
- be careful with cyclic graphs
- Multiple upstream dependencies allowed (all must complete first)


I think in resolving this task it will be very useful to see some graphs in a UI, so maybe I'll try to do a UI.

Now after 30 minutes of reading the docs, I think I have a strategy, first I create the channels and I start with an empty Gantt-style timeline. I'll create sort of function "insertTaskInTimeline" this should be the heavy lifter of this problem. I'll get the tasks from the Trade Order that have no dependency or their dependencies are already scheduled and add them in the timeline marking them as scheduled: true, I'll do this till all tasks are scheduled or I cannot find a slot and throw. Now if a task is delayed/rescheduled I'll try to find a new slot for it and after go downstream and use "insertTaskInTimeline" for all dependencies.

The hard part is that scheduling a task may require moving another task (idk if it is required but it is an interesting topic), I'll postpone this for the moment, but give you an example. For example I have Trade Order 123 with tasks A and B, B depends on A, I mean A must be complete before B. B is isRegulatoryHold: true so B cannot be rescheduled and is set for 6 Sep 10:00, A and B are both on same channel X, channel X is 10:00-18:00 each day. Today is 4 Sep and channel X is fully booked for tomorrow 5 Sep, so the Order will be rejected, but I can accept it if I delay a task from Channel X 5 Sep to another day to make room for task A.

More tomorrow, now is late, I go to sleep and think.

Now creating some scenarios I think that startDate endDate and durationMinutes is a poor way to represent the timing, it is very poor because I can have a 300 minutes task and the channel open today from 10:00 to 18:00 and from 12:00 to 13:00 the channel is booked with another task, so basically I'll have startDate today 10:00 endDate today 18:00 and durationMinutes 300 min (5 hours) but there is no way to know that from 12 to 13 there will be another task that is performing on that channel, ok I can go to the task from 12 to 13 and see but this is a simplified case, let's say you have this case: 
Channel X 12:00 a - a - a - a - 20:00 where a is 1 hour of work on task a and - it is a free slot it can be booked but is free for now 
I have to add now task b with 4 hours on channel X so it will be: 
Channel X 12:00 a b a b a b a b 20:00 I will have: 

task a: 
startDate: 12:00 today
endDate: 19:00 today
durationMinutes: 4 * 60; 
settlementChannelId: 'X'

task B: 
startDate: 13:00 today
endDate: 20:00 today
durationMinutes: 4 * 60; 
settlementChannelId: 'X'

So there is no way to figure out that the structure is abababab it can also be aaabbbab, I think that the proposed type for Settlement Task is poor, I'll add a new property "processingIntervals" this will be an array of tuples of dates, this thing will make the process much much clearer and by extension much easier.

It is the 3rd time now I am starting to work on this project, I had a great pause, now I think processingIntervals should be on the channel, and I'll just name it as interval, and it will be an array of objects:
{startDate, endDate, taskId, type: 'task' | 'break' etc...}

When I want to find an interval I'll do an axis of time for that week, and I'll have all the intervals there and look for a slot.

I think I am almost done with the core functionality.

Produce a valid schedule where:

No settlement channel conflicts ✅
All dependencies satisfied ✅
All processing within operating hours ✅
Maintenance/blackout windows respected ✅

Now I stime to add some AI on the codebase, I'll ask the AI to create a intreface, and do some demos, I'll attache the promts in a separate file. I'll add the JD for context here.


I'll want to do a visaul demo that will ilustrate how the solution works.
Oh short a scenario is a full configuration with task channels and orders. But for the tasks start and end date will be null (exception) "isRegulatoryHold": true. Each scenario is loaded and rezolved by reflow service, the solution is after displayed in the ui.

Demo scenarios:

1. Initla scenario: 3 channels A, B and C, A monday to friday 9 - 13 14-17 working hours, b mondat and wednesday 10-16, and C 9-10 mondat-friday. No task for the moment.
2. Add a task task-1 3 hours on channel B
3. Add a task task-2 3 hours on channel C
4. On channel C add blackout for all day tue 8/9
5. Add task task-3 on channel A 3h
6. Now do task-3 dependent on task-1 
7. Now do task-1 dependent on task-2
8. Add task-4 6h channel A
9. Add task-5 2h channel A 10-12 7/9 isRegulatoryHold:true
10. Add task-6 7h on channle B
11. Add task-7 1h channel A dependend on both task-4 and task-6
12. Bronken From 11 add task-8 100h on channel C this should fail 
13. Broken From 11  add task-8 and task-9 on channel B 1h task-8 dependent on task-9 and task-9 dependent on task-8