import {IConfiguration} from "./definitions";
import {Client, Collection, GuildChannel, Interaction,} from "discord.js";
import axios, {AxiosInstance} from "axios";
import * as Cmds from "./commands";
import {onErrorEvent, onInteractionEvent, onMessage, onReadyEvent} from "./events";
import {REST} from "@discordjs/rest";
import {RESTPostAPIApplicationCommandsJSONBody, Routes} from "discord-api-types/v10";

export class Bot {
    /**
     * The bot instance.
     * @type {Bot}
     */
    public static BotInstance: Bot;

    /**
     * The HTTP client used to make web requests.
     * @type {AxiosInstance}
     */
    public static AxiosClient: AxiosInstance = axios.create();

    /**
     * All commands. The key is the category name and the value is the array of commands.
     * @type {Collection<string, BaseCommand[]>}
     */
    public static Commands: Collection<string, Cmds.BaseCommand[]>;

    /**
     * All commands. The key is the name of the command (essentially, the slash command name) and the value is the
     * command object.
     *
     * **DO NOT MANUALLY POPULATE THIS OBJECT.**
     *
     * @type {Collection<string, BaseCommand>}
     */
    public static NameCommands: Collection<string, Cmds.BaseCommand>;

    /**
     * All commands. This is sent to Discord for the purpose of slash commands.
     *
     * **DO NOT MANUALLY POPULATE THIS OBJECT.**
     *
     * @type {object[]}
     */
    public static JsonCommands: RESTPostAPIApplicationCommandsJSONBody[];
    public static Rest: REST;
    private readonly _config: IConfiguration;
    private readonly _bot: Client;
    private _eventsIsStarted: boolean = false;
    public readonly instanceStarted: Date;

    /**
     * Constructs a new Discord bot.
     *
     * @param {IConfiguration} config The configuration file.
     * @throws {Error} If a command name was registered twice or if `data.name` is not equal to `botCommandName`.
     */
    public constructor(config: IConfiguration | null) {
        if (!config) {
            throw new Error("No config file given.");
        }

        Bot.BotInstance = this;
        this.instanceStarted = new Date();
        this._config = config;
        this._bot = new Client({
            partials: [
                "MESSAGE",
                "CHANNEL",
                "GUILD_MEMBER",
            ],
            intents: [
                "GUILDS",
                "GUILD_MESSAGES"
            ],
            ws: {
                properties: {
                    $browser: "Discord iOS"
                }
            }
        });
        Bot.Commands = new Collection<string, Cmds.BaseCommand[]>();
        Bot.Commands.set("General", [
            new Cmds.Help(),
            new Cmds.Ping(),
            new Cmds.Status(),
            new Cmds.MTS()
        ]);

        Bot.Commands.set("Doomers Only", [
            new Cmds.Spam(),
            new Cmds.SetActivity(),
            new Cmds.AddQuoteMessageLink(),
            new Cmds.AddQuoteText(),
            new Cmds.AddStrangerQuote(),
            new Cmds.GetRandomQuote(),
            new Cmds.BadnessLevel(),
            new Cmds.SetDadPercent()
        ]);

        Bot.Commands.set("Enrollment Data", [
            new Cmds.GetOverallEnroll(),
            new Cmds.GetSectionEnroll(),
            new Cmds.LookupLive(),
            new Cmds.GetCape(),
            new Cmds.LookupCached(),
            new Cmds.LiveSeats(),
        ]);

        Bot.Commands.set("UCSD", [
            new Cmds.ViewAllClassrooms(),
            new Cmds.CheckRoom(),
            new Cmds.Waitz(),
            new Cmds.CourseInfo(),
            new Cmds.FreeRooms()
        ]);

        Bot.Commands.set("Owner Only", [
            new Cmds.Exec()
        ]);

        Bot.JsonCommands = [];
        Bot.NameCommands = new Collection<string, Cmds.BaseCommand>();
        Bot.Rest = new REST({version: "9"}).setToken(config.token.botToken);
        for (const command of Array.from(Bot.Commands.values()).flat()) {
            Bot.JsonCommands.push(command.data.toJSON() as RESTPostAPIApplicationCommandsJSONBody);

            if (command.data.name !== command.commandInfo.botCommandName)
                throw new Error(`Names not matched: "${command.data.name}" - "${command.commandInfo.botCommandName}"`);

            if (Bot.NameCommands.has(command.data.name))
                throw new Error(`Duplicate command "${command.data.name}" registered.`);

            Bot.NameCommands.set(command.data.name, command);
        }
    }

    /**
     * Returns the Discord client.
     *
     * @returns {Client} The client.
     */
    public get client(): Client {
        return this._bot;
    }

    /**
     * Returns the Configuration object.
     *
     * @returns {IConfiguration} The configuration object.
     */
    public get config(): IConfiguration {
        return this._config;
    }

    /**
     * Defines all necessary events for the bot to work.
     */
    public startAllEvents(): void {
        if (this._eventsIsStarted) {
            return;
        }

        this._bot.on("messageCreate",  (m) => onMessage(m));
        this._bot.on("ready",  () => onReadyEvent());
        this._bot.on("interactionCreate",  (i: Interaction) => onInteractionEvent(i));
        this._bot.on("error",  (e: Error) => onErrorEvent(e));
        this._eventsIsStarted = true;
    }

    /**
     * Logs into the bot and connects to the database.
     */
    public async login(): Promise<void> {
        if (!this._eventsIsStarted) {
            this.startAllEvents();
        }

        await this._bot.login(this._config.token.botToken);

        if (this._config.isProd) {
            await Bot.Rest.put(
                Routes.applicationCommands(this._config.clientId),
                {body: Bot.JsonCommands}
            );
        }
        else {
            await Promise.all(
                this._bot.guilds.cache.map(async guild => {
                    await Bot.Rest.put(
                        Routes.applicationGuildCommands(this._config.clientId, guild.id),
                        {body: Bot.JsonCommands}
                    );
                })
            );
        }
    }
}