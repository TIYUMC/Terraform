/**
 * data.js — 游戏配置数据
 * 所有可调参数集中在此，方便数值平衡。
 *
 * ── 结构导航（纯配置，按职责分区）──
 *   [季节系统]  SEASONS / DAYS_PER_SEASON / SEASONS_PER_YEAR
 *   [时间系统]  START_HOUR / END_HOUR / REAL_SECS_PER_GAME_HOUR
 *   [工具体力]  TOOL_COST / STAMINA_REGEN_PER_MIN
 *   [作物种子]  CROPS
 *   [玩家初始]  PLAYER_START
 *   [农场网格]  FARM
 *   [资源树]    TREE
 *   [树场]      TREEFARM
 *   [商店物品]  SHOP_ITEMS
 *   [任务书]    QUESTS  (Advancement 进度树：数据驱动，接游戏事件自动点亮)
 */
const DATA = {
  // === 季节系统 ===
  SEASONS: ['春', '夏', '秋', '冬'],
  DAYS_PER_SEASON: 15,
  SEASONS_PER_YEAR: 4,

  // === 时间系统 ===
  START_HOUR: 6,   // 6:00 起床
  END_HOUR: 24,    // 24:00 强制睡觉 (午夜)
  REAL_SECS_PER_GAME_HOUR: 12, // 每游戏小时 = 12 秒，一天≈3.6分钟

  // === 工具 & 体力消耗 ===
  TOOL_COST: {
    hoe: 4,         // 耕地
    water: 3,       // 浇一株
    harvest: 2,     // 收一株
    plant: 1,       // 播种
    axe: 5,         // 砍树
  },

  // 体力自动恢复速率（每游戏分钟恢复的点数，调小 = 恢复更慢）
  STAMINA_REGEN_PER_MIN: 0.03,

  // === 种子数据 ===
  CROPS: {
    wheat: {
      name: '小麦', seedCost: 1, sellPrice: 3, color: '#BFD07A',
      growDays: 4, regrow: false,
      sprite: '🌱', harvestSprite: '🌾',
      assetStages: ['wheat_stage0', 'wheat_stage2', 'wheat_stage4', 'wheat_stage6', 'wheat_stage7'],
      assetHarvest: '小麦', // 背包图标用「收获篮」png（用户明确要求：背包显示篮子图）；地里不受影响（已解耦，读 assetStages）
      shopSellIcon: '小麦', // shop 卖行同样用篮子图，与背包一致
    },
    potato: {
      name: '土豆', seedCost: 4, sellPrice: 12, color: '#9DBB6A',
      growDays: 6, regrow: false,
      sprite: '🌿', harvestSprite: '🥔',
      assetStages: ['potatoes_stage0', 'potatoes_stage1', 'potatoes_stage2', 'potatoes_stage3'],
      assetHarvest: 'potato',
    },
    strawberry: {
      name: '甜浆果', seedCost: 15, sellPrice: 45, color: '#8FCA7A',
      growDays: 8, regrow: true, regrowDays: 3,
      sprite: '🌱', harvestSprite: '🍓',
      assetStages: ['sweet_berry_bush_stage0', 'sweet_berry_bush_stage1', 'sweet_berry_bush_stage2', 'sweet_berry_bush_stage3'],
      assetHarvest: 'sweet_berry_bush_stage3',
      shopSellIcon: 'mc_sweet_berries', // shop 卖行用甜浆果物品图，而非灌木生长图
    },
    acorn: {
      name: '橡果', seedCost: 3, sellPrice: 6, color: '#8B5A2B',
      growDays: 0, regrow: false,
      sprite: '🌰', harvestSprite: '🌰',
      assetStages: [],
      assetHarvest: 'acorn',
    },
  },

  // === 玩家初始状态 ===
  PLAYER_START: {
    money: 0,   // 开局无金币；开「初来乍到」后 0.2s 自动完成，获锄头+水桶+5金
    stamina: 20,
    maxStamina: 20,
  },

  // === 农场 ===
  FARM: {
    COLS: 12,
    ROWS: 10,
    CELL_SIZE: 48,  // px — 会在运行时根据 canvas 调整
  },

  // === 资源树（可砍伐）===
  // stage: grown=已长成可被斧头砍倒（掉木头+橡果）；sapling=树场种下橡果长出的树苗，按 acornGrowDays 长成 grown。
  // ⚠ 树桩(stump)阶段已移除：砍后 trees[r][c]=null 直接消失，由树场每日随机补树（见 TREEFARM）。
  // 木头可用于背包 2×2 合成格制木板、也是任务回收物。init 为预置在主农场的树坐标 [row,col]（现为空，树都移到树场）。
  TREE: {
    woodYieldMin: 2,
    woodYieldMax: 4,
    regrowDays: 4,                 // ⚠ 已无引用（树桩阶段已移除），保留待清理
    acornYieldMin: 1,            // 砍树掉落的「橡果」数量下限（可种回树场，形成可循环）
    acornYieldMax: 3,            // 砍树掉落的「橡果」数量上限
    acornGrowDays: 4,            // 种下的橡果先长树苗、再长成大树所需天数
    init: [], // 主农场不再预置树（树已移到独立树场 TreeFarm 场景，见 TREEFARM 配置）
  },

  // === 树场（独立子场景：资源出口，C1 经济闭环延伸）===
  // 与主农场 Farm 解耦：专门一张树场地图，固定大小、区域内随机生成（防通胀）。
  // 与主农场共用 12×10 网格尺寸（渲染/画布逻辑不变），最多 MAX_TREES 棵封顶（产能上限），
  // 每天随机补几棵至上限（REFILL_PER_DAY）；砍树后直接消失（无树桩阶段），由玩家种橡果(acorn)长回。
  TREEFARM: {
    MAX_TREES: 10,        // 树木上限（防通胀：木头产能封顶）→ 约 1/12 格（12×10=120 格），用户要求从 20 再减半到 10
    INIT_TREES: 6,        // 开局预置树数（< 上限，留出每日补树空间）；用户要求初始 6 棵
    REFILL_PER_DAY: 3,    // 每日随机补树上限（控率：防瞬时刷爆 / 长期枯竭）
    ROOT_CHANCE: 0.5,     // 树场锄头翻出「缠根泥土」的成功概率（根系太密，只有此概率成功；失败静默可重试）
    FROST_BUDGET_PER_SNOW: 8, // 一场雪的「树叶白化」共享额度（单位=1/8 档）：全场零和，随机撒给还没满的树；某树吃满 8 档则本场其余树没机会。想更白就调大
    unlockOn: 'g_tools', // 需完成「置办农具」任务才能进入树场（砍树解锁"林间初探"）
  },

  // === 商店物品（同时驱动「买种子」与「卖作物」两项交易）===
  SHOP_ITEMS: [
    { id: 'wheat',       name: '小麦种子',   cost: 1,  desc: '4天成熟 · 基础作物' },
    { id: 'potato',      name: '土豆',   cost: 4,  desc: '6天成熟 · 高收益' },
    { id: 'strawberry',  name: '甜浆果', cost: 15, desc: '8天成熟 · 可重复收获' },
    // 工具类：cost = 金锭花费；costItems = 附加材料（村民交易第二个输入槽）
    { id: 'axe',         name: '木斧头', cost: 15, type: 'tool',
      costItems: [{ id: 'wheat', count: 3 }],
      desc: '砍树必备 · 15金锭 + 3小麦',
      lockOn: 'g_tools' },  // 需完成「置办农具」任务
    // 橡果：种树场用，3金/颗
    { id: 'acorn',       name: '橡果',   cost: 3,
      desc: '树场专用 · 3金/颗',
      lockOn: 'g_forage' },  // 需完成「林间初探」任务
  ],

  // === 花朵物种注册表（数组下标+1 = Farm.flowers[r][c] 的花种编号；0=无花）===
  // key    : ASSETS.registry 贴图键（必须已注册，否则渲染裂图）
  // name   : 中文名（锄花提示、调试用）
  // colors : 锄花时 _spawnBurst 的花瓣粒子配色（取自该花本身的颜色）
  // 扩展花种：往数组**尾部追加**一项即可，farm.js / ui.js 都不用改（切勿插在中间——
  //          下标即存档里的花种编号，中间插入会让已有花朵变成别的品种）。
  FLOWERS: [
    { key: 'Allium',             name: '大花葱',       colors: ['#c77dff', '#e0aaff', '#d8b4f0', '#ffffff'] }, // 球状紫花
    { key: 'Azure_Bluet',        name: '蓝花美耳草',   colors: ['#ffffff', '#dbeeff', '#b8dcff', '#f2e08a'] }, // 白瓣蓝晕·黄蕊
    { key: 'Cornflower',         name: '矢车菊',       colors: ['#4a6bd6', '#6d8ce8', '#9db4f2', '#ffffff'] }, // 矢车菊蓝
    { key: 'Dandelion',          name: '蒲公英',       colors: ['#ffd93d', '#ffe873', '#f7c331', '#ffffff'] }, // 明黄
    { key: 'Lily_Of_The_Valley', name: '铃兰',         colors: ['#ffffff', '#f0f7ee', '#dcecd8', '#a8cfa0'] }, // 白铃·绿茎
    { key: 'Orange_Tulip',       name: '橙郁金香',     colors: ['#ff8c00', '#ffae42', '#ffd28a', '#fff0e0'] }, // 橙瓣·奶白晕
    { key: 'Oxeye_Daisy',        name: '牛眼雏菊',     colors: ['#ffffff', '#fafafa', '#f5d76e', '#f0c040'] }, // 白瓣·黄心
    { key: 'Peony',              name: '牡丹',         colors: ['#ff8fb1', '#ffb3c6', '#ffd6e0', '#e75a86'] }, // 粉牡丹
    { key: 'Pink_Tulip',         name: '粉郁金香',     colors: ['#ff9ec4', '#ffb8d6', '#ffd9e8', '#ffffff'] }, // 粉瓣·白晕
    { key: 'Poppy',              name: '虞美人',       colors: ['#e63946', '#ff5a5f', '#ff8a8f', '#c1121f'] }, // 红虞美人
    { key: 'Red_Tulip',          name: '红郁金香',     colors: ['#d62828', '#e63946', '#ff6b6b', '#9d0208'] }, // 红瓣郁金香
    { key: 'White_Tulip',        name: '白郁金香',     colors: ['#ffffff', '#f5f5f0', '#e8e8e0', '#dcdccf'] }, // 白瓣·浅灰晕
  ],

  // === 任务书（Advancement 进度树，数据驱动）===
  // ui.js._renderQuest 读此数组渲染；Quest 模块按 track 自动点亮（接游戏事件）。
  // track.k:
  //   'always'            开局即完成（根节点）
  //   累计事件名          配合 n=阈值：till/plant/harvest/chop/plantSapling/wood/earn
  //   'ownTool'+tool      实时读 Player.ownedTools[tool]
  // 坐标 x/y 为节点圆心(px)。布局：每个分类一条水平直线（节点间距 DX=75，y 统一 320，无分叉），
  // 由 _renderQuest 的 cover 缩放 + 拖拽漫游呈现（参考我的世界进度树）。详见下方「设计原则」。
  // cat: 分类键，对应 QUEST_TABS 的 id。core=主线；farm=种植支线；forage=采集支线；tools=工具支线（均单线）。
  // 设计原则（2026-08-09 重构）：
  //   1) 成链首尾呼应：每个分类排成一条水平直线，父节点 = 上一节点，前后连贯讲一个完整故事；
  //      顶端 root(初来乍到) 派生出 种植/采集/工具 三条支线，主线从「空手抵达」到「仓廪实」收尾呼应。
  //   2) 难度单调递增：同一指标阈值只增不减，不同指标按「生产流水线」顺序递进（开垦→播种→收获→售卖），
  //      绝不出现「一会儿简单一会儿难」的回退。
  //   3) 每个节点都有意义：参考 FTB 进度，删去同指标递增刷数节点(开垦10/30、砍树10/25、收获200等)与 challenge 奖励节点，仅留清晰里程碑（首达成/阶段跃迁）。
  //   4) 布局：每分类一条水平直线，节点间距 DX=75，y 统一 320（由 _renderQuest 的 cover 缩放 + 拖拽漫游呈现）。
    QUESTS: [
    // —— 主线：教程+里程碑+机制说明连续一条直线（y=350，0.9.1 root 改游戏简介、插 n_stamina/n_season/n_time/n_fallow，x 统一 80px 间距）——
    { id:'root',     parent:null,       x:80,   y:350, icon:'book_purple', title:'游戏简介', desc:'欢迎来到 Terraform，一款像素风农场经营游戏：开垦田地、播种、浇水、收获，把作物卖掉换钱，再买种子和工具一步步扩大农场。游戏按四季流转（每季 15 天），下雨会自动浇地，时间从清晨 6 点一路走到午夜；跟着任务书的节点走，所有玩法都会手把手教你。存档全自动：每天午夜自动保存、工具栏「存档」按钮随时手动保存、关闭页面也会静默保存；标题页可从 3 个存档槽读档继续或开新游戏。', cat:'core', manual:true, track:{k:'manual'}, reward:{ items:[{id:'hoe', count:1},{id:'water', count:1}], money:5} },
    { id:'tut1',     parent:'root',     x:160,  y:350, icon:'bundle_filled', title:'启程礼包', desc:'点击本节点领取 5 颗小麦种子用于播种（锄头、水桶已在「游戏简介」领取）。', cat:'core', manual:true, tutorial:true, reward:{ items:[{id:'seed:wheat', count:5}] } },
    { id:'tut_hoe',  parent:'tut1',     x:240,  y:350, icon:'wooden_hoe', title:'锄头使用', desc:'点击下方工具栏选择锄头，左键点击草地将其清除，再次点击裸土即可耕地。', cat:'core', manual:true, tutorial:true },
    { id:'tut_grass',parent:'tut_hoe',  x:320,  y:350, icon:'short_dry_grass', title:'除草方法', desc:'地面上长着草，选择锄头清除即可露出裸土，随后可耕为田地。除草有 20% 几率掉 1~2 颗小麦种子（自动进背包）。', cat:'core', manual:true, tutorial:true },
    { id:'a1',       parent:'tut_grass',x:400,  y:350, icon:'dirt', title:'开垦田地', desc:'用锄头点击草地或裸土，将其变为耕地。耕地是种植作物的基础。', cat:'core', track:{k:'till', n:1} },
    { id:'tut_seed', parent:'a1',       x:480,  y:350, icon:'wheat_seeds', title:'播种方法', desc:'在商店购买小麦种子，会自动进入快捷栏；选中种子后左键点击耕地播种。', cat:'core', manual:true, tutorial:true },
    { id:'tut_water',parent:'tut_seed', x:560,  y:350, icon:'water_bucket', title:'浇水技巧', desc:'点击下方工具栏选择水壶，左键点击已播种耕地浇水。下雨时自动浇灌。', cat:'core', manual:true, tutorial:true },
    { id:'n_stamina',parent:'tut_water',x:640,  y:350, icon:'stamina', title:'体力管理', desc:'每次农事动作都消耗体力：耕地 4 点、浇一株 3 点、收一株 2 点、播种 1 点、砍树 5 点。体力上限 20 点，会随时间缓慢自动恢复；体力耗尽也能干活，只是会没有余力。', cat:'core', manual:true, track:{k:'manual'} },
    { id:'n_season', parent:'n_stamina',x:720,  y:350, icon:'leaf_0', title:'季节与天气', desc:'一年分春夏秋冬四季、每季 15 天，作物生长不看季节、季节主要影响野草退化（秋冬草快速枯黄）。天气在晴/雨/大风间随机切换：下雨时耕地自动浇灌（免手动浇水）、冬季雨变雪不浇灌。', cat:'core', manual:true, track:{k:'manual'} },
    { id:'n_time',   parent:'n_season', x:800,  y:350, icon:'moon', title:'游戏时间', desc:'每天从 6:00 开始，时间不断流逝，到 24:00 午夜自动结算当天、进入新的一天。', cat:'core', manual:true, track:{k:'manual'} },
    { id:'tut_inv',  parent:'n_time',   x:880,  y:350, icon:'book_purple', title:'背包操作', desc:'点击底部工具栏的背包按钮打开背包，左键拖拽移动物品，右键点击物品可拿走一半', cat:'core', manual:true, tutorial:true },
    { id:'m3',       parent:'tut_inv',  x:960,  y:350, icon:'wheat_seeds', title:'初次收获', desc:'选择锄头，左键点击已成熟（金黄饱满）的作物即可收获。', cat:'core', track:{k:'harvest', n:1} },
    { id:'tut_harvest',parent:'m3',     x:1040, y:350, icon:'wheat_seeds', title:'收获作物', desc:'选择锄头，左键点击完全成熟的作物即可收获。各作物成熟天数不同：小麦 4 天、土豆 6 天、甜浆果 8 天（甜浆果收获后 3 天可再收一次）。', cat:'core', manual:true, tutorial:true },
    { id:'n_fallow', parent:'tut_harvest',x:1120, y:350, icon:'coarse_dirt', title:'休耕与退化', desc:'耕地若连续 60 天闲置（不种作物）会自然退化回土，需重新除草开垦才能再种；野草也随季节逐步枯黄退化回裸土。', cat:'core', manual:true, track:{k:'manual'} },
    { id:'tut_sell', parent:'n_fallow', x:1200, y:350, icon:'money', title:'出售赚钱', desc:'完成「初次收获」后商店按钮才会显示；点击商店按钮，将作物拖入出售输入框即可完成交易换取金锭。', cat:'core', manual:true, tutorial:true },
    { id:'m4',       parent:'tut_sell', x:1280, y:350, icon:'money', title:'第一桶金', desc:'累计赚取 30 金锭，农场初具规模', cat:'core', track:{k:'earn', n:30} },
    { id:'tut_craft',parent:'m4',       x:1360, y:350, icon:'command_block', title:'合成系统', desc:'点击底部工具栏的背包按钮，将材料放入左上角2×2合成格，点击成品收入背包', cat:'core', manual:true, tutorial:true },
    { id:'tut_wood', parent:'tut_craft',x:1440, y:350, icon:'oak_log', title:'砍伐树木', desc:'先获得斧头（在商店购买），选中后前往树场（按 T 键切换）点击树木砍伐。砍树掉 1~3 颗橡果，种回树场 4 天长成新树；树场每天随机补树且有总数上限，被砍的树直接消失。', cat:'core', manual:true, tutorial:true },

    // —— 耕作支线（挂在主线下方）——
    { id:'fa1',  parent:'tut_grass',  x:500,  y:500, icon:'wheat_seeds', title:'镇上粮仓', desc:'将 20 份新收小麦送进镇上粮仓储备过冬，换取 10 颗土豆种子', cat:'farm', manual:true, track:{k:'submit', item:'crop:wheat', n:20}, reward:{ items:[{id:'seed:potato', count:10}] } },
    { id:'fa2',  parent:'fa1',     x:620,  y:500, icon:'wheat_seeds', title:'丰收宴席', desc:'为镇上丰收庆典供应 40 份麦穗，换取 30 金锭酬金', cat:'farm', manual:true, track:{k:'submit', item:'crop:wheat', n:40}, reward:{ money:30 } },

    // —— 采集支线（挂在主线下方）——
    { id:'fo1',  parent:'tut_wood', x:1400, y:500, icon:'oak_log', title:'林间驿站', desc:'为林间驿站供应 20 份原木修缮木屋，换取 5 颗甜浆果种子', cat:'forage', manual:true, track:{k:'submit', item:'wood', n:20}, reward:{ items:[{id:'seed:strawberry', count:5}] } },
    { id:'fo2',  parent:'fo1',     x:1520, y:500, icon:'sunflower', title:'猎人补给', desc:'向深山猎人补给 40 份原木，换取 50 金锭犒赏', cat:'forage', manual:true, track:{k:'submit', item:'wood', n:40}, reward:{ money:50 } },

    // —— 工匠支线（挂在主线下方）——
    { id:'to1',  parent:'tut_craft',  x:1300, y:500, icon:'chest', title:'木工坊供货', desc:'向木工坊交付 16 块木板，换取一把木斧头', cat:'tools', manual:true, track:{k:'submit', item:'planks', n:16}, reward:{ items:[{id:'axe', count:1}] } },
    { id:'to2',  parent:'to1',     x:1420, y:500, icon:'command_block', title:'建筑委托', desc:'承接镇上建筑委托，交付 32 块木板换取 60 金锭', cat:'tools', manual:true, track:{k:'submit', item:'planks', n:32}, reward:{ money:60 } },

    // —— 解锁链（独立一行，在所有主线下方）——
    { id:'g_farm',   parent:'tut_wood', x:100,  y:700, icon:'wheat_seeds', title:'▶ 播种耕作', desc:'种植 1 株作物。完成后解锁「耕作」任务页', cat:'core', track:{k:'plant', n:1}, manual:true },
    { id:'g_tools',  parent:'g_farm',   x:250,  y:700, icon:'chest', title:'▶ 置办农具', desc:'拥有 1 把斧头（商店购买）。完成后解锁「工匠」任务页', cat:'core', track:{k:'ownTool', tool:'axe'}, manual:true },
    { id:'g_forage', parent:'g_tools',  x:400,  y:700, icon:'oak_log', title:'▶ 林间初探', desc:'砍伐 1 棵树木。完成后解锁「采集」任务页', cat:'core', track:{k:'chop', n:1}, manual:true },
  ],
  // 选项卡（分类页签）。id 与 QUESTS[].cat 对应；
  // tab/selected 为选项卡底图贴图 key；icon 为该分类在选项卡上的代表物贴图 key。
  // 渲染时按数组次序拼成 Above_Left / Above_Middle×(N-2) / Above_Right 的小方格条。
  QUEST_TABS: [
    { id:'core',   label:'入门指南', icon:'book_purple', tab:'advancement_tab_above_left',  selected:'advancement_tab_above_left_selected' },
    // 支线选项卡：prereq 指向主线(入门)的「网关」任务 id，未完成前选项卡显示锁且不可点开；
    // 每个支线在主线各有一个专属网关(g_farm/g_forage/g_tools)，完成即解锁对应支线，其 desc 写明解锁提示。
    { id:'farm',   label:'耕作',     icon:'wheat_seeds', tab:'advancement_tab_above_middle',  selected:'advancement_tab_above_middle_selected', prereq:'g_farm' },
    { id:'forage', label:'采集',     icon:'oak_log',     tab:'advancement_tab_above_middle',  selected:'advancement_tab_above_middle_selected', prereq:'g_forage' },
    { id:'tools',  label:'工匠',     icon:'oak_log',  tab:'advancement_tab_above_middle',  selected:'advancement_tab_above_middle_selected', prereq:'g_tools' },
  ],

  // === 合成配方（MC 2×2 合成格，数据驱动；shapeless：只看格内物品数量，不看位置）===
  // 每条：in={物品id:所需数量}，out={item:产出id, count:产出数量}。
  // 产出 = out.count * floor(格内该物品总数 / in.数量)（如 1 原木→4 木板；N 原木→4N）。
  // 物品 id 与 Player 字段映射见 inventory.js 的 _craftResField。
  CRAFT_2X2: [
    { in: { oak_log: 1 }, out: { item: 'oak_planks', count: 4 } },
  ],

  // === 天气参数（删大雾：移除雾相关全部参数，仅留大风散场淡出秒数；雾系统已彻底删除，零玩法影响）===
  WEATHER: {
    windFadeSec: 0.6,   // 大风散场淡出秒数
  },
};
