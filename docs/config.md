# 配置说明
## 1. 优先级
如果某项配置同时支持环境变量和配置文件配置，那么优先级为：
环境变量 > 配置文件 > 源码修改
## 2. 配置方式
### 1.1. 环境变量
- docker部署  
在`docker-compose.yml`文件中配置环境变量
- 源码部署
方式一（推荐）:  
在项目根目录创建`.env`文件并配置环境变量
方式二（不推荐）:
在系统环境变量中配置环境变量

### 1.2. 配置文件
配置文件全部在`config`目录下

### 1.3. 修改源码（不推荐）
可供修改的参数都在`src/utils/constant.ts`的`CONSTANT`对象中，可以直接修改源码中的对应值

## 3. 配置项
__带"*"加粗的参数为必须配置的参数__
- __* websocket连接地址__:
    > 末尾不要加斜杆
    - 环境变量: `WS_URL`
- __* OpenAI API Key__:
    - 配置文件(`api_keys.txt`): 一行一个API Key 
- OpenAI API基地址:
    > 如果服务器在国内且不方便使用代理，请配置此项，使用第三方的API（本人不对第三方API的安全性负责）  
    > 查看目前已收集的第三方api地址 [查看](./api.md)
    - 环境变量: `API_BASE_PATH`
- 代理地址:
    - 环境变量: `PROXY`
- 最大上下文消耗Token数:
    - 配置文件(`db.json`): `maxPrompts`
    - 环境变量: `MAX_PROMPTS`
    - 源码修改: `MAX_PROMPTS`
- 最大对话消耗Token数:
    - 配置文件(`db.json`): `maxTokens`
    - 环境变量: `MAX_TOKENS`
    - 源码修改: `MAX_TOKENS`
- 图片尺寸
    > 如果你允许生成图片，请把值设置为256，512，1024中的一个（只能三选一）。特别的， 0 代表禁止图片
    - 配置文件(`db.json`): `imageSize`
    - 环境变量: `IMAGE_SIZE`
    - 源码修改: `IMAGE_SIZE`
- 单次回答最大图片数
    > 如果你允许图片聊天，请把它设为非零值（机器人一次回答最多生成的图片数量），0代表禁止图片聊天
    - 配置文件(`db.json`): `maxImages`
    - 环境变量: `MAX_IMAGES`
    - 源码修改: `MAX_IMAGES`
- 禁用提示
    > 如果你不希望机器人提示“(对话已达到最大长度，将删除最早的一条对话)”这类的话，请把它设为true
    > 如果不需要，请勿配置此项，如果此项环境变量中设置值任意值都会被视为true，包括false、0、""等
    - 环境变量: `DISABLE_PROMPT`
- 私聊、群聊自动开始对话（布尔值）
    > 私聊时，无须输入命令自动开始对话
    > 如果不需要，请勿配置此项，如果此项环境变量中设置值任意值都会被视为true，包括false、0、""等
    - 环境变量（不需要请勿设置）: `AUTO_PRIVATE`、`AUTO_GROUP`
    - 配置文件(`db.json`): `autoPrivate`、`autoGroup`
    - 源码修改: `AUTO_PRIVATE`、`AUTO_GROUP`
- 默认人格（一段字符串文本）:
    - 配置文件(`db.json`): `defaultPrefix`
    - 源码修改: `DEFAULT_PREFIX`
- 默认对话参数（OpenAI API的四个参数）:
    - 配置文件(`db.json`): `defaultTemperature`、`defaultTop_p`、`defaultFrequency_penalty`、`defaultPresence_penalty`
    - 源码修改: `DEFAULT_TEMPERATURE`、`DEFAULT_TOP_P`、`DEFAULT_FREQUENCY_PENALTY`、`DEFAULT_PRESENCE_PENALTY`
- 默认对话模式（"pop_front"、"pop_back"、"not_save"三选一）:
    >pop_back: 如果对话达到最大长度，将自动删除最新的一条对话记录  
    >pop_front: 如果对话达到最大长度，将自动删除最早的一条对话记录  
    >not_save: 之后的对话不保存对话的上下文
    - 配置文件(`db.json`): `defaultMode`
    - 源码修改: `DEFAULT_MODE`
- 命令前缀:
    - 源码修改: `COMMAND_PREFIX`
- 群聊模式（"personal"、"party"、"disable"三选一）:
    >personal: 个人模式，每个用户一个对话  
    >party: 派对模式，所有用户共享一个对话  
    >disable: 禁止模式，不响应群聊消息
    - 配置文件(`db.json`): `groupMode`
    - 环境变量: `GROUP_MODE`
    - 源码修改: `GROUP_MODE`
- 群聊响应方式（"always"、"never"、"message"、"command"三选一）:
    >always: 命令和聊天都需要@机器人
    >never: 命令和聊天都不需要@机器人
    >message: 聊天需要@机器人，命令不需要
    >command: 命令需要@机器人，聊天不需要
    - 配置文件(`db.json`): `atMode`
    - 环境变量: `AT_MODE`
    - 源码修改: `AT_MODE`

- LUR缓存大小（如果主机内存小可以适当调小，如果主机内存大且用户量大可以适当调高）:
    - 环境变量: `MAX_USER_CACHE`
    - 源码修改: `MAX_USER_CACHE`

## 4. 补充
参数含义如有不太清楚的，运行后可以通过help命令查看帮助