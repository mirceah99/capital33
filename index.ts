import { settlementChannels, settlementTasks, tradeOrders } from "./scenarios/scenario1";
import { ReflowService } from "./src/reflow/reflow.service";

const reflowService = new ReflowService();

reflowService.reflow(settlementTasks, settlementChannels, tradeOrders)