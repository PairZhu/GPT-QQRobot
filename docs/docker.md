# Docker部署教程
## 前提
- 已经安装好docker和docker-compose（也可以自己写docker指令）
- 已经部署好go-cqhttp，并且配置了http和ws（正向ws）两个通讯方式
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
            - HTTP_URL=http://改成你配置的URL
# 如果你在国内，并且不方便使用代理，可以取消下一行的注释，使用第三方的接口（本人不对第三方API的安全性负责）
#            - API_BASE_PATH=https://chat-gpt.aurorax.cloud/v1
# （以下为可选配置，配置上下文长度限制和回答消耗token数限制）
#            - DEFAULT_MAX_PROMPTS=整数（默认为600）
#            - DEFAULT_MAX_TOKENS=整数（默认为400）
        container_name: gptrobot
        restart: always
        image: 'pairzhu/gptrobot'
```
其中，`WS_URL`和`HTTP_URL`分别是你go-cqhttp的ws和http的URL。
## 3. 启动
```bash
docker-compose up -d
```