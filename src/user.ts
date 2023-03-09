import { DB } from './utils/db.js';
import { emptyOr, logger } from './utils/utils.js';
import { CONSTANT } from "./utils/constant.js";
import { GPT } from './gpt.js';
import { setting, ChatMode } from './setting.js';
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
    private mode: ChatMode;
    public busy: boolean = false;


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
        this.prefix = this.db.get('prefix');
        this.temperature = this.db.get('temperature');
        this.top_p = this.db.get('top_p');
        this.frequency_penalty = this.db.get('frequency_penalty');
        this.presence_penalty = this.db.get('presence_penalty');
        this.mode = ChatMode[this.db.get('mode')];
        this.conversations = this.db.get('conversations') || [];
        this.currentConversation = this.db.get('currentConversation', undefined);
    }

    getInfo() {
        return ({
            prefix: emptyOr(this.prefix, setting.defaultPrefix),
            temperature: emptyOr(this.temperature, setting.defaultTemperature),
            top_p: emptyOr(this.top_p, setting.defaultTop_p),
            frequency_penalty: emptyOr(this.frequency_penalty, setting.defaultFrequency_penalty),
            presence_penalty: emptyOr(this.presence_penalty, setting.defaultPresence_penalty),
            mode: Object.keys(ChatMode).find(key => ChatMode[key] === emptyOr(this.mode, setting.defaultMode)),
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

    async resetParams() {
        await this.setParams({
            temperature: undefined,
            top_p: undefined,
            frequency_penalty: undefined,
            presence_penalty: undefined,
        });
        await this.setMode(undefined);
        await this.setPrefix(undefined);
    }

    async setMode(mode: string): Promise<boolean> {
        if (ChatMode[mode]) {
            this.mode = ChatMode[mode];
            await this.db.set('mode', mode);
            return true;
        }
        if (mode === undefined || mode === null) {
            this.mode = undefined;
            await this.db.set('mode', undefined);
            return true;
        }
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
            prefix: emptyOr(this.prefix, setting.defaultPrefix),
            temperature: emptyOr(this.temperature, setting.defaultTemperature),
            top_p: emptyOr(this.top_p, setting.defaultTop_p),
            frequency_penalty: emptyOr(this.frequency_penalty, setting.defaultFrequency_penalty),
            presence_penalty: emptyOr(this.presence_penalty, setting.defaultPresence_penalty),
            data: [],
            title: undefined,
        };
        this.busy = false;
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
        const res = await this.gpt.chatCompletion({
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
        switch (emptyOr(this.mode, setting.defaultMode)) {
            case ChatMode.pop_front:
                if (res.usage.prompt_tokens >= setting.maxPrompts) {
                    tip = '(对话已达到最大长度，将删除最早的一条对话)\n';
                    conversation.data.shift();
                }
                await this.setConversation(conversation);
                break;
            case ChatMode.pop_back:
                if (res.usage.prompt_tokens >= setting.maxPrompts) {
                    tip = '(对话已达到最大长度，此次问答将不会被记录)\n';
                    conversation.data.pop();
                } else {
                    await this.setConversation(conversation);
                }
                break;
            case ChatMode.not_save:
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