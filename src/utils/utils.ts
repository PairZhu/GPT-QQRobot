import log4js from 'log4js';
import fs from 'fs';
import readline from "readline";

log4js.configure({
    appenders: {
        console: { type: "console" },
        usage: { type: "file", filename: "logs/usage.log" },
        gpt: { type: "file", filename: "logs/gpt.log" }
    },
    categories: {
        default: {
            appenders: ["console"], level: "debug",
        },
        gpt: {
            appenders: ["console", "gpt"], level: "error",
        },
        usage: {
            appenders: ["console", "usage"], level: "info",
        },
    },
});

export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const logger = (name: string) => log4js.getLogger(name);

export const emptyOr = (...args: any[]) => args.find(arg => arg !== undefined && arg !== null && !Number.isNaN(arg));

export const readLineFile = async (filename: string) => {
    const res = []
    if (!fs.existsSync('config')) {
        fs.mkdirSync('config');
    }
    if (!fs.existsSync(`config/${filename}`)) {
        fs.writeFileSync(`config/${filename}`, '');
    }
    // 一行一个key，忽略空行和空格
    const lineReader = readline.createInterface({
        input: fs.createReadStream(`config/${filename}`)
    });
    lineReader.on('line', (line) => {
        if (line.trim() !== '') {
            res.push(line.trim());
        }
    });
    await new Promise<void>(resolve => lineReader.on('close', () => resolve()));
    return res;
}

export const writeLineFile = (filename: string, lines: string[]) => {
    if (!fs.existsSync('config')) {
        fs.mkdirSync('config');
    }
    const data = lines.join('\n');
    return new Promise<void>(resolve => {
        fs.writeFile(`config/${filename}`, data, (err)=>{
            if (err) {
                logger('setting').error(err);
            }
            resolve();
        });
    })
}

