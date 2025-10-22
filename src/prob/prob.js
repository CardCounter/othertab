import { initializeCredits } from "./core/credits.js";
import { startGameLoop } from "./core/game-loop.js";
import { createWidgetManager } from "./core/widget-manager.js";
import { createCoinWidget } from "./widgets/coin.js";
import { createDiceWidget } from "./widgets/dice.js";
import { createAceWidget } from "./widgets/ace.js";
import { createPachinkoWidget } from "./widgets/pachinko.js";

initializeCredits();

const widgets = [createCoinWidget(), createDiceWidget(), createAceWidget(), createPachinkoWidget()];
widgets.forEach((widget) => widget.init());

const widgetManager = createWidgetManager({
    widgets,
    navSelector: ".prob-nav-item[data-widget]"
});

widgetManager.init();
startGameLoop();
