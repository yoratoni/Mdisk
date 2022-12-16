import colors from "colors";

// import { LOGGER_PREFIX, VERBOSE } from "configs/constants";


export default class Logger {
    static title(message: string) {
        console.log(colors.bold(`------------------ ${message} ------------------`));
    }
}