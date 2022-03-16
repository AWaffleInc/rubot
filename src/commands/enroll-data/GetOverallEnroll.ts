import {ArgumentType, BaseCommand, ICommandContext} from "../BaseCommand";
import {Bot} from "../../Bot";
import {Constants} from "../../Constants";

export class GetOverallEnroll extends BaseCommand {
    public constructor() {
        super({
            cmdCode: "GET_OVERALL_ENROLL",
            formalCommandName: "Get Overall Enrollment Graph",
            botCommandName: "getoverall",
            description: "Gets the enrollment chart for all sections for a particular course.",
            generalPermissions: [],
            botPermissions: [],
            commandCooldown: 3 * 1000,
            argumentInfo: [
                {
                    displayName: "Term",
                    argName: "term",
                    type: ArgumentType.String,
                    restrictions: {
                        stringChoices: Bot.BotInstance.config.enrollData.terms.map(x => {
                            return [x, x];
                        })
                    },
                    prettyType: "String",
                    desc: "The term to get the graph for.",
                    required: true,
                    example: ["SP22"]
                },
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
        const term = ctx.interaction.options.getString("term", true);
        const code = ctx.interaction.options.getString("course_subj_num", true);

        const arr = Constants.OVERALL_ENROLL.get(term);
        if (!arr) {
            await ctx.interaction.reply({
                content: `The term, **\`${term}\`**, could not be found. Try again.`,
                ephemeral: true
            });

            return -1;
        }

        const parsedCode = GetOverallEnroll.parseCourseSubjCode(code);
        const res = arr.find(x => x.name.replace(".png", "") === parsedCode);
        if (!res) {
            await ctx.interaction.reply({
                content: `The course, **\`${parsedCode}\`**, (term **\`${term}\`**) could not be found. Try again.`,
                ephemeral: true
            });

            return -1;
        }

        await ctx.interaction.reply({
            files: [res.download_url],
            content: `Course **\`${parsedCode}\`** (Term **\`${term}\`**)`
        });

        return 0;
    }

    /**
     * Parses the course subject code from a given string.
     * @param {string} code The raw course subject code.
     * @returns {string} The parsed course subject code.
     */
    public static parseCourseSubjCode(code: string): string {
        let s = "";
        let i = 0;
        for (; i < code.length; i++) {
            // Regex to see if it's a number
            if (/^\d+$/.test(code[i])) {
                break;
            }

            if (code[i] === " ") {
                continue;
            }

            s += code[i];
        }

        s += " ";

        for (; i < code.length; i++) {
            s += code[i];
        }

        return s.toUpperCase().trim();
    }
}