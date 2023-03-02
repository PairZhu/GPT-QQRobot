FROM node:lts-alpine
# 复制当前目录的dist目录和node_modules目录和package.json文件到/root/GPT3对应目录下
COPY ./dist /root/GPT3/dist
COPY ./node_modules /root/GPT3/node_modules
COPY ./package.json /root/GPT3/package.json
# 设置工作目录
WORKDIR /root/GPT3
# 挂载/root/GPT3/config目录和/root/GPT3/logs目录
VOLUME ["/root/GPT3/config", "/root/GPT3/logs"]
# 运行程序
ENTRYPOINT ["node", "./dist/main.js"]