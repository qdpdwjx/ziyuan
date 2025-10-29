// ignore
//@name:[嗅]新视觉影院
//@version:1
//@webSite:https://www.sypfjy.com
//@remark:
// ignore

// 适用于 把鼠标放在视频封面上 可以右键 复制正确链接的网站
// 不能保证一定能用，不能用的欢迎反馈

/// 是否模拟 PC 是 1， 手机是 0
const isUsePC = 1
/// 默认应该是 0，当视频不能播放的时候，可以把这个设置为 1， 否则不要改动
const isAddReferer = 1

// 网站主页
const webSite = 'https://www.sypfjy.com'
// 网站搜索
// https://www.sypfjy.com/vodsearch%E9%9A%BE%E5%93%84.html
// 把网站主页变成 @{webSite} 把搜索词变成 @{searchWord}  把页码变成 @{page}
const searchUrl = '@{webSite}/vodsearch@{searchWord}.html'
// 当前网站任意视频详情页
// https://www.sypfjy.com/voddetail/152869.html
const videoDetailPage = '@{webSite}/voddetail/152869.html'
// 当前网站任意视频播放页
// https://www.sypfjy.com/vodplay/152869-4-1.html
const videoPlayPage = '@{webSite}/vodplay/152869-4-1.html'

// 保持不变
const filterListUrl = ''

const firstClass = [
    {
        name: '电影',
        // https://www.sypfjy.com/vodshow/dianying--------2---.html
        // 把网站主页变成 @{webSite}  把页码变成 @{page}
        id: '@{webSite}/vodshow/dianying--------@{page}---.html',
    },
    {
        name: '电视剧',
        // https://www.sypfjy.com/vodshow/dsj--------2---.html
        // 把网站主页变成 @{webSite}  把页码变成 @{page}
        id: '@{webSite}/vodshow/dsj--------@{page}---.html',
    },
    {
        name: '综艺',
        // https://www.sypfjy.com/vodshow/zongyi--------2---.html
        // 把网站主页变成 @{webSite}  把页码变成 @{page}
        id: '@{webSite}/vodshow/zongyi--------@{page}---.html',
    },
    {
        name: '动漫',
        // https://www.sypfjy.com/vodshow/dongman--------2---.html
        // 把网站主页变成 @{webSite}  把页码变成 @{page}
        id: '@{webSite}/vodshow/dongman--------@{page}---.html',
    },
    {
        name: '体育',
        // https://www.sypfjy.com/vodshow/tiyusaishi--------2---.html
        // 把网站主页变成 @{webSite}  把页码变成 @{page}
        id: '@{webSite}/vodshow/tiyusaishi--------@{page}---.html',
    },
    {
        name: '短剧',
        // https://www.sypfjy.com/vodshow/remenduanju--------2---.html
        // 把网站主页变成 @{webSite}  把页码变成 @{page}
        id: '@{webSite}/vodshow/remenduanju--------@{page}---.html',
    } 
]

// 下面这个不要有任何改动，且保持在最后一行，加载内置代码需要
// 下面这个不要有任何改动，且保持在最后一行，加载内置代码需要
// 下面这个不要有任何改动，且保持在最后一行，加载内置代码需要

//#BaseCode1#
