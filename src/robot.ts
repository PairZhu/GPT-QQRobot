import ws from "ws";
import { sleep, logger } from "./utils/utils.js";
import { v4 as uuidv4 } from 'uuid';

export class Robot {
    private static maxSplit = 2000;
    private static minSplit = 1800;
    // 越靠前的分隔符优先级越高
    private static splitCharList = ['\n',', ','，','. ','。','! ','！','? ','？',' ','\t'];
    private static webSocketTimeout = 30 * 1000;
    private ws: ws;
    private wsOptions: any;
    private wsUrl: string;
    private privateListeners: Map<Function, Function> = new Map();
    private groupListeners: Map<Function, Function> = new Map();
    private listeners: Map<Function, Function> = new Map();
    public info;

    private static splitString(str: string): string[] {
        const result = [];
        while (str.length>0) {
            let index = Robot.maxSplit;
            // 遍历所有分隔符
            for (let splitChar of Robot.splitCharList) {
                const splitIndex = str.lastIndexOf(splitChar, Robot.maxSplit-splitChar.length)+splitChar.length;
                if (splitIndex > Robot.minSplit) {
                    index = splitIndex;
                    break;
                }
            }
            result.push(str.slice(0, index));
            str = str.slice(index);
        }
        return result
    }

    private static async connectedClient(url: string,wsOptions: any): Promise<boolean> {
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
            const client = new ws(url, wsOptions);
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

    constructor(wsUrl: string, accessToken?: string) {
        this.wsUrl = wsUrl;
        if (accessToken) {
            this.wsOptions = {
                headers: {
                    Authorization: 'Bearer ' + accessToken
                }
            }
        }
    }

    on(event: string, callback:Function) {
        let listener:Function;
        switch (event) {
            case 'message':
                listener = data => {
                    data = JSON.parse(data);
                    callback(data);
                }
                this.ws.on('message', listener);
                this.listeners.set(callback, listener);
                break;
            case 'private_message':
                listener = data => {
                    data = JSON.parse(data);
                    if (!data.message) return;
                    data.message = Robot.decodeMsg(data.message);
                    if (data.message_type !== 'private') return;
                    callback(data);
                }
                this.ws.on('message', listener);
                this.privateListeners.set(callback, listener);
                break;
            case 'group_message':
                listener = data => {
                    data = JSON.parse(data);
                    if (!data.message) return;
                    data.message = Robot.decodeMsg(data.message);
                    if (data.message_type !== 'group') return;
                    callback(data);
                }
                this.ws.on('message', listener);
                this.groupListeners.set(callback, listener);
                break;
            default:
                this.ws.on(event, callback);
                break;
        }
    }

    off(event: string, callback:Function) {
        switch (event) {
            case 'message':
                this.ws.off('message', this.listeners.get(callback));
                this.listeners.delete(callback);
                break;
            case 'private_message':
                this.ws.off('message', this.privateListeners.get(callback));
                this.privateListeners.delete(callback);
                break;
            case 'group_message':
                this.ws.off('message', this.groupListeners.get(callback));
                this.groupListeners.delete(callback);
                break;
            default:
                this.ws.off(event, callback);
                break;
        }
    }

    async init(): Promise<boolean> {
        logger('robot').info("开始连接CQHTTP...");
        this.ws = await Robot.connectedClient(this.wsUrl, this.wsOptions);
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
            const res = await this.send({ action: 'get_login_info' });
            this.info = res['data'];
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
        content['echo'] = uuidv4();
        const result = new Promise(resolve => {
            const timeoutID = setTimeout(() => {
                this.ws.off('message', onMessage);
                logger('robot').error("WebSocket Timeout!");
                resolve({
                    status: false,
                    msg: 'WebSocket Timeout!'
                });
            }, Robot.webSocketTimeout);
            const onMessage = data => {
                data = JSON.parse(data);
                if (data.echo === content['echo']) {
                    clearTimeout(timeoutID);
                    this.ws.off('message', onMessage);
                    resolve({
                        status: true,
                        data: data.data,
                    });
                }
            }
            this.ws.on('message', onMessage);
        });
        this.ws.send(JSON.stringify(content));
        return result;
    }

    async sendPrivate(str: string, id: string) {
        // 如果太长，分段发送
        const splitList = Robot.splitString(str);
        for (const split of splitList) {
            await this.send({
                action: 'send_private_msg',
                params: {
                    user_id: id,
                    message: split,
                },
            });
            // 等待2秒，确保消息有序到达
            await sleep(2 * 1000);
        }
    }

    async sendGroup(str: string, id: string) {
        const splitList = Robot.splitString(str);
        for (const split of splitList) {
            await this.send({
                action: 'send_group_msg',
                params: {
                    group_id: id,
                    message: split,
                },
            });
            // 等待2秒，确保消息有序到达
            await sleep(2 * 1000);
        }
    }
}