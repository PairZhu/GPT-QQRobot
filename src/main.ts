import dotenv from 'dotenv';
import { Robot } from './robot.js';
import { GPT } from './gpt.js';
import { User } from './user.js';
import { CONSTANT } from './utils/constant.js';
import { dealCommand } from './command.js';
import { DB } from './utils/db.js';
import { emptyOr, logger } from './utils/utils.js';
import LURCache from 'lru-cache';
import fs from 'fs';

dotenv.config();

global.db = new DB('db.json');
await global.db.init();

global.robot = new Robot(process.env.WS_URL, process.env.HTTP_URL);
await global.robot.init();

global.gpt = new GPT();
await global.gpt.init();

global.userCache = new LURCache<string, User>({ max: emptyOr(parseInt(process.env.MAX_USER_CACHE), CONSTANT.DEFAULT_MAX_USER_CACHE) });
global.chattingUsers = new Set<string>();

enum GroupMode {
    personal = 'personal', // 群内每个人的对话独立互不干扰
    party = 'party', // 同一个群内所有人共享一个对话
    disable = 'disable', // 群聊模式禁用
}

enum AtMode {
    always = 'always', // 命令和聊天都需要@机器人
    never = 'never', // 命令和聊天都不需要@机器人
    message = 'message', // 聊天需要@机器人，命令不需要
    command = 'command', // 命令需要@机器人，聊天不需要
}

const groupMode = GroupMode[emptyOr(process.env.GROUP_MODE, global.db.get('groupMode'), CONSTANT.GROUP_MODE)];
const atMode = AtMode[emptyOr(process.env.AT_MODE, global.db.get('atMode'), CONSTANT.AT_MODE)];
if (!groupMode) {
    logger('master').error(`群聊模式错误，应为${Object.keys(GroupMode).join('、')}其中之一，程序已退出`)
    process.exit(1);
}

if (!atMode) {
    logger('master').error(`@机器人模式错误，应为${Object.keys(AtMode).join('、')}其中之一，程序已退出`)
    process.exit(1);
}

// 从用户目录下读取所有用户，如果该用户当前存在对话则存入chattingUsers
if (!fs.existsSync('config/user')) {
    fs.mkdirSync('config/user');
}
fs.readdirSync('config/user').forEach(async file => {
    if (!file.endsWith('.json')) {
        return;
    }
    const userId = file.slice(0, -5);
    const user = new User(userId, global.gpt);
    await user.init();
    if (user.getConversation()) {
        global.chattingUsers.add(userId);
    }
});

global.robot.on('private_message', async (data) => {
    const userId = data.user_id.toString();
    const replyCode = `[CQ:reply,id=${data.message_id}]`
    const message = data.message;
    if (message.startsWith(CONSTANT.COMMAND_PREFIX)) {
        const commandStr = message.slice(CONSTANT.COMMAND_PREFIX.length);
        const res = await dealCommand(userId, commandStr);
        global.robot.sendPrivate(replyCode + res, userId);
        return;
    }
    if (!global.chattingUsers.has(userId)) {
        return;
    }
    let user = global.userCache.get(userId);
    if (!user) {
        user = new User(userId, global.gpt);
        await user.init();
        global.userCache.set(userId, user);
    }
    const res = await user.getAnswer(message);
    global.robot.sendPrivate(replyCode + res, userId);
});

if (groupMode !== GroupMode.disable) {
    global.robot.on('group_message', async (data) => {
        const userId = groupMode === GroupMode.personal ? `${data.user_id}` : `g${data.group_id}`;
        const replyCode = `[CQ:reply,id=${data.message_id}]`
        const atCode = `[CQ:at,qq=${global.robot.info.user_id}]`
        const withAtCode = data.message.includes(atCode);
        if (atMode === AtMode.always && !withAtCode) {
            return;
        }
        // 删除所有atCode
        const message = data.message.replaceAll(atCode+' ', '').replaceAll(atCode, '');
        if (message.startsWith(CONSTANT.COMMAND_PREFIX)) {
            if (atMode === AtMode.command && !withAtCode) {
                return;
            }
            const commandStr = message.slice(CONSTANT.COMMAND_PREFIX.length);
            const res = await dealCommand(userId, commandStr);
            global.robot.sendGroup(replyCode + res, data.group_id);
            return;
        }
        if (atMode === AtMode.message && !withAtCode) {
            return;
        }
        if (!global.chattingUsers.has(userId)) {
            return;
        }
        let user = global.userCache.get(userId);
        if (!user) {
            user = new User(userId, global.gpt);
            await user.init();
            global.userCache.set(userId, user);
        }
        const res = await user.getAnswer(message);
        global.robot.sendGroup(replyCode + res, data.group_id);
    })
}

