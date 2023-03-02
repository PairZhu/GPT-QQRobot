import { Configuration, OpenAIApi } from "openai";
import fs from "fs";
import readline from "readline";
import { emptyOr, logger } from "./utils/utils.js";
import { CONSTANT } from "./utils/constant.js";

export class GPT3 {
    private openai: OpenAIApi;
    private apiKeys: Array<string> = [];
    private apiKeyIndex: number = 0;
    private maxTokens = emptyOr(global.db.get('maxTokens'), parseInt(process.env.DEFAULT_MAX_TOKENS), CONSTANT.DEFAULT_MAX_TOKENS);


    async init(): Promise<boolean> {
        if (!fs.existsSync('config')) {
            fs.mkdirSync('config');
        }
        if (!fs.existsSync('config/api_keys.txt')) {
            fs.writeFileSync('config/api_keys.txt', '');
        }
        // 一行一个key，忽略空行和空格
        const lineReader = readline.createInterface({
            input: fs.createReadStream('config/api_keys.txt')
        });
        lineReader.on('line', (line) => {
            if (line.trim() !== '') {
                this.apiKeys.push(line.trim());
            }
        });
        await new Promise<void>(resolve => lineReader.on('close', () => resolve()));
        if (this.apiKeys.length === 0) {
            logger('gpt3').error('没有发现API Key，请在config/api_keys.txt中添加');
            return false;
        }
        logger('usage').info(`当前使用的API Key为${this.apiKeys[this.apiKeyIndex]}`);
        this.openai = new OpenAIApi(new Configuration({
            apiKey: this.apiKeys[this.apiKeyIndex]
        }));
        return true;
    }

    addKey(key: string) {
        this.apiKeys.push(key);
        fs.writeFileSync('config/api_keys.txt', this.apiKeys.join('\n'));
    }

    deleteKey(key: string) {
        this.apiKeys = this.apiKeys.filter(k => k !== key);
        fs.writeFileSync('config/api_keys.txt', this.apiKeys.join('\n'));
    }

    getKeys(): Array<string> {
        return this.apiKeys;
    }

    async textCompletion(params: Object) {
        while (this.apiKeyIndex < this.apiKeys.length) {
            try {
                const { data } = await this.openai.createCompletion({
                    model: 'text-davinci-003',
                    max_tokens: this.maxTokens,
                    ...params,
                });
                return ({
                    text: data.choices[0].text.trim(),
                    usage: data.usage
                });
            } catch (e) {
                logger('gpt3').error(`apiKey(${this.apiKeys[this.apiKeyIndex]})请求失败，错误信息：${e.message}`);
                this.apiKeyIndex++;
                logger('usage').info(`切换API Key为${this.apiKeys[this.apiKeyIndex]}`);
                this.openai = new OpenAIApi(new Configuration({
                    apiKey: this.apiKeys[this.apiKeyIndex]
                }));
            }
        }
        this.apiKeyIndex = 0;
        logger('gpt3').error(`所有apiKey均请求失败`);
        return null;
    }
}