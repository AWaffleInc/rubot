import {ArgumentType, BaseCommand, IArgumentInfo, ICommandContext, ICommandInfo} from "../BaseCommand";
import {Bot} from "../../Bot";
import {StringUtil} from "../../utilities/StringUtilities";
import {ArrayUtilities} from "../../utilities/ArrayUtilities";
import {StringBuilder} from "../../utilities/StringBuilder";
import {GeneralUtilities} from "../../utilities/GeneralUtilities";

export class Help extends BaseCommand {
    public constructor() {
        const cmi: ICommandInfo = {
            cmdCode: "HELP",
            formalCommandName: "Help",
            botCommandName: "help",
            description: "Runs the help command. This lists all commands.",
            generalPermissions: [],
            botPermissions: [],
            argumentInfo: [
                {
                    displayName: "Command Name",
                    argName: "command",
                    desc: "The command to find help information for.",
                    type: ArgumentType.String,
                    prettyType: "String",
                    required: false,
                    example: ["help", "startafkcheck"]
                }
            ],
            commandCooldown: 4 * 1000,
            guildOnly: false,
            botOwnerOnly: false
        };

        super(cmi);
    }

    /**
     * @inheritDoc
     */
    public async run(ctx: ICommandContext): Promise<number> {
        const cmdName = ctx.interaction.options.getString("command");
        let showCmdHelp = false;

        if (cmdName) {
            const command = Bot.NameCommands.get(cmdName);
            if (command) {
                const cmdHelpEmbed = GeneralUtilities.generateBlankEmbed(ctx.user, "GREEN")
                    .setTitle(`Command Help: **${command.commandInfo.formalCommandName}**`)
                    .setFooter({
                        text: `Server Context: ${ctx.guild?.name ?? "Direct Message"}`
                    })
                    .setDescription(command.commandInfo.description)
                    .addField("Command Code", StringUtil.codifyString(command.commandInfo.botCommandName))
                    .addField(
                        "Guild Only?",
                        StringUtil.codifyString(command.commandInfo.guildOnly ? "Yes" : "No"),
                        true
                    )
                    .addField(
                        "Bot Owner Only?",
                        StringUtil.codifyString(command.commandInfo.botOwnerOnly ? "Yes" : "No"),
                        true
                    )
                    .addField(
                        "Discord User Permissions Needed (??? 1)",
                        StringUtil.codifyString(
                            command.commandInfo.generalPermissions.length > 0
                                ? command.commandInfo.generalPermissions.join(", ")
                                : "N/A."
                        )
                    )
                    .addField(
                        "Discord Bot Permissions Needed (??? 1)",
                        StringUtil.codifyString(
                            command.commandInfo.botPermissions.length > 0
                                ? command.commandInfo.botPermissions
                                : "N/A."
                        )
                    );

                const argDisplay = ArrayUtilities.arrayToStringFields<IArgumentInfo>(
                    command.commandInfo.argumentInfo,
                    (_, elem) => {
                        return new StringBuilder()
                            .append(`__Argument__: ${elem.displayName} (\`${elem.argName}\`)`).appendLine()
                            .append(`- ${elem.desc}`).appendLine()
                            .append(`- Required? ${elem.required ? "Yes" : "No"}`).appendLine()
                            .append(`- Example(s): \`[${elem.example.join(", ")}]\``).appendLine(2)
                            .toString();
                    }
                );

                for (const d of argDisplay) {
                    cmdHelpEmbed.addField(`Argument Information (${command.commandInfo.argumentInfo.length})`, d);
                }

                await ctx.interaction.reply({
                    embeds: [cmdHelpEmbed]
                });

                return 0;
            }

            showCmdHelp = true;
        }

        const helpEmbed = GeneralUtilities.generateBlankEmbed(ctx.user, "GREEN")
            .setTitle("Command List")
            .setFooter({
                text: `Server Context: ${ctx.guild?.name ?? "Direct Messages"}`
            })
            .setDescription(
                showCmdHelp
                    ? `The command, \`${cmdName}\`, could not be found. Try looking through the list below.`
                    : "Below is a list of all supported commands."
            );

        for (const [category, commands] of Bot.Commands) {
            helpEmbed.addField(
                category,
                StringUtil.codifyString(
                    commands.filter(x => x.hasPermissionToRun(ctx.user, ctx.guild))
                        .map(x => x.commandInfo.botCommandName)
                        .join(", ")
                )
            );
        }

        await ctx.interaction.reply({
            embeds: [helpEmbed]
        });
        return 0;
    }
}