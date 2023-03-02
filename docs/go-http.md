# 参考配置
```yaml
servers:
  # 添加方式，同一连接方式可添加多个，具体配置说明请查看文档
  #- http: # http 通信
  #- ws:   # 正向 Websocket
  #- ws-reverse: # 反向 Websocket
  #- pprof: #性能分析服务器
  # HTTP 通信设置
  - http:
      # 服务端监听地址
      host: 0.0.0.0
      # 服务端监听端口
      port: 5700
      # 反向HTTP超时时间, 单位秒
      # 最小值为5，小于5将会忽略本项设置
      timeout: 5
      middlewares:
        <<: *default # 引用默认中间件
      # 反向HTTP POST地址列表
      post:
      #- url: '' # 地址
      #  secret: ''           # 密钥
      #- url: 127.0.0.1:5701 # 地址
      #  secret: ''          # 密钥
  # 正向WS设置
  - ws:
      # 正向WS服务器监听地址
      host: 0.0.0.0
      # 正向WS服务器监听端口
      port: 8080
      middlewares:
        <<: *default # 引用默认中间件
```
其中两个port可以根据需要修改，但是需要保证go-cqhttp的http和ws的端口和配置文件中的端口一致。