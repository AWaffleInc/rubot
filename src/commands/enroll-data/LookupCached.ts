import {ArgumentType, BaseCommand, ICommandContext} from "../BaseCommand";
import {displayInteractiveWebregData, parseCourseSubjCode} from "./helpers/Helper";
import {MutableConstants} from "../../constants/MutableConstants";

export class LookupCached extends BaseCommand {
    public constructor() {
        super({
            cmdCode: "LOOKUP_CACHED",
            formalCommandName: "Lookup Cached Data",
            botCommandName: "lookupcached",
            description: "Looks up a course data from the cache. This will only get the course data for the current" +
                " active term.",
            generalPermissions: [],
            botPermissions: [],
            commandCooldown: 5 * 1000,
            argumentInfo: [
                {
                    displayName: "Course & Subject Code",
                    argName: "course_subj_num",
                    type: ArgumentType.String,
                    prettyType: "String",
                    desc: "The course subject code.",
                    required: true,
                    example: ["CSE 100", "MATH100A"]
                }
            ],
            guildOnly: false,
            botOwnerOnly: false
        });
    }

    /**
     * @inheritDoc
     */
    public async run(ctx: ICommandContext): Promise<number> {
        const code = ctx.interaction.options.getString("course_subj_num", true);
        const parsedCode = parseCourseSubjCode(code);
        if (parsedCode.indexOf(" ") === -1) {
            await ctx.interaction.reply({
                content: `Your input, \`${code}\`, is improperly formatted. It should look like \`SUBJ XXX\`.`,
                ephemeral: true
            });

            return -1;
        }

        await ctx.interaction.deferReply();
        const data = MutableConstants.SECTION_TERM_DATA.filter(x => x.subj_course_id === parsedCode);
        if (data.length === 0) {
            await ctx.interaction.editReply({
                content: `No data was found for **\`${parsedCode}\`** (Term: \`${MutableConstants.CACHED_DATA_TERM}\`).`
            });

            return 0;
        }

        await displayInteractiveWebregData(ctx, data, MutableConstants.CACHED_DATA_TERM, parsedCode, false);
        return 0;
    }
}