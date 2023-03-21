# Docker部署教程
## 前提
- 已经安装好docker和docker-compose（也可以自己写docker指令）
- 已经部署好go-cqhttp，并且配置了ws（正向ws）两个通讯方式
## 1. 拉取镜像
```bash
docker pull pairzhu/gptrobot
```
## 2. 创建文件夹和必备文件
```bash
cd ~
mkdir GPTRobot
cd GPTRobot
mkdir config
vim config/api_keys.txt
```
在`api_keys.txt`中输入你的OpenAI API Key，一行一个（支持多个API Key，失败了会自动切换为下一个），保存退出。  
编辑docker-compose.yml文件
```bash
vim docker-compose.yml
```
内容参考如下：
```yaml
version: '2'
services:
    gptrobot:
        volumes:
            - './config:/GPT/config'
            - './logs:/GPT/logs'
        environment:
            - WS_URL=ws://改成你配置的URL
            - MASTER_QQ=你的QQ号
# 如果你在国内需要用代理，请取消下面一行的注释并修改为你的代理地址
#            - PROXY=http://代理地址:端口
# 如果你在国内，并且不方便使用代理，可以使用第三方的接口（本人不对第三方API的安全性负责）
#            - API_BASE_PATH=第三方api地址
# （以下为可选配置，配置上下文长度限制和回答消耗token数限制）
#            - MAX_PROMPTS=整数（默认为600）
#            - MAX_TOKENS=整数（默认为400）
# 如果你允许生成图片，请取消下面一行的注释，并把值设置为256，512，1024中的一个（只能为这三个其中一个）
#            - IMAGE_SIZE=图片尺寸
# 如果你允许图片聊天，请把它设为非零值（机器人一次回答最多生成的图片数量），0代表禁止图片聊天
#            - MAX_IMAGES=单次回答最大图片数量
        container_name: gptrobot
        network_mode: "host"
        restart: always
        image: 'pairzhu/gptrobot'
```
查看目前已收集的第三方api地址 [查看](./api.md)  
其中，`WS_URL`是你go-cqhttp配置的ws通讯的URL。  
如果go-cqhttp用的推荐，且cq和本项目部署在同一台主机上那么，`WS_URL=ws://127.0.0.1:8080`
## 3. 启动
```bash
docker-compose up -d
```