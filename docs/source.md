# 源码部署教程
## 前提
- 已经安装好了Node.js和npm
## 1. 下载源码并解压，cd到目录
## 2. 安装依赖
```bash
npm install
```
## 3. 配置
在项目的根目录下创建`.env`文件，内容如下：
```.env
WS_URL=ws://改成你配置的URL
HTTP_URL=http://改成你配置的URL
```
其中，`WS_URL`和`HTTP_URL`分别是你go-cqhttp的ws和http的URL。  
在项目根目录下创建`config/api_keys.txt`文件，输入你的OpenAI API Key，一行一个（支持多个API Key，失败了会自动切换为下一个）。
## 4. 启动
第一次启动用
```bash
npm start
```
或者先
```bash
npm run build
```
之后启动可以直接
```bash
npm run start:prod
```