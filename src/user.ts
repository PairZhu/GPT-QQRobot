import { DB } from './utils/db.js';
import { emptyOr, logger } from './utils/utils.js';
import { GPT } from './gpt.js';
import { setting, ChatMode } from './setting.js';
import { imageChatConversation, imageConvert } from './image-chat.js';
import { v5 as uuidv5 } from 'uuid';
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
    private images: Array<[string, string]>;
    private uuid: string;
    private temperature: number;
    private top_p: number;
    private frequency_penalty: number;
    private presence_penalty: number;
    private gpt: GPT;
    private mode: ChatMode;
    private model: string;
    private accessModels: Array<string>;
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
        this.prefix = emptyOr(this.db.get('prefix'), setting.defaultPrefix);
        this.temperature = emptyOr(this.db.get('temperature'), setting.defaultTemperature);
        this.top_p = emptyOr(this.db.get('top_p'), setting.defaultTop_p);
        this.frequency_penalty = emptyOr(this.db.get('frequency_penalty'), setting.defaultFrequency_penalty);
        this.presence_penalty = emptyOr(this.db.get('presence_penalty'), setting.defaultPresence_penalty);
        this.mode = emptyOr(ChatMode[this.db.get('mode')], setting.defaultMode);
        this.conversations = this.db.get('conversations') || [];
        this.currentConversation = this.db.get('currentConversation', undefined);
        this.images = this.db.get('images') || [];
        this.uuid = this.db.get('uuid') || uuidv5(this.id, uuidv5.URL);
        this.model = emptyOr(this.db.get('model'), setting.defaultModel);
        this.accessModels = this.db.get('access_models') || [setting.defaultModel];
        if (!this.db.get('uuid')) {
            await this.write();
        }
    }

    async write() {
        const dbData = this.db.origin();
        dbData['prefix'] = this.prefix;
        dbData['temperature'] = this.temperature;
        dbData['top_p'] = this.top_p;
        dbData['frequency_penalty'] = this.frequency_penalty;
        dbData['presence_penalty'] = this.presence_penalty;
        dbData['mode'] = Object.keys(ChatMode).find(key => ChatMode[key] === this.mode);
        dbData['conversations'] = this.conversations;
        dbData['currentConversation'] = this.currentConversation;
        dbData['images'] = this.images;
        dbData['uuid'] = this.uuid;
        dbData['model'] = this.model;
        dbData['access_models'] = this.accessModels;
        await this.db.save();
    }

    getInfo() {
        return ({
            prefix: this.prefix,
            temperature: this.temperature,
            top_p: this.top_p,
            frequency_penalty: this.frequency_penalty,
            presence_penalty: this.presence_penalty,
            accessModels: this.accessModels,
            model: this.model,
            mode: Object.keys(ChatMode).find(key => ChatMode[key] === this.mode),
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
        this.busy = false;
        await this.save();
    }

    private async save() {
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
            temperature: setting.defaultTemperature,
            top_p: setting.defaultTop_p,
            frequency_penalty: setting.defaultFrequency_penalty,
            presence_penalty: setting.defaultPresence_penalty,
        });
        await this.setModel(setting.defaultModel);
        await this.setMode(setting.defaultMode);
        await this.setPrefix(setting.defaultPrefix);
    }

    async setMode(mode: string): Promise<boolean> {
        if (ChatMode[mode]) {
            this.mode = ChatMode[mode];
            await this.db.set('mode', mode);
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
            prefix: this.prefix,
            temperature: this.temperature,
            top_p: this.top_p,
            frequency_penalty: this.frequency_penalty,
            presence_penalty: this.presence_penalty,
            data: [],
            title: undefined,
        };
        this.busy = false;
        await this.db.set('currentConversation', this.currentConversation);
    }

    async getImage(prompt: string): Promise<string> {
        logger('user').debug(`正在生成[${this.id}]描述的图片:\n${prompt}`)
        const res = await this.gpt.imageGeneration({
            prompt: prompt,
            user: this.uuid,
        });
        if(!res) {
            return '出错了，请稍后再试，或联系管理员';
        }
        logger('user').debug(`[${this.id}]的图片生成结果:\n${res.url}`);
        logger('usage').info(`[${this.id}]消耗余额\$${res.usage}`);
        this.images.push([prompt, res.url]);
        await this.db.set('images', this.images);
        return `[CQ:image,file=${res.url}]`;
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
        });
        messages.push({'role':'user','content':question});
        const res = await this.gpt.chatCompletion({
            messages,
            temperature: conversation.temperature,
            top_p: conversation.top_p,
            frequency_penalty: conversation.frequency_penalty,
            presence_penalty: conversation.presence_penalty,
            user: this.uuid,
            model: this.model,
        });
        if (!res) {
            this.busy = false;
            return '出错了，请稍后再试，或联系管理员';
        }
        logger('user').debug(`[${this.id}](${this.model})的回答结果:\n${res.text}`);
        logger('usage').info(`[${this.id}]消耗tokens:{total:${res.usage.total_tokens},prompt:${res.usage.prompt_tokens},completion:${res.usage.completion_tokens}}`);
        // 如果conversation已经被切换，说明用户已经开始了新的对话，那么就不保存这次的对话
        if (conversation !== this.currentConversation) {
            this.busy = false;
            if(conversation.title === imageChatConversation.title) {
                res.text = await imageConvert(res.text,this);
            }
            return res.text;
        }
        conversation.data.push([question, res.text]);
        if(conversation.title === imageChatConversation.title) {
            res.text = await imageConvert(res.text,this);
        }
        let tip = '';
        switch (this.mode) {
            case ChatMode.pop_front:
                if (res.usage.prompt_tokens >= setting.maxPrompts) {
                    tip = '(对话已达到最大长度，将删除最早的一条对话)\n';
                    conversation.data.shift();
                }
                await this.save();
                break;
            case ChatMode.pop_back:
                if (res.usage.prompt_tokens >= setting.maxPrompts) {
                    tip = '(对话已达到最大长度，此次问答将不会被记录)\n';
                    conversation.data.pop();
                } else {
                    await this.save();
                }
                break;
            case ChatMode.not_save:
                tip = '(当前模式为不记录模式，此次问答将不会被记录)\n';
                conversation.data.pop();
                break;
        }
        this.busy = false;
        if(process.env.NO_TIP) {
            tip = '';
        }
        return tip + res.text;
    }

    async endConversation() {
        this.currentConversation = undefined;
        await this.db.set('currentConversation', this.currentConversation);
    }

    async enableModel(model: string) {
        this.accessModels.push(model);
        this.accessModels = Array.from(new Set(this.accessModels));
        await this.db.set('access_models', this.accessModels);
    }

    async disableModel(model: string) {
        this.accessModels = this.accessModels.filter(m => m !== model);
        await this.db.set('access_models', this.accessModels);
    }

    async setModel(model: string):Promise<boolean> {
        if (this.accessModels.includes(model)) {
            this.model = model;
            await this.db.set('model', model);
            return true;
        }
        return false;
    }
}