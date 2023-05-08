import { createLogger, format, transports } from "winston";

import { GENERAL_CONFIG } from "configs/config";


/**
 * Logger format.
 */
const loggerFormat = format.combine(
    format.timestamp({
        format: GENERAL_CONFIG.dateFormat
    }),
    format.printf((info) => {
        return `[${info.timestamp}] [${info.level.toUpperCase()}] ${
            info.message
        }`;
    }),
    format.colorize({
        all: true,
    })
);

/**
 * Logger level.
 */
let loggerLevel = "info";
if (GENERAL_CONFIG.verbose) {
    loggerLevel = "silly";
}

/**
 * Winston general formatted logger.
 */
const logger = createLogger({
    format: loggerFormat,
    transports: [
        new transports.Console({ level: loggerLevel })
    ],
});


export default logger;