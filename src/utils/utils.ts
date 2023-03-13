import log4js from 'log4js';

log4js.configure({
    appenders: { 
        console: { type: "console" },
        usage: { type: "file", filename: "logs/usage.log" },
        gpt: { type: "file", filename: "logs/gpt.log"}
    },
    categories: { 
        default: { 
            appenders: ["console"], level: "debug",
        },
        gpt: {
            appenders: ["console","gpt"], level: "error",
        },
        usage: {
            appenders: ["console","usage"], level: "info",
        },
    },
});

export const sleep = async (ms:number) => new Promise(resolve => setTimeout(resolve, ms));

export const logger = (name:string) => log4js.getLogger(name);

export const emptyOr = (...args:any[]) => args.find( arg => arg !== undefined && arg !== null && !Number.isNaN(arg));