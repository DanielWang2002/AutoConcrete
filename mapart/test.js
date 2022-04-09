const fs = require("fs")
const nbt = require("prismarine-nbt")
const config = require(`${process.cwd()}/config.json`)
const settings = require(`${process.cwd()}/settings.json`)
const mineflayer = require('mineflayer')
const request = require('request-promise');
const tokens = require('prismarine-tokens-fixed');  //讀取prismarine-tokens-fixed(驗證緩存)模塊
const vec3 = require('vec3')

async function main(file) {

    const f = await fs.readFileSync('willsmith.nbt')
    const {parsed, type} = await nbt.parse(f, 'big')
    const blocks = parsed.value.blocks.value.value
    const palette = parsed.value.palette.value.value

    let item_name = []

    for (let item of palette) {
        item_name.push(item.Name.value)
    }

    console.log(item_name)

    for (let i = 0; i < parseInt(blocks.length) - 1; i++) {
        console.log(blocks[i].pos.value.value)
        console.log(item_name[blocks[i].state.value])
        console.log('-------------')

        await new Promise(r => setTimeout(r, 100))
    }
    // TODO 讀取 palette 將 state.value 轉換成 string 搞懂網站與NBT檔的差別
}

main()