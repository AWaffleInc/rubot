import { Collection } from "discord.js";
import { ICapeRow, IGitContent, ListedCourse, Meeting, WebRegSection } from "../definitions";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import * as path from "path";
import { TimeUtilities } from "../utilities/TimeUtilities";
import { AxiosRequestConfig } from "axios";
import { Bot } from "../Bot";
import { GeneralUtilities } from "../utilities/GeneralUtilities";
import { StringBuilder } from "../utilities/StringBuilder";

export namespace MutableConstants {
    export const ENROLL_DATA_GH: string = "https://github.com/ewang2002/UCSDHistEnrollData";

    // All active webreg terms (accessible on the rocket web server)
    export const WEBREG_TERMS: {
        term: string;
        termName: string;
        paddedName: string;
    }[] = [
            // Default term should be the first one.
            {
                term: "FA22",
                termName: "Fall 2022",
                paddedName: "Fall 2022              "
            },
            {
                term: "S122",
                termName: "Summer Session I 2022",
                paddedName: "Summer Session I 2022  "
            },
            {
                term: "S222",
                termName: "Summer Session II 2022",
                paddedName: "Summer Session II 2022 "
            },
            {
                term: "S322",
                termName: "Summer Session III 2022",
                paddedName: "Summer Session III 2022"
            }
        ];

    export const DEFAULT_TERM: string = MutableConstants.WEBREG_TERMS[0].term;

    // Terms that we have github data for.
    export const GH_TERMS: {
        term: string;
        termName: string;
        overall: {
            reg: boolean;
            fsp: boolean;
            wide: boolean;
        };
        section: {
            reg: boolean;
            fsp: boolean;
            wide: boolean;
        };
    }[] = [
            {
                term: "SP22",
                termName: "Spring 2022",
                overall: {
                    reg: true,
                    fsp: true,
                    wide: true
                },
                section: {
                    reg: true,
                    fsp: true,
                    wide: true
                }
            },
            {
                term: "SP22D",
                termName: "Spring 2022 (Post-Enrollment)",
                overall: {
                    reg: true,
                    fsp: false,
                    wide: false
                },
                section: {
                    reg: true,
                    fsp: false,
                    wide: false
                }
            },
            {
                term: "S122",
                termName: "Summer Session I 2022",
                overall: {
                    reg: true,
                    fsp: false,
                    wide: false
                },
                section: {
                    reg: true,
                    fsp: false,
                    wide: false
                }
            },
            {
                term: "S222",
                termName: "Summer Session II 2022",
                overall: {
                    reg: true,
                    fsp: false,
                    wide: false
                },
                section: {
                    reg: true,
                    fsp: false,
                    wide: false
                }
            },
            {
                term: "FA22",
                termName: "Fall 2022",
                overall: {
                    reg: true,
                    fsp: false,
                    wide: false
                },
                section: {
                    reg: true,
                    fsp: false,
                    wide: false
                }
            },
        ];

    export const OVERALL_ENROLL: Collection<string, IGitContent[]> = new Collection<string, IGitContent[]>();
    export const OVERALL_ENROLL_WIDE: Collection<string, IGitContent[]> = new Collection<string, IGitContent[]>();
    export const OVERALL_ENROLL_FSP: Collection<string, IGitContent[]> = new Collection<string, IGitContent[]>();
    export const SECTION_ENROLL: Collection<string, IGitContent[]> = new Collection<string, IGitContent[]>();
    export const SECTION_ENROLL_WIDE: Collection<string, IGitContent[]> = new Collection<string, IGitContent[]>();
    export const SECTION_ENROLL_FSP: Collection<string, IGitContent[]> = new Collection<string, IGitContent[]>();
    export const CAPE_DATA: ICapeRow[] = [];
    export const SECTION_TERM_DATA: WebRegSection[] = [];
    export const COURSE_LISTING: ListedCourse[] = [];
    export const LISTING_LAST_SCRAPED: string = "May 15, 2022";

    export const BUS_STOPS: {
        [stopId: string]: {
            stopName: string;
        }
    } = {};

    export const BUS_ROUTES: {
        [stopId: string]: {
            routeShortName: string;
            routeLongName: string;
            routeColor: number;
            routeUrl: string;
        }
    } = {};

    export const TRIP_DATA_ID: {
        [tripId: string]: {
            routeId: string;
            directionName: string;
        }
    } = {};

    export const STOP_TIME: {
        [tripId: string]: {
            arrivalTime: string;
            stopId: string;
        }[];
    } = {};

    // Term that we have section (cached) data for. We should only have one active term at any point.
    export let CACHED_DATA_TERM: string = "";

    /**
     * Adds the section data to the above array.
     * @param {string} term The term.
     * @param {string} [pathToFile] The path to the section file, if any.
     */
    export function initSectionData(term: string, pathToFile?: string): void {
        CACHED_DATA_TERM = term;

        const pathToRead = pathToFile ?? path.join(__dirname, "..", "..", `${CACHED_DATA_TERM}.tsv`);
        const readStream = createReadStream(pathToRead);
        const rl = createInterface(readStream);
        let firstLinePassed = false;
        rl.on("line", line => {
            if (!firstLinePassed) {
                firstLinePassed = true;
                return;
            }

            const rawData = line.split("\t");
            if (rawData.length !== 6) {
                console.error(`Bad line read for section data; got ${rawData.length} but expected 5.`);
                return;
            }

            const [
                subjCourseId,
                sectionCode,
                sectionId,
                instructor,
                totalSeats,
                meetings
            ] = rawData;

            const allMeetings: (Meeting | null)[] = meetings.split("|")
                .map(x => {
                    const meeting = x.split(",");
                    if (meeting.length !== 4) {
                        console.error(`Bad meeting read - ${sectionId}`);
                        return null;
                    }

                    const [
                        meetingType,
                        rawMeetingDays,
                        rawTimes,
                        rawLocation
                    ] = meeting;

                    // Parse meeting days first.
                    let meetingDays: string[] | string;
                    if (rawMeetingDays.includes("-")) {
                        meetingDays = rawMeetingDays;
                    }
                    else {
                        meetingDays = TimeUtilities.getAllDays(rawMeetingDays);
                    }

                    const times = rawTimes.split(/:| - /).map(x => Number.parseInt(x, 10));
                    if (times.length !== 4) {
                        console.error(`Bad meeting time read - ${sectionId}`);
                        return null;
                    }

                    const [startHr, startMin, endHr, endMin] = times;
                    const splitLocation = rawLocation.split(" ");
                    let building;
                    let room = "";
                    if (splitLocation.length === 2) {
                        building = splitLocation[0];
                        room = splitLocation[1];
                    }
                    else if (splitLocation.length < 2) {
                        building = splitLocation[0];
                        console.warn(`Weird location - ${sectionId}`);
                    }
                    else {
                        building = splitLocation.shift()!;
                        room = splitLocation.join(" ");
                    }


                    return {
                        meeting_type: meetingType,
                        meeting_days: meetingDays,
                        start_hr: startHr,
                        start_min: startMin,
                        end_hr: endHr,
                        end_min: endMin,
                        building,
                        room
                    };
                });

            SECTION_TERM_DATA.push({
                available_seats: -1,
                enrolled_ct: -1,
                all_instructors: instructor.split(" & "),
                meetings: allMeetings.filter(x => x !== null) as Meeting[],
                needs_waitlist: false,
                section_code: sectionCode,
                section_id: sectionId,
                subj_course_id: subjCourseId,
                total_seats: Number.parseInt(totalSeats, 10),
                waitlist_ct: -1
            });
        });

        rl.on("close", () => {
            console.info(`Done reading SECTION. Data length: ${CAPE_DATA.length}`);
        });
    }

    /**
     * Adds the CAPE data to the above array.
     * @param {string} [pathToFile] The path to the CAPE file, if any.
     */
    export function initCapeData(pathToFile?: string): void {
        const pathToRead = pathToFile ?? path.join(__dirname, "..", "..", "cape.tsv");
        const readStream = createReadStream(pathToRead);
        const rl = createInterface(readStream);

        let firstLinePassed = false;
        rl.on("line", line => {
            if (!firstLinePassed) {
                firstLinePassed = true;
                return;
            }

            const rawData = line.split("\t");
            if (rawData.length !== 11) {
                console.error(`Bad line read for CAPE data; got ${rawData.length} but expected 11.`)
                return;
            }

            const [
                instructor,
                subCourse,
                course,
                term,
                enroll,
                evalsMade,
                rcmdClass,
                rcmdInstr,
                studyHrWk,
                avgGradeExp,
                avgGradeRec
            ] = rawData;

            CAPE_DATA.push({
                instructor,
                subjectCourse: subCourse,
                courseName: course,
                term,
                enrollmentCount: Number.parseFloat(enroll),
                evaluationsMade: Number.parseFloat(evalsMade),
                recommendedClass: Number.parseFloat(rcmdClass),
                recommendedInstructor: Number.parseFloat(rcmdInstr),
                studyHourWeek: Number.parseFloat(studyHrWk),
                averageGradeExp: Number.parseFloat(avgGradeExp),
                averageGradeRec: Number.parseFloat(avgGradeRec)
            });
        });

        rl.on("close", () => {
            console.info(`Done reading CAPEs. Data length: ${CAPE_DATA.length}`);
        });
    }

    /**
     * Adds the course listing data to the above array.
     * @param {string} pathToFile The path to the course listing file, if any.
     */
    export function initCourseListing(pathToFile?: string): void {
        const pathToRead = pathToFile ?? path.join(__dirname, "..", "..", "courses.tsv");
        const readStream = createReadStream(pathToRead);
        const rl = createInterface(readStream);

        let firstLinePassed = false;
        rl.on("line", line => {
            if (!firstLinePassed) {
                firstLinePassed = true;
                return;
            }

            const rawData = line.split("\t");
            if (rawData.length !== 5) {
                console.error(`Bad line read for course listing data; got ${rawData.length} but expected 5.`)
                return;
            }

            const [
                department,
                subjCourse,
                courseName,
                units,
                description
            ] = rawData;

            COURSE_LISTING.push({
                department,
                courseName,
                subjCourse,
                units,
                description
            });
        });

        rl.on("close", () => {
            console.info(`Done reading course listing. Data length: ${COURSE_LISTING.length}`);
        });
    }

    /**
     * Adds the bus stop data to the above object.
     * @param {string} pathToFile The path to the bus stop file, if any.
     */
    export function initBusStops(pathToFile?: string): void {
        const pathToRead = pathToFile ?? path.join(__dirname, "..", "..", "mts_stops.csv");
        const readStream = createReadStream(pathToRead);
        const rl = createInterface(readStream);

        let numRead = 0;
        let firstLinePassed = false;
        rl.on("line", line => {
            if (!firstLinePassed) {
                firstLinePassed = true;
                return;
            }

            const rawData = line.split(",");
            if (rawData.length !== 13) {
                console.error(`Bad line read for bus stop data; got ${rawData.length} but expected 13.`)
                return;
            }

            const [
                stopId,
                stopName
            ] = rawData;

            BUS_STOPS[stopId] = { stopName };
            numRead++;
        });

        rl.on("close", () => {
            console.info(`Done reading bus stop data. Data length: ${numRead}`);
        });
    }

    /**
     * Adds the bus route data to the above object.
     * @param {string} pathToFile The path to the bus route file, if any.
     */
    export function initBusRoutes(pathToFile?: string): void {
        const pathToRead = pathToFile ?? path.join(__dirname, "..", "..", "mts_routes.csv");
        const readStream = createReadStream(pathToRead);
        const rl = createInterface(readStream);

        let numRead = 0;
        let firstLinePassed = false;
        rl.on("line", line => {
            if (!firstLinePassed) {
                firstLinePassed = true;
                return;
            }

            const rawData = line.split(",");
            if (rawData.length !== 11) {
                console.error(`Bad line read for bus route data; got ${rawData.length} but expected 11.`)
                return;
            }

            const [
                routeId,
                routeShortName,
                routeLongName, , , ,
                routeUrl,
                routeColor, , ,
            ] = rawData;

            BUS_ROUTES[routeId] = {
                routeShortName,
                routeLongName,
                routeColor: Number.parseInt("0x" + routeColor, 16),
                routeUrl
            };
            numRead++;
        });

        rl.on("close", () => {
            console.info(`Done reading bus route data. Data length: ${numRead}`);
        });
    }


    /**
     * Adds the bus trip data to the above object.
     * @param {string} pathToFile The path to the bus trip file, if any.
     */
    export function initBusTrips(pathToFile?: string): void {
        const pathToRead = pathToFile ?? path.join(__dirname, "..", "..", "mts_trips.csv");
        const readStream = createReadStream(pathToRead);
        const rl = createInterface(readStream);

        let numRead = 0;
        let firstLinePassed = false;
        rl.on("line", line => {
            if (!firstLinePassed) {
                firstLinePassed = true;
                return;
            }

            const rawData = line.split(",");
            if (rawData.length !== 11) {
                console.error(`Bad line read for bus trip data; got ${rawData.length} but expected 11.`)
                return;
            }

            const [
                routeId, ,
                tripId,
                tripHeadsign,
            ] = rawData;

            TRIP_DATA_ID[tripId] = {
                directionName: tripHeadsign.substring(1, tripHeadsign.length - 1),
                routeId
            };
            numRead++;
        });

        rl.on("close", () => {
            console.info(`Done reading bus trip data. Data length: ${numRead}`);
        });
    }


    /**
     * Adds the bus trip data to the above object.
     * @param {string} pathToFile The path to the stop time file, if any.
     */
    export function initStopTimes(pathToFile?: string): void {
        const pathToRead = pathToFile ?? path.join(__dirname, "..", "..", "mts_stop_times.csv");
        const readStream = createReadStream(pathToRead);
        const rl = createInterface(readStream);

        let numRead = 0;
        let firstLinePassed = false;
        rl.on("line", line => {
            if (!firstLinePassed) {
                firstLinePassed = true;
                return;
            }

            const rawData = line.split(",");
            if (rawData.length !== 13) {
                console.error(`Bad line read for stop time data; got ${rawData.length} but expected 13.`)
                return;
            }

            const [
                tripId,
                arrivalTime, ,
                stopId,
            ] = rawData;

            if (!(tripId in STOP_TIME)) {
                STOP_TIME[tripId] = [];
            }

            STOP_TIME[tripId].push({
                arrivalTime,
                stopId
            });
            numRead++;
        });

        rl.on("close", () => {
            console.info(`Done reading stop time data. Data length: ${numRead}`);
        });
    }

    /**
     * Adds the enrollment graph data to the above collections.
     */
    export async function initEnrollmentData(): Promise<void> {
        const baseUrl = new StringBuilder()
            .append("https://api.github.com/repos/")
            .append(Bot.BotInstance.config.enrollData.repoOwner)
            .append("/")
            .append(Bot.BotInstance.config.enrollData.repoName)
            .append("/contents")
            .toString();

        const requestHeader: AxiosRequestConfig = {
            headers: {
                "User-Agent": "rubot (ewang2002)"
            }
        };

        for await (const { term, ...o } of GH_TERMS) {
            if (o.overall.reg) {
                const overall = await GeneralUtilities.tryExecuteAsync<IGitContent[]>(async () => {
                    const res = await Bot.AxiosClient.get(`${baseUrl}/${term}/plot_overall`, requestHeader);
                    return res.data;
                });

                // OVERALL
                if (overall) {
                    OVERALL_ENROLL.set(term, overall.filter(x => x.name.endsWith(".png")));
                }
                else {
                    console.error(`Could not get overall data for ${term}.`);
                }
            }


            if (o.overall.fsp) {
                // Overall (first/second pass)
                const overallFsp = await GeneralUtilities.tryExecuteAsync<IGitContent[]>(async () => {
                    const res = await Bot.AxiosClient.get(`${baseUrl}/${term}/plot_overall_fsp`, requestHeader);
                    return res.data;
                });

                if (overallFsp) {
                    OVERALL_ENROLL_FSP.set(term, overallFsp.filter(x => x.name.endsWith(".png")));
                }
            }


            if (o.overall.wide) {
                // Overall (wide)
                const overallWide = await GeneralUtilities.tryExecuteAsync<IGitContent[]>(async () => {
                    const res = await Bot.AxiosClient.get(`${baseUrl}/${term}/plot_overall_wide`, requestHeader);
                    return res.data;
                });

                if (overallWide) {
                    OVERALL_ENROLL_WIDE.set(term, overallWide.filter(x => x.name.endsWith(".png")));
                }
            }


            if (o.section.reg) {
                // SECTION
                const section = await GeneralUtilities.tryExecuteAsync<IGitContent[]>(async () => {
                    const res = await Bot.AxiosClient.get(`${baseUrl}/${term}/plot_section`, requestHeader);
                    return res.data;
                });

                if (section) {
                    SECTION_ENROLL.set(term, section.filter(x => x.name.endsWith(".png")));
                }
                else {
                    console.error(`Could not get section data for ${term}.`);
                }
            }


            if (o.section.fsp) {
                // Section (first/second pass)
                const sectionFsp = await GeneralUtilities.tryExecuteAsync<IGitContent[]>(async () => {
                    const res = await Bot.AxiosClient.get(`${baseUrl}/${term}/plot_section_fsp`, requestHeader);
                    return res.data;
                });

                if (sectionFsp) {
                    SECTION_ENROLL_FSP.set(term, sectionFsp.filter(x => x.name.endsWith(".png")));
                }
            }


            if (o.section.wide) {
                // Section (wide)
                const sectionWide = await GeneralUtilities.tryExecuteAsync<IGitContent[]>(async () => {
                    const res = await Bot.AxiosClient.get(`${baseUrl}/${term}/plot_section_wide`, requestHeader);
                    return res.data;
                });

                if (sectionWide) {
                    SECTION_ENROLL_WIDE.set(term, sectionWide.filter(x => x.name.endsWith(".png")));
                }
            }
        }
    }
}