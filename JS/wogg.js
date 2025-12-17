import req from '../../util/req.js';
import { MAC_UA, formatPlayUrl } from '../../util/misc.js';
import { load } from 'cheerio';
import * as HLS from 'hls-parser';
import * as Ali from '../../util/ali.js';
import * as Quark from '../../util/quark.js';
import dayjs from 'dayjs';

let url = '';

async function request(reqUrl) {
    const res = await req.get(reqUrl, {
        headers: {
            'User-Agent': MAC_UA,
        },
    });
    return res.data;
}

// ali token 相关配置放在 index.config.js
/*
ali: {
    token: 'xxxxxxxxxxxxxxxxxxxxxxxxx',
    token280: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
},
wogg: {
    url: 'https://wogg.xyz',
},
*/
async function init(inReq, _outResp) {
    url = inReq.server.config.wogg.url;
    await Ali.initAli(inReq.server.db, inReq.server.config.ali);
    await Quark.initQuark(inReq.server.db, inReq.server.config.quark);
    return {};
}

async function home(_inReq, _outResp) {
    const html = await request(`${url}/index.php/vodshow/1-----------.html`);
    const $ = load(html);
    return {
        class: $('div.library-box-first a[href*=/vodshow/]')
            .map((_, a) => {
                return {
                    type_id: a.attribs.href.match(/vodshow\/(\d+)-----------.html/)[1],
                    type_name: a.attribs.title.replace(/片库|玩偶/g, ''),
                };
            })
            .get(),
    };
}

function fixImgUrl(imgUrl) {
    if (imgUrl.startsWith('/img.php?url=')) {
        return imgUrl.substr(13);
    }
    return imgUrl;
}

function getHrefInfoIdx(data) {
    const hrefs = Array.isArray(data) ? data : data.split('-');
    for (let j = 1; j < hrefs.length; j++) {
        if (hrefs[j] != '') {
            return j;
        }
    }
    return -1;
}

async function category(inReq, _outResp) {
    const tid = inReq.body.id;
    const pg = inReq.body.page;
    const extend = inReq.body.filters;
    let page = pg || 1;
    if (page == 0) page = 1;
    if (tid.startsWith('s-')) {
        const href = ['', '', '', '', '', '', '', '', '', '', page, '', '', ''];
        const tids = tid.split('-');
        href[parseInt(tids[1])] = tids[2];
        const html = await request(`${url}/index.php/vodsearch/${href.join('-')}.html`);
        const $ = load(html);
        const videos = $('div.module-items > div.module-search-item')
            .map((_, div) => {
                const t = $(div).find('div.video-info-header h3 a')[0];
                return {
                    vod_id: t.attribs.href.match(/voddetail\/(.*).html/)[1],
                    vod_name: t.attribs.title,
                    vod_pic: fixImgUrl($(div).find('div.module-item-pic img')[0].attribs['data-src']),
                    vod_remarks: $(div).find('a.video-serial').text(),
                };
            })
            .get();
        return {
            page: page,
            pagecount: videos.length < 10 ? page : page + 1,
            list: videos,
        };
    } else {
        const filters = [];
        let $ = null;
        if (page == 1 && Object.keys(extend).length == 0) {
            const html = await request(`${url}/index.php/vodshow/${tid}-----------.html`);
            $ = load(html);
            $('a.library-item-first').map((_, fa) => {
                const fva = $(fa.parent).find('div.library-list > a.library-item');
                if (fva.length > 0) {
                    const fvs = [];
                    let fkey = 0;
                    fva.each((i, va) => {
                        const href = va.attribs.href.match(/vodshow\/(.*).html/)[1];
                        const hrefs = href.split('-');
                        if (i == 0) {
                            fkey = getHrefInfoIdx(hrefs);
                            if (fkey != 2)
                                fvs.push({
                                    n: '全部',
                                    v: '',
                                });
                        }
                        fvs.push({
                            n: va.attribs.title.replace(/按|排序/g, ''),
                            v: decodeURIComponent(hrefs[fkey].toString()),
                        });
                    });
                    filters.push({
                        key: fkey.toString(),
                        name: '',
                        init: fvs[0].v,
                        value: fvs,
                    });
                }
            });
        }
        if ($ === null) {
            const href = [tid, '', '', '', '', '', '', '', page, '', '', ''];
            Object.keys(extend).forEach((e) => {
                href[parseInt(e)] = extend[e];
            });
            const html = await request(`${url}/index.php/vodshow/${href.join('-')}.html`);
            $ = load(html);
        }
        const videos = $('div.module-items > div.module-item')
            .map((_, div) => {
                const t = $(div).find('div.video-name a')[0];
                return {
                    vod_id: t.attribs.href.match(/voddetail\/(.*).html/)[1],
                    vod_name: t.attribs.title,
                    vod_pic: fixImgUrl($(div).find('div.module-item-pic img')[0].attribs['data-src']),
                    vod_remarks: $(div).find('div.module-item-text').text(),
                };
            })
            .get();
        const result = {
            page: page,
            pagecount: videos.length < 70 ? page : page + 1,
            list: videos,
        };
        if (filters.length > 0) {
            result.filter = filters;
        }
        return result;
    }
}

function conversion(bytes){
  let mb = bytes / (1024 * 1024);
  if(mb > 1024){
    return `${(mb/1024).toFixed(2)}GB`;
    }else{
        return `${parseInt(mb).toFixed(0)}MB`;
    }
}

async function detail(inReq, _outResp) {
    const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;
    const videos = [];
    for (const id of ids) {
        const html = await request(`${url}/index.php/voddetail/${id}.html`);
        const $ = load(html);
        const director = [];
        const actor = [];
        let year = '';
        $('div.video-info-items a[href*=/vodsearch/]').each((_, a) => {
            const hrefs = a.attribs.href.match(/vodsearch\/(.*).html/)[1].split('-');
            const name = $(a).text().trim();
            const idx = getHrefInfoIdx(hrefs);
            if (idx === 5) {
                const c = { id: 's-5-' + decodeURIComponent(hrefs[5].toString()), name: name };
                director.push(`[a=cr:${JSON.stringify(c)}/]${name}[/a]`);
            } else if (idx === 1) {
                const c = { id: 's-1-' + decodeURIComponent(hrefs[1].toString()), name: name };
                actor.push(`[a=cr:${JSON.stringify(c)}/]${name}[/a]`);
            } else if (idx === 13) {
                year = name;
            }
        });
        let vod = {
            vod_year: year,
            vod_actor: actor.join(', '),
            vod_director: director.join(', '),
            vod_content: $('div.video-info-content p[style*=none]')[0].children[0].data.trim(),
        };

        const shareUrls = $('div.module-row-info p')
            .map((_, p) => p.children[0].data)
            .get();
        const froms = [];
        const urls = [];
        for (const shareUrl of shareUrls) {
            const shareData = Ali.getShareData(shareUrl);
            if (shareData) {
                const videos = await Ali.getFilesByShareUrl(shareData);
                if (videos.length > 0) {
                    froms.push('阿里');
                    urls.push(
                        videos
                            .map((v) => {
                                const ids = [v.share_id, v.file_id, v.subtitle ? v.subtitle.file_id : ''];
                                const size = conversion(v.size);
                                return formatPlayUrl('', ` ${v.name.replace(/.[^.]+$/,'')}  [${size}]`) + '$' + ids.join('*');
								 
                            })
                            .join('#'),
                    );
                }
            } else {
                const shareData = Quark.getShareData(shareUrl);
                if (shareData) {
                    const videos = await Quark.getFilesByShareUrl(shareData);
                    if (videos.length > 0) {
                        froms.push('夸克');
                        urls.push(
                            videos
                                .map((v) => {
                                    const ids = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                                    const size = conversion(v.size);
                                    return formatPlayUrl('', ` ${v.file_name.replace(/.[^.]+$/,'')}  [${size}]`) + '$' + ids.join('*');
                                })
                                .join('#'),
                        );
                    }
                }
            }
        }
        vod.vod_play_from = froms.join('$$$');
        vod.vod_play_url = urls.join('$$$');
        videos.push(vod);
    }
    return {
        list: videos,
    };
}

const aliTranscodingCache = {};
const aliDownloadingCache = {};

const quarkTranscodingCache = {};
const quarkDownloadingCache = {};

async function proxy(inReq, outResp) {
    await Ali.initAli(inReq.server.db, inReq.server.config.ali);
    await Quark.initQuark(inReq.server.db, inReq.server.config.quark);
    const site = inReq.params.site;
    const what = inReq.params.what;
    const shareId = inReq.params.shareId;
    const fileId = inReq.params.fileId;
    if (site == 'ali') {
        if (what == 'trans') {
            const flag = inReq.params.flag;
            const end = inReq.params.end;

            if (aliTranscodingCache[fileId]) {
                const purl = aliTranscodingCache[fileId].filter((t) => t.template_id.toLowerCase() == flag)[0].url;
                if (parseInt(purl.match(/x-oss-expires=(\d+)/)[1]) - dayjs().unix() < 15) {
                    delete aliTranscodingCache[fileId];
                }
            }

            if (aliTranscodingCache[fileId] && end.endsWith('.ts')) {
                const transcoding = aliTranscodingCache[fileId].filter((t) => t.template_id.toLowerCase() == flag)[0];
                if (transcoding.plist) {
                    const tsurl = transcoding.plist.segments[parseInt(end.replace('.ts', ''))].suri;
                    if (parseInt(tsurl.match(/x-oss-expires=(\d+)/)[1]) - dayjs().unix() < 15) {
                        delete aliTranscodingCache[fileId];
                    }
                }
            }

            if (!aliTranscodingCache[fileId]) {
                const transcoding = await Ali.getLiveTranscoding(shareId, fileId);
                aliTranscodingCache[fileId] = transcoding;
            }

            const transcoding = aliTranscodingCache[fileId].filter((t) => t.template_id.toLowerCase() == flag)[0];
            if (!transcoding.plist) {
                const resp = await req.get(transcoding.url, {
                    headers: {
                        'User-Agent': MAC_UA,
                    },
                });
                transcoding.plist = HLS.parse(resp.data);
                for (const s of transcoding.plist.segments) {
                    if (!s.uri.startsWith('http')) {
                        s.uri = new URL(s.uri, transcoding.url).toString();
                    }
                    s.suri = s.uri;
                    s.uri = s.mediaSequenceNumber.toString() + '.ts';
                }
            }

            if (end.endsWith('.ts')) {
                outResp.redirect(transcoding.plist.segments[parseInt(end.replace('.ts', ''))].suri);
                return;
            } else {
                const hls = HLS.stringify(transcoding.plist);
                let hlsHeaders = {
                    'content-type': 'audio/x-mpegurl',
                    'content-length': hls.length.toString(),
                };
                outResp.code(200).headers(hlsHeaders);
                return hls;
            }
        } else {
            const flag = inReq.params.flag;
            if (aliDownloadingCache[fileId]) {
                const purl = aliDownloadingCache[fileId].url;
                if (parseInt(purl.match(/x-oss-expires=(\d+)/)[1]) - dayjs().unix() < 15) {
                    delete aliDownloadingCache[fileId];
                }
            }
            if (!aliDownloadingCache[fileId]) {
                const down = await Ali.getDownload(shareId, fileId, flag == 'down');
                aliDownloadingCache[fileId] = down;
            }
            outResp.redirect(aliDownloadingCache[fileId].url);
            return;
        }
    } else if (site == 'quark') {
        let downUrl = '';
        const ids = fileId.split('*');
        const flag = inReq.params.flag;
        if (what == 'trans') {
            if (!quarkTranscodingCache[ids[1]]) {
                quarkTranscodingCache[ids[1]] = (await Quark.getLiveTranscoding(shareId, decodeURIComponent(ids[0]), ids[1], ids[2])).filter((t) => t.accessable);
            }
            downUrl = quarkTranscodingCache[ids[1]].filter((t) => t.resolution.toLowerCase() == flag)[0].video_info.url;
            outResp.redirect(downUrl);
            return;
        } else {
            if (!quarkDownloadingCache[ids[1]]) {
                const down = await Quark.getDownload(shareId, decodeURIComponent(ids[0]), ids[1], ids[2], flag == 'down');
                if (down) quarkDownloadingCache[ids[1]] = down;
            }
            downUrl = quarkDownloadingCache[ids[1]].download_url;
            if (flag == 'redirect') {
                outResp.redirect(downUrl);
                return;
            }
        }
        return await Quark.chunkStream(
            inReq,
            outResp,
            downUrl,
            ids[1],
            Object.assign(
                {
                    Cookie: Quark.cookie,
                },
                Quark.baseHeader,
            ),
        );
    }
}

function findElementIndex(arr, elem) {
  return arr.indexOf(elem);
}

async function play(inReq, _outResp) {
    const flag = inReq.body.flag;
    const id = inReq.body.id;
    const ids = id.split('*');
    let idx = 0;
    if (flag.startsWith('ali')) {
        const transcoding = await Ali.getLiveTranscoding(ids[0], ids[1]);
        aliTranscodingCache[ids[1]] = transcoding;
        transcoding.sort((a, b) => b.template_width - a.template_width);
        const p= ['超清','高清','标清','普画','极速'];
        const arr =['QHD','FHD','HD','SD','LD'];
        const urls = [];
        const proxyUrl = inReq.server.address().url + inReq.server.prefix + '/proxy/ali';
        urls.push('原画');
        urls.push(`${proxyUrl}/src/down/${ids[0]}/${ids[1]}/.bin`);
        const result = {
            parse: 0,
            url: urls,
        };
        if (ids[2]) {
            result.extra = {
                subt: `${proxyUrl}/src/subt/${ids[0]}/${ids[2]}/.bin`,
            };
        }
        transcoding.forEach((t) => {
            idx = findElementIndex(arr,t.template_id);
            urls.push(p[idx]);
            urls.push(`${proxyUrl}/trans/${t.template_id.toLowerCase()}/${ids[0]}/${ids[1]}/.m3u8`);
        });
        return result;
    } else if (flag.startsWith('quark')) {
        const transcoding = (await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter((t) => t.accessable);
        quarkTranscodingCache[ids[2]] = transcoding;
        const p= ['4K','超清','高清','标清','普画','极速'];
        const arr =['4k','2k','super','high','low','normal'];
        const urls = [];
        const proxyUrl = inReq.server.address().url + inReq.server.prefix + '/proxy/quark';
		urls.push('代理');
        urls.push(`${proxyUrl}/src/down/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[2]}*${ids[3]}/.bin`);
        urls.push('原画');
        urls.push(`${proxyUrl}/src/redirect/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[2]}*${ids[3]}/.bin`); 
        const result = {
            parse: 0,
            url: urls,
            header: Object.assign(
                {
                    Cookie: Quark.cookie,
                },
                Quark.baseHeader,
            ),
        };
        if (ids[3]) {
            result.extra = {
                subt: `${proxyUrl}/src/subt/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[4]}*${ids[5]}/.bin`,
            };
        }
            transcoding.forEach((t) => {
            idx = findElementIndex(arr,t.resolution);
            urls.push(p[idx]);
            urls.push(`${proxyUrl}/trans/${t.resolution.toLowerCase()}/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[2]}*${ids[3]}/.mp4`);
        });
        return result;
    }
}

async function search(inReq, _outResp) {
    const pg = inReq.body.page;
    const wd = inReq.body.wd;
    let page = pg || 1;
    if (page == 0) page = 1;
    const html = await request(`${url}/index.php/vodsearch/-------------.html?wd=${wd}`);
    const $ = load(html);
    const videos = $('div.module-items > div.module-search-item')
        .map((_, div) => {
            const t = $(div).find('div.video-info-header h3 a')[0];
            return {
                vod_id: t.attribs.href.match(/voddetail\/(.*).html/)[1],
                vod_name: t.attribs.title,
                vod_pic: fixImgUrl($(div).find('div.module-item-pic img')[0].attribs['data-src']),
                vod_remarks: $(div).find('a.video-serial').text(),
            };
        })
        .get();
    return {
        page: page,
        pagecount: videos.length < 10 ? page : page + 1,
        list: videos,
    };
}



async function test(inReq, outResp) {
    try {
        const printErr = function (json) {
            if (json.statusCode && json.statusCode == 500) {
                console.error(json);
            }
        };
        const prefix = inReq.server.prefix;
        const dataResult = {};
        let resp = await inReq.server.inject().post(`${prefix}/init`);
        dataResult.init = resp.json();
        printErr(resp.json());
        resp = await inReq.server.inject().post(`${prefix}/home`);
        dataResult.home = resp.json();
        printErr(resp.json());
        if (dataResult.home.class.length > 0) {
            resp = await inReq.server.inject().post(`${prefix}/category`).payload({
                id: dataResult.home.class[0].type_id,
                page: 1,
                filter: true,
                filters: {},
            });
            dataResult.category = resp.json();
            printErr(resp.json());
            if (dataResult.category.list.length > 0) {
                resp = await inReq.server.inject().post(`${prefix}/detail`).payload({
                    id: dataResult.category.list[0].vod_id, // dataResult.category.list.map((v) => v.vod_id),
                });
                dataResult.detail = resp.json();
                printErr(resp.json());
                if (dataResult.detail.list && dataResult.detail.list.length > 0) {
                    dataResult.play = [];
                    for (const vod of dataResult.detail.list) {
                        const flags = vod.vod_play_from.split('$$$');
                        const ids = vod.vod_play_url.split('$$$');
                        for (let j = 0; j < flags.length; j++) {
                            const flag = flags[j];
                            const urls = ids[j].split('#');
                            for (let i = 0; i < urls.length && i < 2; i++) {
                                resp = await inReq.server
                                    .inject()
                                    .post(`${prefix}/play`)
                                    .payload({
                                        flag: flag,
                                        id: urls[i].split('$')[1],
                                    });
                                dataResult.play.push(resp.json());
                            }
                        }
                    }
                }
            }
        }
        resp = await inReq.server.inject().post(`${prefix}/search`).payload({
            wd: '爱',
            page: 1,
        });
        dataResult.search = resp.json();
        printErr(resp.json());
        return dataResult;
    } catch (err) {
        console.error(err);
        outResp.code(500);
        return { err: err.message, tip: 'check debug console output' };
    }
}

export default {
    meta: {
        key: 'wogg',
        name: '🟢 玩偶',
        type: 3,
    },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
        fastify.get('/proxy/:site/:what/:flag/:shareId/:fileId/:end', proxy);
        fastify.get('/test', test);
    },
};