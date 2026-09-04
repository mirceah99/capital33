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