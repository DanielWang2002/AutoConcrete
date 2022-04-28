const config = require(`${process.cwd()}/config.json`)
const settings = require(`${process.cwd()}/settings.json`)
const mineflayer = require('mineflayer')
let request = require('request-promise');
const tokens = require('prismarine-tokens-fixed');  //讀取prismarine-tokens-fixed(驗證緩存)模塊
const vec3 = require('vec3')

/*
TODO: - [系統] 你身上沒有足夠的空間換取此物品。 請空出足夠的空間。
 */

const whitelist = config.whitelist
let isCommandStop = false
let stopClickWindow = false
let find_Source_Save_sb = false
let not_found_sb_count = 0

// 遊戲ID
let GameID

let opt = {
    host: config.ip,
    auth: config.auth,
    username: config.username,
    password: config.password,
    // tokensLocation: './bot_tokens.json',
    // tokensDebug: true,
    version: "1.18.1"
}

function connects() {

    tokens.use(opt, function (_err, _opts) {

        if (_err) throw _err

        const bot = mineflayer.createBot(_opts)

        bot.once('spawn', () => {
            let mcData = require('minecraft-data')(bot.version)
            GameID = bot.username
            // 遊戲內ID與config(DB)不同
            if (GameID !== config.username) {
                cl(`您的遊戲ID與資料庫不符合，請檢查config.json中的username`)
                cl(`有任何疑問請私訊Discord: Daniel Wang#0306`)
                cl(`程式即將關閉...`)
                setTimeout(function () {
                    process.exit()
                }, 3000)
            }
        })



        bot.on("message", async function (jsonMsg) {
            const health = /目標生命 \: ❤❤❤❤❤❤❤❤❤❤ \/ ([\S]+)/g.exec(jsonMsg.toString())
            if (!health) cl(jsonMsg.toAnsi()) //顯示訊息在黑窗
            if (jsonMsg.toString().includes(`-> 您]`)) {
                let tmp = jsonMsg.toString().split(" ")
                // [ '[DanielWang_', '->', '您]', 'test' ]
                let userID = tmp[0].replace("[", "")
                let msg = tmp[3]
                let id

                // 如果長度為4代表指令為stop..etc , 長度為5代表start ID
                if (tmp.length == 5) {
                    id = tmp[4]
                }

                if (whitelist.includes(userID)) {
                    switch (msg) {

                        case "start":

                            if (!id) {
                                bot.chat(`/m ${userID} 指令錯誤! 請使用 /m bot start 兌換位置ID`)
                                break
                            }

                            stopClickWindow = false
                            isCommandStop = false
                            find_Source_Save_sb = false

                            // 丟掉身上所有物品
                            for (let item of bot.inventory.items()) {
                                await throwItems(bot, item);
                            }

                            while (!isCommandStop) {

                                if (id == "35") {

                                    if (check_source_save_sb_for_seaLantern(bot)) {
                                        if (!find_Source_Save_sb) bot.chat(`/m ${userID} 已找到材料盒與儲存盒，開始兌換...`)
                                        find_Source_Save_sb = true
                                        not_found_sb_count = 0

                                        // 拿取材料
                                        if (getShulkerBox1(bot).name == "shulker_box") await withdrawItem(bot, userID, getShulkerBox1(bot), id)
                                        // 如果是換海燈籠，要多拿一盒材料
                                        if (getShulkerBox2(bot).name == "shulker_box") await withdrawItem(bot, userID, getShulkerBox2(bot), id)
                                        // /shop_item 兌換，直到出現[系統] 你必須有 _____ 才能兌換
                                        while (!stopClickWindow) {
                                            let p = open_shop_item_to_exchange(bot, id)
                                            wait_store = [p]
                                            await Promise.all(wait_store)
                                            await new Promise(r => setTimeout(r, settings.shopitem_click_delay));
                                        }

                                        await depositItem(bot, userID, getShulkerBox3(bot), id)

                                        stopClickWindow = false

                                        await new Promise(r => setTimeout(r, settings.waitfor_next_delay))

                                    } else {
                                        await new Promise(r => setTimeout(r, settings.waitfor_next_delay))

                                        if (not_found_sb_count == settings.max_check_sb_times) {
                                            bot.chat(`/m ${userID} 超過${settings.max_check_sb_times}次找不到界符盒`)
                                            await new Promise(r => setTimeout(r, 300))
                                            bot.chat(`/m ${userID} 已終止兌換`)
                                            break
                                        }
                                        not_found_sb_count += 1

                                        bot.chat(`/m ${userID} 找不到材料盒或儲存盒，請檢查！`)
                                    }

                                } else {

                                    if (check_source_save_sb(bot)) {
                                        if (!find_Source_Save_sb) bot.chat(`/m ${userID} 已找到材料盒與儲存盒，開始兌換...`)
                                        find_Source_Save_sb = true
                                        not_found_sb_count = 0

                                        // 拿取材料
                                        await withdrawItem(bot, userID, getShulkerBox1(bot), id)
                                        // /shop_item 兌換，直到出現[系統] 你必須有 _____ 才能兌換
                                        while (!stopClickWindow) {
                                            let p = open_shop_item_to_exchange(bot, id)
                                            wait_store = [p]
                                            await Promise.all(wait_store)
                                            await new Promise(r => setTimeout(r, settings.shopitem_click_delay));
                                        }

                                        await depositItem(bot, userID, getShulkerBox3(bot), id)

                                        stopClickWindow = false

                                        await new Promise(r => setTimeout(r, settings.waitfor_next_delay))

                                    } else {
                                        not_found_sb_count += 1
                                        if (not_found_sb_count === settings.max_check_sb_times) {
                                            bot.chat(`/m ${userID} 超過${settings.max_check_sb_times}次找不到界符盒`)
                                            bot.chat(`/m ${userID} 已終止兌換`)
                                            break
                                        }
                                        bot.chat(`/m ${userID} 找不到材料盒或儲存盒，請檢查！`)
                                        await new Promise(r => setTimeout(r, settings.waitfor_next_delay))
                                    }

                                }

                            }

                            break

                        case "stop":
                            isCommandStop = true
                            bot.chat(`/m ${userID} 已停止`)
                            break

                        case "throw":
                            // 丟掉身上所有物品
                            for (let item of bot.inventory.items()) {
                                await throwItems(bot, item)
                            }

                            break


                        case "test":
                            console.log(bot.username)
                    }
                }

            } else if (jsonMsg.toString().startsWith(`[系統] `) &&
                jsonMsg.toString().toLowerCase().includes(`想要你傳送到 該玩家 的位置!`) ||
                jsonMsg.toString().toLowerCase().includes(`想要傳送到 你 的位置`)) {
                let msg = jsonMsg.toString().split(/ +/g);
                let playerid = msg[1]

                if (whitelist.includes(playerid)) {
                    bot.chat(`/tok`)
                } else {
                    bot.chat(`/tno`)
                }

            } else if (jsonMsg.toString().startsWith(`[系統] `) &&
                jsonMsg.toString().toLowerCase().includes(`你必須有`) &&
                jsonMsg.toString().toLowerCase().includes(`才能兌換`)) {
                stopClickWindow = true
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

function check_source_save_sb(bot) {
    let sb1 = getShulkerBox1(bot).name
    let sb2 = getShulkerBox2(bot).name
    let sb3 = getShulkerBox3(bot).name

    // 如果有一材料或成品不為界伏盒，回傳false，代表無法兌換
    if ((sb1 != "shulker_box") || (sb3 != "shulker_box")) return false
    return true
}

function check_source_save_sb_for_seaLantern(bot) {
    let sb1 = getShulkerBox1(bot).name
    let sb2 = getShulkerBox2(bot).name
    let sb3 = getShulkerBox3(bot).name

    // for 海燈籠的解法 1&2少任一個 + 沒成品盒 = 無法兌換
    if (((sb1 != "shulker_box") && (sb2 != "shulker_box")) || (sb3 != "shulker_box")) return false
    return true
}

function getShulkerBox1(bot) {
    let sb = bot.blockAt(new vec3(parseInt(settings.shulkerBox1.x), parseInt(settings.shulkerBox1.y), parseInt(settings.shulkerBox1.z)));
    return sb;
}

function getShulkerBox2(bot) {
    let sb = bot.blockAt(new vec3(parseInt(settings.shulkerBox2.x), parseInt(settings.shulkerBox2.y), parseInt(settings.shulkerBox2.z)));
    return sb;
}

function getShulkerBox3(bot) {
    let sb = bot.blockAt(new vec3(parseInt(settings.shulkerBox3.x), parseInt(settings.shulkerBox3.y), parseInt(settings.shulkerBox3.z)));
    return sb;
}

//丟棄超過9組的物品
async function throwItems(bot, item) {
    await bot.toss(item.type, item.metadata, item.count)
    // return new Promise(resolve => {
    //     try {
    //         await bot.toss(item.type, item.metadata, item.count)
    //         resolve()
    //     } catch (error) {
    //         console.log(`丟棄物品時發生錯誤: ${error}`)
    //     }
    // })
}

async function withdrawItem(bot, playerid, shulker_box_block, id) {

    // 將界伏盒方塊轉成界符盒
    let shulker_box = await bot.openChest(shulker_box_block);
    // 欲兌換的物品
    let exchange_item
    // 盒內物品數量 最大1728
    let sb_containerItems_count = 0

    if (shulker_box.containerItems().length !== 0) {

        for (let item of shulker_box.containerItems()) {
            exchange_item = item
            sb_containerItems_count += item.count
        }

    } else {

        bot.chat(`/m ${playerid} 材料盒為空盒，請立即處理`)

    }

    if (exchange_item) {
        try {

            switch (id) {
                case "35":
                    // 海磷碎片
                    if (exchange_item.name == "prismarine_shard") {

                        await shulker_box.withdraw(exchange_item.type, null, 256)
                        // if (sb_containerItems_count >= 256) {

                        //     await shulker_box.withdraw(exchange_item.type, null, 256)
                        //     console.log("這次材料>256")

                        // } else {

                        //     await shulker_box.withdraw(exchange_item.type, null, sb_containerItems_count)
                        //     await new Promise(r => setTimeout(r, 1000)) // 等待1秒，確保新的盒子會吐出來
                        //     await withdrawItem(bot, playerid, shulker_box_block, id)
                        //     console.log("這次材料<256")

                        // }

                        // 海磷晶體
                    } else if (exchange_item.name == "prismarine_crystals") {

                        await shulker_box.withdraw(exchange_item.type, null, 320)
                        // if (sb_containerItems_count >= 320) {

                        //     await shulker_box.withdraw(exchange_item.type, null, 320)
                        //     console.log("這次材料>320")

                        // } else {

                        //     await shulker_box.withdraw(exchange_item.type, null, sb_containerItems_count)
                        //     await new Promise(r => setTimeout(r, 1000)) // 等待1秒，確保新的盒子會吐出來
                        //     await withdrawItem(bot, playerid, shulker_box_block, id)
                        //     console.log("這次材料>320")

                        // }

                    }
                    break



                case "40":

                    let gn_count = 0

                    for (let item of bot.inventory.items()) {
                        if (item.name == "gold_nugget") gn_count += item.count
                    }

                    await shulker_box.withdraw(exchange_item.type, null, 1620 - gn_count)
                    break
                case "42":

                    let in_count = 0

                    for (let item of bot.inventory.items()) {
                        if (item.name == "iron_nugget") in_count += item.count
                    }

                    await shulker_box.withdraw(exchange_item.type, null, 1620 - in_count)
                    break

                case "51":
                    await shulker_box.withdraw(exchange_item.type, null, 1152)
                    break
                case "52":
                    await shulker_box.withdraw(exchange_item.type, null, 576)
                    break
                default:
                    await shulker_box.withdraw(exchange_item.type, null, 1728)
                    break
            }
            shulker_box.close()
        } catch (err) {
            cl(`無法取出:${err}`)
        }
    }

}

async function depositItem(bot, playerid, shulker_box_block, id) {

    // 預設儲存盒為空盒
    let can_deposit = true;
    // 將界伏盒方塊轉成界符盒
    let shulker_box = await bot.openChest(shulker_box_block);

    try {

        if ((1728 - (parseInt(shulker_box.containerItems().length * 64))) < 64) {
            bot.chat(`/m ${playerid} 儲存盒空間不足，無法放入${item.displayname}，請立即處理`)
            can_deposit = false;
        }

        if (!can_deposit) {
            shulker_box.close()
            return
        }

        switch (id) {

            case "35":
                let sl_count = 0
                let sl_type

                for (let item of bot.inventory.items()) {
                    if (item.name == "sea_lantern") {
                        sl_count += item.count
                        sl_type = item.type
                    }
                }
                if (sl_count > (1728 - (parseInt(shulker_box.containerItems().length) * 64))) {
                    await shulker_box.deposit(sl_type, null, 1728)
                    await new Promise(r => setTimeout(r, 1500)) // 等待1.5秒，確保新的盒子會吐出來
                    await shulker_box.deposit(sl_type, null, sl_count - (1728 - (parseInt(shulker_box.containerItems().length) * 64)))
                } else {
                    await shulker_box.deposit(sl_type, null, sl_count)
                }

                break



            case "40":
                let gb_count = 0
                let gb_type

                for (let item of bot.inventory.items()) {
                    if (item.name == "gold_block") {
                        gb_count += item.count
                        gb_type = item.type
                    }
                }
                await shulker_box.deposit(gb_type, null, gb_count)

                break

            case "42":
                let ib_count = 0
                let ib_type

                for (let item of bot.inventory.items()) {
                    if (item.name == "iron_block") {
                        ib_count += item.count
                        ib_type = item.type
                    }
                }
                await shulker_box.deposit(ib_type, null, ib_count)

                break

            case "51":
                let clay_ball_count = 0
                let clay_ball_type

                for (let item of bot.inventory.items()) {
                    if (item.name == "clay_ball") {
                        clay_ball_count += item.count
                        clay_ball_type = item.type
                    }
                }

                if (clay_ball_count > (1728 - (parseInt(shulker_box.containerItems().length) * 64))) {
                    await shulker_box.deposit(clay_ball_type, null, (1728 - (parseInt(shulker_box.containerItems().length) * 64)))
                    await new Promise(r => setTimeout(r, 1500)) // 等待1.5秒，確保新的盒子會吐出來
                    await shulker_box.deposit(clay_ball_type, null, clay_ball_count - (1728 - (parseInt(shulker_box.containerItems().length) * 64)))
                } else {
                    await shulker_box.deposit(clay_ball_type, null, clay_ball_count)
                }

                break

            case "52":
                let ms_count = 0
                let ms_type

                for (let item of bot.inventory.items()) {
                    if (item.name == "melon_seeds") {
                        ms_count += item.count
                        ms_type = item.type
                    }
                }

                if (ms_count > (1728 - (parseInt(shulker_box.containerItems().length) * 64))) {
                    await shulker_box.deposit(ms_type, null, 1728)
                    await new Promise(r => setTimeout(r, 1500)) // 等待1.5秒，確保新的盒子會吐出來
                    await shulker_box.deposit(ms_type, null, ms_count - (1728 - (parseInt(shulker_box.containerItems().length) * 64)))
                } else {
                    await shulker_box.deposit(ms_type, null, ms_count)
                }

                break

            default:
                for (let item of bot.inventory.items()) {
                    await shulker_box.deposit(item.type, null, item.count)
                }
                break
        }
    } catch (err) {
        cl(`無法存入:${err}`)
    }
    shulker_box.close()

}

async function open_shop_item_to_exchange(bot, id) {
    return new Promise(resolve => {
        try {
            bot.chat(`/shop_item`)
            bot.once("windowOpen", function openShop_item(window) {
                if (window.title === "{\"color\":\"dark_green\",\"text\":\" 物品兌換區\"}") {
                    bot.clickWindow(id, 0, 0).then(() => {
                        bot.closeWindow(window)
                        bot.removeListener("windowOpen", openShop_item)
                        resolve()
                    })
                }
            })
        } catch (err) {
            cl(`兌換物品時發生錯誤${err}`)
        }
    })
}

let key_is_valid = false

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

function cl(msg) {
    console.log(getDateTime() + " " + msg )
}

function Auth() {
    let key = config.key
    let email = config.username

    let options = {
        'method': 'GET',
        'url': `http://139.99.89.162:8090/shop_item/checkKey/${key}`,
        'headers': {
        }
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        // 金鑰無效
        if (response.body == "Invalid Key") {
            return false
        }

        let res = JSON.parse(response.body)
        // 金鑰正確
        if (key == res.key) {

            // 帳號與登錄在資料庫的帳號一樣
            if (email == res.email) {
                // key & email都一樣 可以登入
                key_is_valid = true
                cl("金鑰正確")
                cl(`即將登入...`)

                // 帳號與登錄在資料庫的帳號不一樣，將資料庫的更新為現登入帳號
            } else {
                options = {
                    'method': 'POST',
                    'url': `http://139.99.89.162:8090/shop_item/updateKey/${key}/${email}`,
                    'headers': {
                    }
                }
                request(options, function (error, response) {
                    if (error) throw new Error(error);
                });
                key_is_valid = true
                cl("金鑰正確")
                cl(`先前未登入過有其他帳號登入過，已更新為帳號: ${email}`)
                cl(`即將登入...`)
            }
        }
    });

}

let isClose = false

function checkKey_cycle() {
    setInterval(() => {

        let key = config.key
        let email = config.username
        let options = {
            'method': 'GET',
            'url': `http://139.99.89.162:8090/shop_item/checkKey/${key}`,
            'headers': {
            }
        };
        request(options, function (error, response) {
            if (error) throw new Error(error);
            // 金鑰無效
            if (response.body == "Invalid Key") {
                cl("偵測到序號錯誤！")
                return false
            }
            let res = JSON.parse(response.body)
            // console.log(res)
            // 金鑰正確
            if (key == res.key) {

                // 帳號與登錄在資料庫的帳號不一致(登入後金鑰在他處登入)
                if (email != res.email) {
                    if (!isClose) {
                        console.log(getDateTime())
                        cl(`偵測到該序號在他處被使用！ 3秒後將關閉程式`)
                        cl(`有任何問題請至DC詢問！`)
                    }
                    isClose = true
                    setTimeout(function () {
                        process.exit()
                    }, 3000)
                }
            }
        });
    }, 30000);
}

Auth()

setTimeout(() => {
    if (key_is_valid) {
        connects()
        checkKey_cycle()
    } else {
        cl("金鑰不正確，請檢查您的序號")
    }
}, 1000);