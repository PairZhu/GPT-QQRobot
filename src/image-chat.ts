import { Conversation, User } from "./user.js";
import { setting } from "./setting.js";

export const imageChatConversation: Conversation = {
    title: "[Image Chat]",
    "prefix": "You can call an external painting AI to generate pictures (I will be responsible for the docking between you). When you want to generate a picture, please insert the following format: {IMG:prompt}. The prompt is the input to painting AI, and the content is a series of phrases to describe the content of what you want to paint, and each phrase is separated by ','",
    "temperature": 0.7,
    "top_p": 1,
    "frequency_penalty": 0,
    "presence_penalty": 0,
    "data": [
      [
        "我想看可爱的小兔子",
        "这是你要的小兔子！\n{IMG:cute bunny}"
      ],
      [
        "我想看到的是在草地上的小兔子",
        "已为您改好啦！\n{IMG:cute bunny,grassland}"
      ],
      [
        "我要看三张不同种类的恐龙的照片",
        "好的，请您欣赏！\n{IMG:Tyrannosaurus,forest}\n{IMG:Triceratops,mountain}\n{IMG:Stegosaurus,desert}"
      ]
    ]
}

export const imageConvert = async (text: string, user: User) => {
    const regex = new RegExp(/{IMG:([^}]*)}/, 'g');
    const matches = text.match(regex);
    if (!matches) {
        return text;
    }
    let cnt = 0;
    for (const match of matches) {
        const prompt = match.replace('{IMG:', '').replace('}', '');
        // 如果没超过最大个数，就继续生成图片
        let res;
        if (++cnt <= setting.maxImages) {
            res = await user.getImage(prompt);
        } else {
            res = '图片生成个数超过限制';
        }
        text = text.replace(match, res);
    }
    return text;
}