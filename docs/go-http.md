# 参考配置
```yaml
servers:
  # 添加方式，同一连接方式可添加多个，具体配置说明请查看文档
  #- http: # http 通信
  #- ws:   # 正向 Websocket
  #- ws-reverse: # 反向 Websocket
  #- pprof: #性能分析服务器
  # 正向WS设置
  - ws:
      # 正向WS服务器监听地址（不懂就不要改地址）
      host: 0.0.0.0
      # 正向WS服务器监听端口
      port: 8080
      middlewares:
        <<: *default # 引用默认中间件
```
其中两个port可以根据需要修改，但是需要保证go-cqhttp的ws的端口和配置文件中的端口一致。
如果用了推荐配置，那么ws的端口就是8080