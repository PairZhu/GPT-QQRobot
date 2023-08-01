export const CONSTANT = {
    MAX_TOKENS: 400,
    MAX_PROMPTS: 600,
    DEFAULT_TEMPERATURE: 0.7,
    DEFAULT_TOP_P: 1,
    DEFAULT_FREQUENCY_PENALTY: 0,
    DEFAULT_PRESENCE_PENALTY: 0,
    DEFAULT_MODE: 'pop_front',
    DEFAULT_PREFIX: 'You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.',
    MAX_USER_CACHE: 200,
    COMMAND_PREFIX: '#gpt ',
    GROUP_MODE: 'party',
    AT_MODE: 'message',
    AUTO_PRIVATE: false,
    AUTO_GROUP: false,
    IMAGE_SIZE: 0,
    MAX_IMAGES: 0,
    TIMEOUT: 60*1000,
    DEFAULT_MODEL: 'gpt-3.5-turbo',
}

export const IMAGE_SIZE_USAGE = {
    0: 0,
    256: 0.016,
    512: 0.018,
    1024: 0.020,
}