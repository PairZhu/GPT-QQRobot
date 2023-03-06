import { DB } from './utils/db.js';
import { emptyOr, logger } from './utils/utils.js';
import { CONSTANT } from "./utils/constant.js";
import { GPT } from './gpt.js';
import fs from 'fs';

export interface Conversation {
    prefix: string;
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    data: Array<[string, string]>;
    title: string;
}

export enum Mode {
    pop_back = '如果对话达到最大长度，将自动删除最新的一条对话记录',
    pop_front = '如果对话达到最大长度，将自动删除最早的一条对话记录',
    not_save = '之后的对话不保存对话的上下文',
};

export class User {
    private id: string;
    private prefix: string;
    private db: DB;
    private conversations: Array<Conversation>;
    private currentConversation: Conversation;
    private temperature: number;
    private top_p: number;
    private frequency_penalty: number;
    private presence_penalty: number;
    private gpt: GPT;
    private mode: Mode;
    public busy: boolean = false;

    private maxPrompts = emptyOr(global.db.get('maxPrompts'), parseInt(process.env.DEFAULT_MAX_PROMPTS), CONSTANT.DEFAULT_MAX_PROMPTS);

    constructor(id: string, gpt: GPT) {
        this.id = id;
        this.gpt = gpt;
        this.db = new DB(`user/${this.id}`);
    }

    async init() {
        if (!fs.existsSync('config/user')) {
            fs.mkdirSync('config/user');
        }
        await this.db.init();
        this.prefix = emptyOr(
            this.db.get('prefix'),
            global.db.get('defaultPrefix'),
            CONSTANT.DEFAULT_PREFIX
        );
        this.temperature = emptyOr(
            this.db.get('temperature'),
            global.db.get('defaultTemperature'),
            CONSTANT.DEFAULT_TEMPERATURE
        );
        this.top_p = emptyOr(
            this.db.get('top_p'),
            global.db.get('defaultTop_p'),
            CONSTANT.DEFAULT_TOP_P
        );
        this.frequency_penalty = emptyOr(
            this.db.get('frequency_penalty'),
            global.db.get('defaultFrequency_penalty'),
            CONSTANT.DEFAULT_FREQUENCY_PENALTY
        );
        this.presence_penalty = emptyOr(
            this.db.get('presence_penalty'),
            global.db.get('defaultPresence_penalty'),
            CONSTANT.DEFAULT_PRESENCE_PENALTY
        );
        this.mode = Mode[emptyOr(
            this.db.get('mode'),
            global.db.get('defaultMode'),
            CONSTANT.DEFAULT_MODE
        )];
        this.conversations = this.db.get('conversations') || [];
        this.currentConversation = this.db.get('currentConversation', undefined);
    }

    getInfo() {
        return ({
            prefix: this.prefix,
            temperature: this.temperature,
            top_p: this.top_p,
            frequency_penalty: this.frequency_penalty,
            presence_penalty: this.presence_penalty,
            mode: Object.keys(Mode).find(key => Mode[key] === this.mode),
        });
    }

    getID() {
        return this.id;
    }

    async setPrefix(prefix: string) {
        this.prefix = prefix;
        await this.db.set('prefix', prefix);
    }

    async setConversation(conversation: Conversation) {
        // 深拷贝一份
        this.currentConversation = JSON.parse(JSON.stringify(conversation));
        await this.db.set('currentConversation', this.currentConversation);
    }

    async setParams(params) {
        this.temperature = params.temperature;
        this.top_p = params.top_p;
        this.frequency_penalty = params.frequency_penalty;
        this.presence_penalty = params.presence_penalty;
        const dbData = this.db.origin();
        dbData['temperature'] = params.temperature;
        dbData['top_p'] = params.top_p;
        dbData['frequency_penalty'] = params.frequency_penalty;
        dbData['presence_penalty'] = params.presence_penalty;
        await this.db.save();
    }

    async setMode(mode: string): Promise<boolean> {
        if (Mode[mode]) {
            this.mode = Mode[mode];
            return true;
        }
        await this.db.set('mode', mode);
        return false;
    }

    getConversation() {
        return this.currentConversation;
    }

    getConversationList() {
        return this.conversations;
    }

    getParams() {
        return ({
            temperature: this.temperature,
            top_p: this.top_p,
            frequency_penalty: this.frequency_penalty,
            presence_penalty: this.presence_penalty,
        });
    }

    async saveConversation(title: string) {
        // 深拷贝一份
        const conversation = JSON.parse(JSON.stringify(this.currentConversation));
        conversation.title = title;
        this.conversations.push(conversation);
        await this.db.set('conversations', this.conversations);
    }

    async deleteConversation(index: number) {
        this.conversations.splice(index, 1);
        await this.db.set('conversations', this.conversations);
    }

    async beginConversation() {
        this.currentConversation = {
            prefix: this.prefix,
            temperature: this.temperature,
            top_p: this.top_p,
            frequency_penalty: this.frequency_penalty,
            presence_penalty: this.presence_penalty,
            data: [],
            title: undefined,
        };
        await this.db.set('currentConversation', this.currentConversation);
    }

    async getAnswer(question: string): Promise<string> {
        if (this.busy) {
            return '我还在回答上一个问题呢，请稍后再试。';
        }
        logger('user').debug(`正在回答[${this.id}]的问题:\n${question}`)
        this.busy = true;
        const conversation = this.currentConversation;
        const messages = [{'role':'system','content':conversation.prefix}];
        conversation.data.forEach(([q, a]) => {
            messages.push({'role':'user','content':q});
            messages.push({'role':'assistant','content':a});
        })
        messages.push({'role':'user','content':question});
        const res = await this.gpt.textCompletion({
            messages,
            temperature: conversation.temperature,
            top_p: conversation.top_p,
            frequency_penalty: conversation.frequency_penalty,
            presence_penalty: conversation.presence_penalty,
        });
        this.busy = false;
        if (!res) {
            return '出错了，请稍后再试，或联系管理员';
        }
        logger('user').debug(`[${this.id}]的回答结果:\n${res.text}`)
        // 如果conversation已经被切换，说明用户已经开始了新的对话，那么就不保存这次的对话
        if (conversation !== this.currentConversation) {
            return res.text;
        }
        conversation.data.push([question, res.text]);
        let tip = '';
        switch (this.mode) {
            case Mode.pop_front:
                if (res.usage.prompt_tokens >= this.maxPrompts) {
                    tip = '(对话已达到最大长度，将删除最早的一条对话)\n';
                    conversation.data.shift();
                }
                await this.setConversation(conversation);
                break;
            case Mode.pop_back:
                if (res.usage.prompt_tokens >= this.maxPrompts) {
                    tip = '(对话已达到最大长度，此次问答将不会被记录)\n';
                    conversation.data.pop();
                } else {
                    await this.setConversation(conversation);
                }
                break;
            case Mode.not_save:
                tip = '(当前模式为不记录模式，此次问答将不会被记录)\n';
                conversation.data.pop();
                break;
        }
        logger('usage').info(`[${this.id}]消耗tokens:{total:${res.usage.total_tokens},prompt:${res.usage.prompt_tokens},completion:${res.usage.completion_tokens}}`)

        return tip + res.text;
    }

    async endConversation() {
        this.currentConversation = undefined;
        await this.db.set('currentConversation', this.currentConversation);
    }
}