import { CONSTANT } from "./utils/constant.js";
import { User, Conversation } from "./user.js";
import { logger } from "./utils/utils.js";
import { ChatMode, setting } from "./setting.js";
export interface Command {
    name: string;
    description: string;
    deal: (userId: string, originStr: string, ...args: Array<string>) => Promise<string>;
    argNums?: Set<number>;
    help?: string;
}

async function preparedUser(userId: string): Promise<User> {
    let user = global.userCache.get(userId);
    if (!user) {
        user = new User(userId, global.gpt);
        await user.init();
        global.userCache.set(userId, user);
    }
    return user;
}

const conversation2String = (conversation: Conversation) => (
    '人设: ' + conversation.prefix+ '\n' + conversation.data.map((cur) => (`user: ${cur[0]}\nassistant: ${cur[1]}`)).join('\n')
);

export const commandList: Array<Command> = [
    {
        name: 'help',
        description: '显示帮助信息',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            if (args.length > 0) {
                const command = commandList.find(command => command.name === args[0]);
                if (command) {
                    return `${command.name}: ${command.description}\n${command.help || '无帮助信息'}`;
                } else {
                    return `未找到该命令"${args[0]}"`;
                }
            }
            const result = commandList.reduce((acc, cur) => {
                return `${acc}\n${cur.name}: ${cur.description}`;
            }, `命令前缀: "${CONSTANT.COMMAND_PREFIX}"\n\n命令列表`) + '\n\n注: ' + this.help;
            return result;
        },
        argNums: new Set([0, 1]),
        help: `help [命令名(可选)]: 指定命令名可显示具体命令的帮助信息，例如: ${CONSTANT.COMMAND_PREFIX}help list\n不指定则显示命令列表`
    },
    {
        name: 'begin',
        description: '开启新的对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            global.chattingUsers.add(userId);
            const user = await preparedUser(userId);
            await user.beginConversation();
            return '对话已开启';
        },
        argNums: new Set([0]),
        help: '开启新的对话，只有开启了对话后才能和机器人聊天。如果当前已有活动的对话，则当前对话会被覆盖丢失'
    },
    {
        name: 'end',
        description: '结束当前对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            if (!global.chattingUsers.has(userId)) {
                return '当前没有对话';
            }
            const user = await preparedUser(userId);
            await user.endConversation();
            global.chattingUsers.delete(userId);
            return '对话已结束';
        },
        argNums: new Set([0]),
        help: '结束当前对话，如果当前对话没有存档，则此次对话会丢失'
    },
    {
        name: 'save',
        description: '存档当前对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            if (!global.chattingUsers.has(userId)) {
                return '当前没有对话，无法存档';
            }
            const user = await preparedUser(userId);
            await user.saveConversation(args[0]);
            return '对话已存档';
        },
        argNums: new Set([1]),
        help: `save [对话标题]: 存档当前对话，例如: ${CONSTANT.COMMAND_PREFIX}save 聊天1\n如果对话后续发生变化将不会同步到存档的对话中（可以理解为游戏的存档功能）`
    },
    {
        name: 'list',
        description: '列出存档的对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const user = await preparedUser(userId);
            const conversationList = user.getConversationList()
            if (args.length === 0) {
                return '存档列表\n' + conversationList.map((item, index) => `${index + 1}. ${item.title}`).join('\n') + '\n\n注: ' + this.help;
            }
            const index = parseInt(args[0]);
            if (isNaN(index)) {
                return '序号必须是数字';
            }
            if (index < 1 || index > conversationList.length) {
                return `序号超出范围，输入${CONSTANT.COMMAND_PREFIX}list查看存档列表`;
            }
            const conversation = conversationList[index - 1];
            return `标题: ${conversation.title}\ntemperature: ${conversation.temperature}\ntop_p: ${conversation.top_p}\nfrequency_penalty: ${conversation.frequency_penalty}\npresence_penalty: ${conversation.presence_penalty}\n\n`+ conversation2String(conversation);
        },
        argNums: new Set([0, 1]),
        help: `list [序号(可选)]: 指定序号可显示对应对话的内容，例如: ${CONSTANT.COMMAND_PREFIX}list 1\n不指定则显示存档列表`
    },
    {
        name: 'load',
        description: '加载存档的对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const index = parseInt(args[0]);
            if (isNaN(index)) {
                return '序号必须是数字';
            }
            const user = await preparedUser(userId);
            const conversationList = user.getConversationList();
            if (index < 1 || index > conversationList.length) {
                return `序号超出范围，输入${CONSTANT.COMMAND_PREFIX}list查看存档列表`;
            }
            const conversation = conversationList[index - 1];
            user.setConversation(conversation);
            if(!global.chattingUsers.has(userId)) {
                global.chattingUsers.add(userId);
            }
            return `已加载存档"${conversation.title}"，对话已开启`;
        },
        argNums: new Set([1]),
        help: `load [序号]: 加载序号对应的对话存档，例如: ${CONSTANT.COMMAND_PREFIX}load 1\n加载后当前对话会丢失，并且载入对话不会覆盖原来的存档（可以理解为游戏的存档功能）`
    },
    {
        name: 'delete',
        description: '删除存档的对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const index = parseInt(args[0]);
            if (isNaN(index)) {
                return '序号必须是数字';
            }
            const user = await preparedUser(userId);
            const conversationList = user.getConversationList();
            if (index < 1 || index > conversationList.length) {
                return `序号超出范围，输入${CONSTANT.COMMAND_PREFIX}list查看存档列表`;
            }
            const title = conversationList[index - 1].title;
            await user.deleteConversation(index - 1);
            return `存档"${title}"已删除`;
        },
        argNums: new Set([1]),
        help: `delete [序号]: 删除序号对应的已存档的对话，例如: ${CONSTANT.COMMAND_PREFIX}delete 1`
    },
    {
        name: 'info',
        description: '显示当前用户和对话信息',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const user = await preparedUser(userId);
            const conversation = user.getConversation();
            const info = user.getInfo();
            let res = `用户信息\n对话模式: ${info.mode}\n对话人设: ${info.prefix}\ntemperature: ${info.temperature}\ntop_p: ${info.top_p}\nfrequency_penalty: ${info.frequency_penalty}\npresence_penalty: ${info.presence_penalty}\n\n当前对话\n`;
            if (conversation) {
                res += `对话人设: ${conversation.prefix}\ntemperature: ${conversation.temperature}\ntop_p: ${conversation.top_p}\nfrequency_penalty: ${conversation.frequency_penalty}\npresence_penalty: ${conversation.presence_penalty}`;
            } else {
                res += '无';
            }
            return res;
        },
        argNums: new Set([0]),
        help: `显示当前用户和对话信息，其中temperature、top_p、frequency_penalty、presence_penalty分别对应GPT的四个参数，具体含义请参考OpenAI官网的文档 https://platform.openai.com/docs/api-reference/chat/create ，对话模式的含义请使用命令${CONSTANT.COMMAND_PREFIX}help mode查看`
    },
    {
        name: 'retry',
        description: '重答上一次对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            if (!global.chattingUsers.has(userId)) {
                return '当前没有对话';
            }
            const user = await preparedUser(userId);
            const conversation = user.getConversation();
            const [question] = conversation.data.pop();
            const res = await user.getAnswer(question);
            return res;
        },
        argNums: new Set([0]),
        help: '重答上一个问题，被重答后原回答将不会再影响对话的上下文，如果参数设置的合理重答后的答案会和原回答不同'
    },
    {
        name: 'back',
        description: '撤销上一次对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            if (!global.chattingUsers.has(userId)) {
                return '当前没有对话';
            }
            const user = await preparedUser(userId);
            const conversation = user.getConversation();
            const [question, answer] = conversation.data.pop();
            user.setConversation(conversation);
            return `已撤销上一次对话：\nuser: ${question}\nassistant: ${answer}`;
        },
        argNums: new Set([0]),
        help: '撤销之前的一次问答记录，被撤销后该问答记录将不会再影响对话的上下文'
    },
    {
        name: 'mode',
        description: '设置对话模式',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const mode = args[0];
            const user = await preparedUser(userId);
            if (await user.setMode(mode)) {
                return `对话模式已设置为${mode}`;
            }
            return `未找到该对话模式"${mode}"，输入${CONSTANT.COMMAND_PREFIX}help mode查看帮助`;
        },
        argNums: new Set([1]),
        help: `mode [模式]: 设置对话模式，例如：${CONSTANT.COMMAND_PREFIX}mode pop_back\n\n目前支持的模式有:\n${Object.keys(ChatMode).map(key => `${key}: ${ChatMode[key]}`).join('\n')}\n\n设置的模式对下次问答立即生效`
    },
    {
        name: 'char',
        description: '设置对话人设',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            // 删除最开始的空格
            let prefix = originStr.replace(/^\s+/, '').slice(this.name.length + 1);
            if (!prefix) {
                return `缺少人设内容，请输入${CONSTANT.COMMAND_PREFIX}help char查看帮助信息`;
            }
            const user = await preparedUser(userId);
            user.setPrefix(prefix);
            return `对话人设已设置为：${prefix}\n\n将在新创建的对话中生效`;
        },
        help: `char [人设]: 设置对话人设，将在新创建的对话中生效，例如: ${CONSTANT.COMMAND_PREFIX}char ${CONSTANT.DEFAULT_PREFIX}`
    },
    {
        name: "img",
        description: "生成图片",
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            let prompt = originStr.replace(/^\s+/, '').slice(this.name.length + 1);
            if (setting.imageSize === 0) {
                return '管理员已禁用图片生成功能';
            }
            if (!prompt) {
                return `缺少图片描述，请输入${CONSTANT.COMMAND_PREFIX}help img查看帮助信息`;
            }
            const user = await preparedUser(userId);
            const res = await user.getImage(prompt);
            return res;
        },
        help: `img [图片描述]: 生成图片，例如: ${CONSTANT.COMMAND_PREFIX}img A cute baby sea otter`
    },
    {
        name: 'history',
        description: '查看当前对话历史',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            if (!global.chattingUsers.has(userId)) {
                return '当前没有对话';
            }
            const user = await preparedUser(userId);
            const conversation = user.getConversation();
            return conversation2String(conversation);
        },
        argNums: new Set([0]),
    },
    {
        name: 'param',
        description: '设置用户参数',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const user = await preparedUser(userId);
            const params = user.getParams();
            const paramName = args[0];
            const paramValue = parseFloat(args[1]);
            if (!(paramName in params)) {
                return `未找到参数${paramName}，输入${CONSTANT.COMMAND_PREFIX}help param查看帮助`;
            }
            if (isNaN(paramValue)) {
                return `参数${paramName}的值必须是数字`;
            }
            return `参数${paramName}已设置为${paramValue}`;
        },
        argNums: new Set([2]),
        help: `param [参数名] [参数值]: 设置对话参数，例如: ${CONSTANT.COMMAND_PREFIX}param temperature 0.8\n设置的参数将在新创建的对话中生效\n支持的参数名有:temperature、top_p、frequency_penalty、presence_penalty\n参数的具体含义请参考OpenAI官网的文档 https://platform.openai.com/docs/api-reference/chat/create`
    },
    {
        name: 'share',
        description: '查看分享的存档',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const shareList = global.db.get('share',[]);
            if(args.length === 0) {
                return '分享列表:\n'+shareList.map((item, index) => `${index + 1}. ${item.title}`).join('\n')+`\n\n使用import命令可以导入对应的对话，输入${CONSTANT.COMMAND_PREFIX}help import查看帮助`;
            }
            const index = parseInt(args[0]);
            if (isNaN(index)) {
                return `序号必须是数字`;
            }
            const user = await preparedUser(userId);
            const conversationList = user.getConversationList();
            if (index < 1 || index > conversationList.length) {
                return `序号超出范围，输入${CONSTANT.COMMAND_PREFIX}list查看存档列表`;
            }

            const conversation = conversationList[index - 1];
            // 深拷贝
            shareList.push(JSON.parse(JSON.stringify(conversation)));
            await global.db.set('share', shareList);
            logger('command').info(`[${userId}]分享对话: ${shareList.length}. ${conversation.title}`);
            return `已分享对话"${conversation.title}"`;
        },
        argNums: new Set([0,1]),
        help: `share [序号(可选)]: 指定序号可以分享已存档的对话，例如: ${CONSTANT.COMMAND_PREFIX}share 1\n如果不指定序号，则显示分享列表`
    },
    {
        name: 'import',
        description: '导入分享的对话',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const index = parseInt(args[0]);
            const shareList = global.db.get('share',[]);
            if(isNaN(index)) {
                return `序号必须是数字`;
            }
            if(index < 1 || index > shareList.length) {
                return `序号超出范围，输入${CONSTANT.COMMAND_PREFIX}share查看分享列表`;
            }
            const user = await preparedUser(userId);
            const conversation = shareList[index - 1];
            user.setConversation(conversation);
            if(!global.chattingUsers.has(userId)) {
                global.chattingUsers.add(userId);
            }
            return `已加载分享的存档"${conversation.title}"，对话已开启`;
        },
        argNums: new Set([1]),
        help: `import [序号]: 导入分享的对话，例如: ${CONSTANT.COMMAND_PREFIX}import 1\n输入${CONSTANT.COMMAND_PREFIX}share查看分享列表`
    },
    {
        name: 'reset',
        description: '重置用户参数',
        deal: async function (userId: string, originStr: string, ...args: Array<string>) {
            const user = await preparedUser(userId);
            await user.resetParams();
            return '用户参数已重置，将在新创建的对话中生效';
        },
        argNums: new Set([0]),
        help: `reset: 重置用户参数，将在新创建的对话中生效`
    }
];

export async function dealCommand(userId: string, commandStr: string): Promise<string> {
    // 把多个空格替换成一个空格，并去除前后空格，然后按空格分割
    logger('command').debug(`正在处理[${userId}]的命令: ${commandStr}`);
    const args = commandStr.replace(/\s+/g, ' ').trim().split(' ');
    const command = commandList.find(command => command.name === args[0]);
    if (command) {
        if (command.argNums && !command.argNums.has(args.length - 1)) {
            logger('command').debug(`命令${command.name}参数数量错误`);
            return `命令${command.name}参数数量错误，可接受的参数数量为${Array.from(command.argNums).join('、')}，您输入的参数为${args.length - 1}\n请输入${CONSTANT.COMMAND_PREFIX}help ${command.name}查看帮助信息`;
        }
        logger('command').debug(`匹配到命令${command.name}，正在执行`);
        const res = await command.deal(userId, commandStr, ...args.slice(1));
        logger('command').debug(`命令${command.name}执行结果:\n${res}`);
        return res;
    } else {
        logger('command').warn(`未找到该命令"${args[0]}"`);
        return `未找到该命令"${args[0]}"`;
    }
}