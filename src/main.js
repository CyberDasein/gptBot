import { Telegraf, session } from "telegraf";
import config from "config";
import { code } from "telegraf/format"
import { message } from "telegraf/filters"
import { ogg } from "./ogg.js"
import { openai } from "./openai.js";
import { removeFile } from './utils.js'
import { processTextToChat, INITIAL_SESSION } from './logic.js'

const bot = new Telegraf(config.get("TG_TOKEN"))

bot.use(session())

bot.command("new", async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply("Ожидаю ваше сообщение")
})

bot.command("start", async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply("Ожидаю ваше сообщение")
})

bot.on(message("voice"), async (ctx) => {
    if (!ctx.session) { ctx.session = INITIAL_SESSION }
    try {
        await ctx.reply(code("Сообщение принято. Жду ответ..."))
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)

        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)
        const text = await openai.transcription(mp3Path)

        await ctx.reply(code(`Ваш запрос: ${text}`))

        await processTextToChat(ctx, text)
        removeFile(mp3Path)

    } catch (e) {
        console.log(e)
    }

})

bot.on(message('text'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))
        await processTextToChat(ctx, ctx.message.text)
    } catch (e) {
        console.log(`Error while text message`, e.message)
    }
})

bot.launch()

process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))
