import { emptyOr, logger, readLineFile, writeLineFile } from './utils/utils.js';
import { CONSTANT } from './utils/constant.js';

export enum GroupMode {
    personal = 'personal', // 群内每个人的对话独立互不干扰
    party = 'party', // 同一个群内所有人共享一个对话
    disable = 'disable', // 群聊模式禁用
}

export enum AtMode {
    always = 'always', // 命令和聊天都需要@机器人
    never = 'never', // 命令和聊天都不需要@机器人
    message = 'message', // 聊天需要@机器人，命令不需要
    command = 'command', // 命令需要@机器人，聊天不需要
}

export enum ChatMode {
    pop_back = '如果对话达到最大长度，将自动删除最新的一条对话记录',
    pop_front = '如果对话达到最大长度，将自动删除最早的一条对话记录',
    not_save = '之后的对话不保存对话的上下文',
};

export const validImageSize = {
    0: 0,
    256: 0.016,
    512: 0.018,
    1024: 0.020,
};

// 用于保存需要动态修改的设置

export const setting = {
    maxTokens: undefined,
    maxPrompts: undefined,
    groupMode: undefined,
    atMode: undefined,
    autoPrivate: undefined,
    autoGroup: undefined,
    defaultTop_p: undefined,
    defaultTemperature: undefined,
    defaultFrequency_penalty: undefined,
    defaultPresence_penalty: undefined,
    defaultPrefix: undefined,
    defaultMode: undefined,
    imageSize: undefined,
    maxImages: undefined,
    disableGroup: undefined,
    disableQQ: undefined,

    async init() {
        this.maxTokens = emptyOr(global.db.get('maxTokens'), parseInt(process.env.MAX_TOKENS), CONSTANT.MAX_TOKENS);
        this.maxPrompts = emptyOr(global.db.get('maxPrompts'), parseInt(process.env.MAX_PROMPTS), CONSTANT.MAX_PROMPTS);
        this.groupMode = GroupMode[emptyOr(global.db.get('groupMode'), process.env.GROUP_MODE, CONSTANT.GROUP_MODE)];
        this.atMode = AtMode[emptyOr(global.db.get('atMode'), process.env.AT_MODE, CONSTANT.AT_MODE)];
        this.autoPrivate = Boolean(emptyOr(global.db.get('autoPrivate'), process.env.AUTO_PRIVATE, CONSTANT.AUTO_PRIVATE));
        this.autoGroup = Boolean(emptyOr(global.db.get('autoGroup'), process.env.AUTO_GROUP, CONSTANT.AUTO_GROUP));
        this.defaultTop_p = emptyOr(global.db.get('defaultTop_p'), CONSTANT.DEFAULT_TOP_P);
        this.defaultTemperature = emptyOr(global.db.get('defaultTemperature'), CONSTANT.DEFAULT_TEMPERATURE);
        this.defaultFrequency_penalty = emptyOr(global.db.get('defaultFrequency_penalty'), CONSTANT.DEFAULT_FREQUENCY_PENALTY);
        this.defaultPresence_penalty = emptyOr(global.db.get('defaultPresence_penalty'), CONSTANT.DEFAULT_PRESENCE_PENALTY);
        this.defaultPrefix = emptyOr(global.db.get('defaultPrefix'), CONSTANT.DEFAULT_PREFIX);
        this.defaultMode = ChatMode[emptyOr(global.db.get('defaultMode'), process.env.DEFAULT_MODE, CONSTANT.DEFAULT_MODE)];
        this.imageSize = emptyOr(global.db.get('imageSize'), parseInt(process.env.IMAGE_SIZE), CONSTANT.IMAGE_SIZE);
        this.maxImages = emptyOr(global.db.get('maxImages'), parseInt(process.env.MAX_IMAGES), CONSTANT.MAX_IMAGES);
        if (!(this.imageSize in validImageSize)) {
            this.imageSize = CONSTANT.IMAGE_SIZE;
            logger('master').error(`非法的图片尺寸: ${this.imageSize}，使用默认值: ${CONSTANT.IMAGE_SIZE}`);
        }
        this.disableGroup = await readLineFile('disable_group.txt');
        this.disableQQ = await readLineFile('disable_qq.txt');
    },

    async set(key: string, value: any) {
        switch (key) {
            case 'defaultChatMode':
                this.defaultMode = ChatMode[value];
                await global.db.set(key, value);
                break;
            case 'imageSize':
                if (!(value in validImageSize)) {
                    logger('master').error(`非法的图片尺寸: ${value}`);
                    break;
                }
                this.imageSize = value;
                await global.db.set(key, value);
                break;
            case 'disableGroup':
                this.disableGroup = value;
                await writeLineFile('disable_group.txt', value);
                break;
            case 'disableQQ':
                this.disableQQ = value;
                await writeLineFile('disable_qq.txt', value);
                break;
            default:
                this[key] = value;
                await global.db.set(key, value);
                break;
        }
    }

}