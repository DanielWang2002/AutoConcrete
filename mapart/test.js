const fs = require("fs")
const nbt = require("prismarine-nbt")
const config = require(`${process.cwd()}/config.json`)
const settings = require(`${process.cwd()}/settings.json`)
const mineflayer = require('mineflayer')
const request = require('request-promise');
const tokens = require('prismarine-tokens-fixed');  //讀取prismarine-tokens-fixed(驗證緩存)模塊
const vec3 = require('vec3')
const {pathfinder, Movements, goals: {GoalNear}} = require('mineflayer-pathfinder')

/*TODO: - start 照材料盒順序去拿材料 跑一遍blocks 材料一樣就去該座標放置 如果無任何block為該材料 將身上材料放到特定箱子 重複以上動作
        - 放置方塊: bot.placeEntity(referenceBlock, faceVector)
        - 移動: pathfinder
        - 看能否調整bot移動速度: bot.physics
*/

const whitelist = config.whitelist
let mcData
let palette
let blocks

let opt = {
    // host: config.ip,
    host: "localhost",
    auth: config.auth,
    username: config.username,
    // tokensLocation: './bot_tokens.json',
    // tokensDebug: true,
    version: "1.18.1"
}

async function connects() {
    tokens.use(opt, function (_err, _opts) {
        if (_err) throw _err

        const bot = mineflayer.createBot(_opts)

        bot.loadPlugin(pathfinder)

        // bot.entity.velocity = new vec3(100,100,100)
        // 待測試

        bot.once('spawn', () => {

            mcData = require('minecraft-data')(bot.version)

        })


        bot.on("message", async function (jsonMsg) {
            try {
                await LoadNBTFile('white.nbt')
                await bot.creative.startFlying()

                // [座標相對位置, 材料名稱]
                let mapart_map = await getItemNameMap(blocks, palette)

                // let a = parseFloat(jsonMsg.toString().split(" ")[1])
                // cl(`1 ${bot.entity.position}`)
                // bot.entity.velocity = new vec3 (0, 0, a)
                // cl(bot.entity)
                // await new Promise(r => setTimeout(r, 1000))
                // cl(`2 ${bot.entity.position}`)
                for (let [i, j] of mapart_map) {
                    try {
                        // 材料方塊名稱
                        let itemname = j.split(':')[1]
                        // 目前地點
                        let now_position = bot.entity.position
                        // 要放方塊的位置(飛行目標地點y-2)
                        // let placeVec = new vec3(original_position.plus(new vec3(i[0], i[1], i[2])))
                        
                        // cl(`x: ${i[0]} y: ${i[1]} z: ${i[2]}`)
                        // await bot.creative.flyTo(ToMoveVec)

                        // 放置方塊
                        // let PlaceItem = bot.inventory.findInventoryItem(mcData.itemsByName[itemname].id, null, false)
                        // if (PlaceItem != null) {
                        //     cl("現在座標" + bot.entity.position)
                        //     await bot.equip(PlaceItem, 'hand')
                        //     await bot.placeBlock(bot.blockAt(ToMoveVec), new vec3(0, -1, 0))
                        // }
                        await new Promise(r => setTimeout(r, 300))
                    } catch (e) {
                        cl(e)
                    }


                    // await new Promise(r => setTimeout(r, 100))
                }
            } catch (err) {
                console.log(`發生錯誤: ${err}`)
            }

        })

        bot.on('kicked', console.log)
        bot.on('error', console.log)
        bot.on('end', () => {
            console.log(getDateTime())
            console.log(`連線中斷，將在5秒後嘗試重新連接伺服器！`)
            setTimeout(function () {
                connects();
            }, 5000)
        })

    })
}

function cl(msg) {
    console.log(getDateTime() + msg)
}

function getDateTime() {

    let date = new Date();

    let hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    let min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    let sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    let year = date.getFullYear();

    let month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    let day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return "@" + year + "/" + month + "/" + day + " " + hour + ":" + min + ":" + sec;

}

async function throwItems(bot, item) {
    await bot.toss(item.type, item.metadata, item.count)
}

async function LoadNBTFile(FileName) {
    const f = await fs.readFileSync(FileName)
    const {parsed, type} = await nbt.parse(f, 'big')
    blocks = parsed.value.blocks.value.value
    palette = parsed.value.palette.value.value
}

// 回傳相對座標+物品名稱的Map
async function getItemNameMap(blocks, palette) {

    let Position_ItemName = new Map()

    let item_name = []

    for (let item of palette) {
        item_name.push(item.Name.value)
    }

    for (let i = 0; i < parseInt(blocks.length) - 1; i++) {
        Position_ItemName.set(blocks[i].pos.value.value, item_name[blocks[i].state.value])
    }

    return Position_ItemName

}

connects()