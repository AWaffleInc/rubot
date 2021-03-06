import {BaseCommand, ICommandContext} from "../BaseCommand";
import {MutableConstants} from "../../constants/MutableConstants";
import {PLOT_ARGUMENTS, parseCourseSubjCode} from "./helpers/Helper";
import {Collection, MessageEmbed} from "discord.js";
import {IGitContent} from "../../definitions";

export class GetOverallEnroll extends BaseCommand {
    public constructor() {
        super({
            cmdCode: "GET_OVERALL_ENROLL",
            formalCommandName: "Get Overall Enrollment Graph",
            botCommandName: "overallplot",
            description: "Gets the enrollment chart for all sections for a particular course.",
            generalPermissions: [],
            botPermissions: [],
            commandCooldown: 5 * 1000,
            argumentInfo: PLOT_ARGUMENTS,
            guildOnly: false,
            botOwnerOnly: false
        });
    }

    /**
     * @inheritDoc
     */
    public async run(ctx: ICommandContext): Promise<number> {
        const term = ctx.interaction.options.getString("term", true);
        const code = ctx.interaction.options.getString("course_subj_num", true);
        const searchType = ctx.interaction.options.getString("search_type", false) ?? "norm";

        let coll: Readonly<Collection<string, IGitContent[]>>;
        let display: string;
        switch (searchType) {
            case "wide":
                coll = MutableConstants.OVERALL_ENROLL_WIDE;
                display = "Wide";
                break;
            case "fsp":
                coll = MutableConstants.OVERALL_ENROLL_FSP;
                display = "First/Second Pass";
                break;
            default:
                // "norm" is the default
                coll = MutableConstants.OVERALL_ENROLL;
                display = "Normal";
                break;
        }

        const arr = coll.get(term);
        if (!arr) {
            await ctx.interaction.reply({
                content: `The term, **\`${term}\`** (Display \`${display}\`), could not be found. Try again.`,
                ephemeral: true
            });

            return -1;
        }

        const parsedCode = parseCourseSubjCode(code);
        const res = arr.find(x => x.name.replace(".png", "") === parsedCode);
        if (!res) {
            await ctx.interaction.reply({
                content: `The course, **\`${parsedCode}\`**, (term **\`${term}\`** & display \`${display}\`) could not`
                    + " be found. Try again.",
                ephemeral: true
            });

            return -1;
        }

        await ctx.interaction.deferReply();
        await ctx.interaction.editReply({
            files: [res.download_url],
            content: `Course **\`${parsedCode}\`** (Term **\`${term}\`**, Display \`${display}\`)`
        });

        return 0;
    }
}