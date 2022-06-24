import { Bot } from "../../Bot";
import { ArgumentType, BaseCommand, ICommandContext } from "../BaseCommand";
import * as path from "path";
import { load, Root, Type } from "protobufjs";
import { OneBusAwayData } from "../../definitions/OneBusAwayInterface";
import { MessageEmbed } from "discord.js";
import { MutableConstants } from "../../constants/MutableConstants";
import { TimeUtilities } from "../../utilities/TimeUtilities";
import { StringBuilder } from "../../utilities/StringBuilder";
import { GeneralUtilities } from "../../utilities/GeneralUtilities";
import { AxiosResponse } from "axios";
import { EmojiConstants, GeneralConstants } from "../../constants/GeneralConstants";
const padTimeDigit = TimeUtilities.padTimeDigit;

const MTS_REALTIME_UPDATE_ENDPOINT: string = "https://realtime.sdmts.com/api/api/gtfs_realtime/trip-updates-for-agency/MTS.pb";

export class MTS extends BaseCommand {


    private static ROOT: Root | null = null;
    private static FEED: Type | null = null;

    public constructor() {
        super({
            cmdCode: "MTS",
            formalCommandName: "MTS",
            botCommandName: "mts",
            description: "Looks up MTS buses or trolleys.",
            generalPermissions: [],
            botPermissions: [],
            commandCooldown: 3 * 1000,
            argumentInfo: [
                {
                    displayName: "Bus Number",
                    argName: "bus_num",
                    desc: "The bus number to look up.",
                    type: ArgumentType.String,
                    prettyType: "String",
                    required: false,
                    example: ["202", "201"]
                },
                {
                    displayName: "Trolley",
                    argName: "trolley",
                    desc: "The trolley to look up.",
                    type: ArgumentType.String,
                    prettyType: "String",
                    restrictions: {
                        stringChoices: [
                            { name: "Blue", value: "510" },
                            { name: "Orange", value: "520" },
                            { name: "Green", value: "530" },
                            { name: "Event", value: "540" },
                            { name: "Silver", value: "550" },
                        ]
                    },
                    required: false,
                    example: ["202", "201"]
                },
                {
                    displayName: "Stop ID",
                    argName: "stop_id",
                    desc: "The stop ID to check. This will return the nearest (specified) buses nearest to this stop.",
                    type: ArgumentType.String,
                    prettyType: "String",
                    required: false,
                    example: ["213141"]
                }
            ],
            guildOnly: false,
            botOwnerOnly: false
        });
    }

    private static TROLLEY: { [routeNum: string]: string } = {
        "510": "Blue",
        "520": "Orange",
        "530": "Green",
        "540": "Event",
        "550": "Silver",
    };

    /**
     * @inheritDoc
     */
    public async run(ctx: ICommandContext): Promise<number> {
        const busNumber = ctx.interaction.options.getString("bus_num", false);
        const trolley = ctx.interaction.options.getString("trolley", false);
        const stopNum = ctx.interaction.options.getString("stop_id", false);
        if (!busNumber && !trolley) {
            await ctx.interaction.reply({
                content: "Please choose a bus number or trolley."
            });

            return -1;
        }

        // The 0 should not hit.
        const choice = trolley ?? busNumber ?? 0;
        const isBus = !!busNumber;

        const data = await GeneralUtilities.tryExecuteAsync<AxiosResponse>(async () => {
            return await Bot.AxiosClient.get(`${MTS_REALTIME_UPDATE_ENDPOINT}?key=${Bot.BotInstance.config.token.mtsToken}`, {
                responseType: "arraybuffer"
            });
        });

        if (!data) {
            await ctx.interaction.reply({
                content: "Unable to fetch data from MTS's API at this time. Try again later."
            });

            return -1;
        }

        if (!MTS.ROOT || !MTS.FEED) {
            MTS.ROOT = await load(path.join(__dirname, "..", "..", "..", "gtfs-realtime.proto"));
            MTS.FEED = MTS.ROOT.lookupType("transit_realtime.FeedMessage");
        }

        const parsed: OneBusAwayData = MTS.FEED.decode(data.data).toJSON() as OneBusAwayData;
        const allBuses = parsed.entity;
        let targetBusData = allBuses.filter(x => x.tripUpdate.trip.routeId === choice);
        const origLen = targetBusData.length;
        if (stopNum) {
            targetBusData = targetBusData.filter(x => x.tripUpdate.stopTimeUpdate.some(y => y.stopId === stopNum));
        }
        
        if (targetBusData.length === 0) {
            if (origLen > 0) {
                await ctx.interaction.reply({
                    content: `The stop ID you selected, \`${stopNum}\`, is not valid or the bus that you picked does not`
                        + " stop at this stop."
                });

                return -1;
            }

            await ctx.interaction.reply({
                content: isBus
                    ? `Bus \`${choice}\` is not available right now. Try again.`
                    : `The ${MTS.TROLLEY[choice]} line trolley is not available right now. Try again.`
            });

            return -1;
        }

        const map: {[destination: string]: {arrival: number; embed: MessageEmbed;}[]} = {};

        for (const busData of targetBusData) {
            const busRoute = MutableConstants.BUS_ROUTES[busData.tripUpdate.trip.routeId];
            const tripData = MutableConstants.TRIP_DATA_ID[busData.tripUpdate.trip.tripId];
            const lastBusStop = MutableConstants.BUS_STOPS[
                MutableConstants.STOP_TIME[busData.tripUpdate.trip.tripId].at(-1)?.stopId ?? ""
            ]?.stopName;

            let arrivalTime = 0;

            let routeTitle = lastBusStop
                ? `To **${lastBusStop}**`
                : tripData.directionName
                    ? `To **${tripData.directionName}**`
                        : busRoute.routeLongName
                            ? busRoute.routeLongName
                            : "Unknown";
                
            let transTitle = isBus
                ? `Bus **${busData.tripUpdate.trip.routeId}**`
                : `**${MTS.TROLLEY[busData.tripUpdate.trip.routeId] ?? "Unknown"} Line** Trolley`

            const embed = new MessageEmbed()
                .setThumbnail("https://www.sdmts.com/sites/default/files/attachments/mtslogo-red.jpg")
                .setTitle(`${transTitle}: ${routeTitle}`);

            if (busRoute) {
                embed.setURL(busRoute.routeUrl);
                embed.setColor(busRoute.routeColor);
            }
            else {
                embed.setColor("WHITE");
            }

            const lastUpdated = Number.parseInt(busData.tripUpdate.timestamp, 10) * 1000;
            embed.setFooter({ text: `${isBus ? "Bus" : "Trolley"} ${busData.tripUpdate.vehicle.id}` });
            if (!Number.isNaN(lastUpdated)) {
                embed.setFooter({ text: embed.footer!.text += " / Last Updated" });
                embed.setTimestamp(lastUpdated);
            }

            const desc = new StringBuilder();
            desc.append(`Route: ${busRoute.routeLongName}`).appendLine();

            // Delay in minutes
            if (busData.tripUpdate.delay) {
                const delay = busData.tripUpdate.delay > 0
                    ? Math.ceil(busData.tripUpdate.delay / 60)
                    : Math.floor(busData.tripUpdate.delay / 60);
                desc.append(`${EmojiConstants.WARNING_EMOJI} ${Math.abs(delay)} Minute(s) ${delay > 0 ? "Delayed" : "Early"}`);
            }
            else {
                desc.append(`${EmojiConstants.GREEN_SQUARE_EMOJI} On Time.`);
            }

            let foundDestination = false;
            let helperAddEmbed: (i: number) => void;

            // If this is the case, then the bus is scheduled to leave at some point
            if (busData.tripUpdate.stopTimeUpdate.length === 1
                && busData.tripUpdate.stopTimeUpdate[0].departure.time
                && !busData.tripUpdate.stopTimeUpdate[0].arrival) {
                const nextTrip = Number.parseInt(busData.tripUpdate.trip.tripId, 10);
                const scheduledStops = MutableConstants.STOP_TIME[nextTrip];

                // First, see what the departure time of the parent stop is (from MTS's API)
                const parentExpDepart = new Date(Number.parseInt(busData.tripUpdate.stopTimeUpdate[0].departure.time, 10) * 1000);
                // Calculate the actual time that the bus will leave, from MTS's static trip csv file
                const parentActDepart = new Date();
                const [pHr, pMin, pSec] = scheduledStops[0].arrivalTime.split(":").map(x => Number.parseInt(x, 10));
                parentActDepart.setHours(pHr);
                parentActDepart.setMinutes(pMin);
                parentActDepart.setSeconds(pSec);
                const differenceInTime = parentExpDepart.getTime() - parentActDepart.getTime();

                helperAddEmbed = (i: number) => {
                    const scheduledStop = scheduledStops[i];
                    const schedStopInfo = MutableConstants.BUS_STOPS[scheduledStop.stopId] ?? {
                        stopName: `STOP ${scheduledStop.stopId}`
                    };

                    const [sHr, sMin, sSec] = scheduledStops[i].arrivalTime.split(":").map(x => Number.parseInt(x, 10));
                    const d = new Date();
                    d.setHours(sHr, sMin, sSec);
                    d.setMilliseconds(d.getMilliseconds() + differenceInTime);

                    if (scheduledStop.stopId === stopNum) {
                        foundDestination = true;
                        arrivalTime = d.getTime();
                    }

                    const scheduledDeparture = convertStrTimeToHumanTime(scheduledStop.arrivalTime);
                    // scheduled arrival = scheduled leave time
                    embed.addField(
                        scheduledStop.stopId === stopNum
                            ? `${EmojiConstants.STOP_SIGN_EMOJI} **${schedStopInfo.stopName}** (ID ${scheduledStop.stopId})`
                            : `${schedStopInfo.stopName} (ID ${scheduledStop.stopId})`,
                        "Scheduled to Leave: " +
                        (differenceInTime === 0
                            ? scheduledDeparture
                            : `~~${scheduledDeparture}~~ ${TimeUtilities.getCurrentTime(d)}`)
                    );
                };
                
                for (let i = 0; i < Math.min(5, scheduledStops.length); i++) {
                    helperAddEmbed(i);
                }
            }
            else {
                // Display next 5 stops
                const end = Math.min(5, busData.tripUpdate.stopTimeUpdate.length);
                helperAddEmbed = (i: number) => {
                    const stop = busData.tripUpdate.stopTimeUpdate[i];
                    if (stop.stopId === stopNum) {
                        foundDestination = true;
                    }
                    
                    const stopInfo = MutableConstants.BUS_STOPS[stop.stopId] ?? {
                        stopName: `STOP ${stop.stopId}`
                    };

                    const sb = new StringBuilder();
                    if (stop.arrival && stop.arrival.time) {
                        const t = Number.parseInt(stop.arrival.time!, 10) * 1000;;
                        sb.append(`Arriving: ${TimeUtilities.getCurrentTime(t)} `)
                            .append(`(${getTimeLeft(stop.arrival.time!)} Left)`).appendLine();
                        
                        if (stop.stopId === stopNum) {
                            arrivalTime = t;
                        }
                    }

                    // Buses will always have the same arriving/departing times.
                    // Trolleys will only have arriving times.
                    if (stop.departure && stop.departure.time && sb.length() === 0) {
                        sb.append(`Departing: ${TimeUtilities.getCurrentTime((Number.parseInt(stop.departure.time!, 10) * 1000))} `)
                            .append(`(${getTimeLeft(stop.departure.time!)} Left)`);
                    }

                    if (sb.length() === 0) {
                        sb.append("No Data Available.");
                    }

                    embed.addField(
                        stop.stopId === stopNum
                            ? `${EmojiConstants.STOP_SIGN_EMOJI} **${stopInfo.stopName}** (ID ${stop.stopId})`
                            : `${stopInfo.stopName} (ID ${stop.stopId})`,
                        sb.toString()
                    );
                };

                for (let i = 0; i < end; i++) {
                    helperAddEmbed(i);
                }
            }

            if (!foundDestination && stopNum) {
                const stopIdx = busData.tripUpdate.stopTimeUpdate.findIndex(x => x.stopId === stopNum)!;
                embed.addField(GeneralConstants.ZERO_WIDTH_SPACE, "...");
                helperAddEmbed(stopIdx);
            }

            // If the arrival time is still 0, use the arrival time of the last stop.
            if (arrivalTime === 0) {

            }

            embed.setDescription(desc.toString());
            await ctx.channel.send({ embeds: [embed] });
        }

        return 0;
    }
}

function getTimeLeft(raw: string): string {
    const t = Number.parseInt(raw, 10) * 1000;
    return TimeUtilities.formatDuration(t - Date.now(), false, false);
}

// 05:26:00

function convertStrTimeToHumanTime(str: string): string {
    let [hr, min, sec] = str.split(":").map(x => Number.parseInt(x, 10));
    const isAm = hr < 12;
    hr = hr % 12;
    if (hr === 0) {
        hr = 12;
    }

    return `${padTimeDigit(hr)}:${padTimeDigit(min)}:${padTimeDigit(sec)} ${isAm ? "AM" : "PM"}`;
}