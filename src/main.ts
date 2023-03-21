import dotenv from 'dotenv';
import { Robot } from './robot.js';
import { GPT } from './gpt.js';
import { User } from './user.js';
import { CONSTANT } from './utils/constant.js';
import { dealCommand } from './command.js';
import { DB } from './utils/db.js';
import { emptyOr, logger } from './utils/utils.js';
import { AtMode, GroupMode, setting } from './setting.js';
import LURCache from 'lru-cache';
import fs from 'fs';

dotenv.config();

global.db = new DB('db.json');
await global.db.init();

global.robot = new Robot(process.env.WS_URL);
await global.robot.init();

global.gpt = new GPT();
await global.gpt.init();

await setting.init();

global.userCache = new LURCache<string, User>({ max: emptyOr(parseInt(process.env.MAX_USER_CACHE), CONSTANT.MAX_USER_CACHE) });
global.chattingUsers = new Set<string>();

if (!setting.groupMode) {
    logger('master').error(`群聊模式错误，应为${Object.keys(GroupMode).join('、')}其中之一，程序已退出`)
    process.exit(1);
}

if (!setting.atMode) {
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

const dealMessage = async (
    message: string,
    userId: string,
    originData?: any,
    allowCommand: boolean = true,
    allowChat: boolean = true,
) => {
    if (setting.disableQQ.includes(originData.user_id.toString())) {
        logger('master').debug(`用户${originData.user_id}是黑名单用户，拒绝回复`);
        return null;
    }
    if (originData.group_id && setting.disableGroup.includes(originData.group_id.toString())) {
        logger('master').debug(`群${originData.group_id}是黑名单群，拒绝回复`);
        return null;
    }
    try {
        if (message.startsWith(CONSTANT.COMMAND_PREFIX) && allowCommand) {
            const commandStr = message.slice(CONSTANT.COMMAND_PREFIX.length);
            const res = await dealCommand(userId, commandStr);
            return res;
        }
        if (allowChat) {
            let user = global.userCache.get(userId);
            if (!user) {
                user = new User(userId, global.gpt);
                await user.init();
                global.userCache.set(userId, user);
            }
            if (!global.chattingUsers.has(userId)) {
                global.chattingUsers.add(userId);
                await user.beginConversation();
            }
            let res =  await user.getAnswer(message);
            return res;
        }
        return null;
    } catch (e) {
        logger('master').error(e);
        return null;
    }
}

global.robot.on('private_message', async (data) => {
    const userId = data.user_id.toString();
    const replyCode = `[CQ:reply,id=${data.message_id}]`
    const allowChat = setting.autoPrivate || global.chattingUsers.has(userId);
    const res = await dealMessage(data.message, userId, data, true, allowChat);
    if (res !== null) {
        global.robot.sendPrivate(replyCode + res, data.user_id);
    }
});

global.robot.on('group_message', async (data) => {
    if(setting.groupMode === GroupMode.disable) {
        return;
    }
    const userId = setting.groupMode === GroupMode.personal ? `${data.user_id}` : `g${data.group_id}`;
    const replyCode = `[CQ:reply,id=${data.message_id}]`
    const atCode = `[CQ:at,qq=${global.robot.info.user_id}]`
    const withAtCode = data.message.includes(atCode);
    if (setting.atMode === AtMode.always && !withAtCode) {
        return;
    }
    const allowCommand = setting.atMode !== AtMode.command || withAtCode;
    const allowChat = (setting.atMode !== AtMode.message || withAtCode) && (setting.autoGroup || global.chattingUsers.has(userId));
    // 删除所有atCode
    const message = data.message.replaceAll(atCode+' ', '').replaceAll(atCode, '');
    const res = await dealMessage(message, userId, data, allowCommand, allowChat);
    if(res!==null && res!==undefined) {
        global.robot.sendGroup(replyCode + res, data.group_id);
    }
});

logger('master').info('GPT-QQRobot启动成功！');
