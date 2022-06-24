import {Bot} from "./Bot";
import {IConfiguration} from "./definitions";
import * as fs from "fs";
import * as path from "path";
import {StringBuilder} from "./utilities/StringBuilder";
import {TimeUtilities} from "./utilities/TimeUtilities";
import {MutableConstants} from "./constants/MutableConstants";
import {JsonManager} from "./JsonManager";

(async () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "config.production.json"));
    const config: IConfiguration = JSON.parse(content.toString());
    const bot = new Bot(config);
    bot.startAllEvents();
    MutableConstants.initCapeData();
    MutableConstants.initCourseListing();
    MutableConstants.initSectionData("SP22");
    JsonManager.startAll();
    if (config.isProd) {
        await MutableConstants.initEnrollmentData();
    }
    console.info("All data received.");
    await bot.login();
})();

process.on("unhandledRejection", e => {
    console.error(
        new StringBuilder()
            .append(`[${TimeUtilities.getDateTime(Date.now(), "America/Los_Angeles")}] ${e}`)
            .appendLine()
            .append("=====================================")
            .toString()
    );
});