FROM node:lts-alpine
# 复制当前目录的dist目录和node_modules目录和package.json文件到/GPT对应目录下
COPY ./dist /GPT/dist
COPY ./node_modules /GPT/node_modules
COPY ./package.json /GPT/package.json
# 设置工作目录
WORKDIR /GPT
# 挂载/GPT/config目录和/GPT/logs目录
VOLUME ["/GPT/config", "/GPT/logs"]
# 运行程序
ENTRYPOINT ["node", "./dist/main.js"]