import { Configuration, OpenAIApi } from "openai";
import { logger, readLineFile } from "./utils/utils.js";
import { setting } from "./setting.js";
import HttpsProxyAgent from 'https-proxy-agent';
import { CONSTANT, IMAGE_SIZE_USAGE } from "./utils/constant.js";

export class GPT {
    private openai: OpenAIApi;
    private apiKeys: Array<string> = [];
    private apiKeyIndex: number = 0;
    private axiosConfig;

    async init(): Promise<boolean> {
        // 一行一个key，忽略空行和空格
        this.apiKeys = await readLineFile('api_keys.txt');
        if (this.apiKeys.length === 0) {
            logger('gpt').error('没有发现API Key，请在config/api_keys.txt中添加');
            return false;
        }
        logger('usage').info(`当前使用的API Key为${this.apiKeys[this.apiKeyIndex]}`);
        this.openai = new OpenAIApi(new Configuration({
            apiKey: this.apiKeys[this.apiKeyIndex],
            basePath: process.env.API_BASE_PATH,
        }));
        this.axiosConfig = {
            proxy: false,
            httpAgent: process.env.PROXY?HttpsProxyAgent(process.env.PROXY):undefined,
            httpsAgent: process.env.PROXY?HttpsProxyAgent(process.env.PROXY):undefined,
            timeout: process.env.TIMEOUT || CONSTANT.TIMEOUT,
        };
        return true;
    }

    getKeys(): Array<string> {
        return this.apiKeys;
    }

    async tryAllKeys(callback: Function) {
        let try_cnt = 0;
        while (try_cnt++ < this.apiKeys.length) {
            try {
                const res = await callback();
                return res;
            } catch (e) {
                logger('gpt').error(`apiKey(${this.apiKeys[this.apiKeyIndex]})请求失败，错误信息：${e.message}`);
                this.apiKeyIndex = (this.apiKeyIndex + 1) % this.apiKeys.length;
                if (this.apiKeyIndex < this.apiKeys.length) {
                    logger('usage').info(`切换API Key为${this.apiKeys[this.apiKeyIndex]}`);
                }
                this.openai = new OpenAIApi(new Configuration({
                    apiKey: this.apiKeys[this.apiKeyIndex],
                    basePath: process.env.API_BASE_PATH,
                }));
            }
        }
        logger('gpt').error(`所有apiKey均请求失败`);
        return null;
    }

    async imageGeneration(params) {
        const imgSize = `${setting.imageSize}x${setting.imageSize}`
        return await this.tryAllKeys(async () => {
            const { data } = await this.openai.createImage({
                size: imgSize,
                n: 1,
                ...params,
            }, this.axiosConfig);
            return ({
                url: data.data[0].url,
                usage: IMAGE_SIZE_USAGE[setting.imageSize],
            });
        })
    }

    async chatCompletion(params) {
        return await this.tryAllKeys(async () => {
            const { data } = await this.openai.createChatCompletion({
                max_tokens: setting.maxTokens,
                ...params,
            }, this.axiosConfig);
            return ({
                text: data.choices[0].message.content.trim(),
                usage: data.usage
            });
        });
    }
}