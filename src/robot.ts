import ws from "ws";
import fetch from "node-fetch";
import { sleep, logger } from "./utils/utils.js";

export class Robot {
    private static splitLength = 1000;
    private ws: ws;
    private httpUrl: string;
    private wsUrl: string;
    public info;

    private static splitString(str: string): string[] {
        const result = [];
        for (let i = 0; i < str.length; i += Robot.splitLength) {
            result.push(str.slice(i, i + Robot.splitLength));
        }
        return result;
    }

    private static async connectedClient(url: string): Promise<boolean> {
        const wsResult = client => new Promise((resolve) => {
            const onSuccess = () => {
                client.off('open', onSuccess);
                client.off('error', onError);
                resolve(true);
            }
            const onError = () => {
                client.off('open', onSuccess);
                client.off('error', onError);
                resolve(false);
            }
            client.on('error', onError);
            client.on('open', onSuccess);
        })
        while (true) {
            const client = new ws(url);
            const state = await wsResult(client);
            if (state) {
                return client;
            } else {
                logger('robot').error("连接失败，10秒后重试");
                client.terminate();
                await sleep(10 * 1000);
                logger('robot').info("重试中...");
            }
        }
    }

    private static decodeMsg(str) {
        const reg = /&#([\d]+);/g;
        return str.replaceAll(reg, (_, val) => String.fromCharCode(val)).replaceAll('&amp;', '&');
    }

    constructor(wsUrl?: string, httpUrl?: string) {
        this.wsUrl = wsUrl;
        this.httpUrl = httpUrl;
    }

    on(event: string, callback) {
        switch (event) {
            case 'message':
                this.ws.on('message', data => {
                    data = JSON.parse(data);
                    callback(data);
                })
                break;
            case 'private_message':
                this.ws.on('message', data => {
                    data = JSON.parse(data);
                    if (!data.message) return;
                    data.message = Robot.decodeMsg(data.message);
                    if (data.message_type !== 'private') return;
                    callback(data);
                })
                break;
            case 'group_message':
                this.ws.on('message', data => {
                    data = JSON.parse(data);
                    if (!data.message) return;
                    data.message = Robot.decodeMsg(data.message);
                    if (data.message_type !== 'group') return;
                    callback(data);
                })
                break;
            default:
                this.ws.on(event, callback);
        }
    }

    async init(): Promise<boolean> {
        logger('robot').info("开始连接CQHTTP...");
        this.ws = await Robot.connectedClient(this.wsUrl);
        logger('robot').info("CQHTTP连接成功！");
        this.ws.on('close', () => {
            logger('robot').error("CQHTTP连接已断开！");
            process.exit(1);
        });
        this.ws.on('error', error => {
            logger('robot').error("CQHTTP连接出现错误！");
            logger('robot').error(error);
        })
        logger('robot').info("开始获取登录信息...");
        try {
            const res = await fetch(`${this.httpUrl}/get_login_info`);
            this.info = (await res.json())['data'];
        } catch (e) {
            logger('robot').error("登录信息获取失败！");
            logger('robot').error(e);
            return false;
        }
        logger('robot').info("登录信息获取成功！");
        logger('robot').info(`当前机器人账号：${this.info.nickname}[${this.info.user_id}]`);
        return true;
    }

    send(content:object) {
        this.ws.send(JSON.stringify(content));
    }

    async sendPrivate(str: string, id: string) {
        // 如果太长，分段发送
        const splitList = Robot.splitString(str);
        for (const split of splitList) {
            this.send({
                action: 'send_private_msg',
                params: {
                    user_id: id,
                    message: split,
                },
            });
            await sleep(200);
        }
    }

    async sendGroup(str: string, id: string) {
        const splitList = Robot.splitString(str);
        for (const split of splitList) {
            this.send({
                action: 'send_group_msg',
                params: {
                    user_id: id,
                    message: split,
                },
            });
            await sleep(200);
        }
    }
}