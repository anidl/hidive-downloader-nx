#!/usr/bin/env node

// modules build-in
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// package json
const pkg = require('./package');

// program name
console.log(`\n=== HIDIVE Downloader NX ${pkg.version} ===\n`);
const modulesFolder = path.join(__dirname,'modules');

// modules extra
const yaml    = require('yaml');
const shlp    = require('sei-helper');
const yargs   = require('yargs');

// net requests
const got     = require('got');
const agent   = require('proxy-agent');
const url     = require('url');

// m3u8 and vtt
const m3u8     = require('m3u8-parsed');
const streamdl = require('hls-download');
const vtt      = require(modulesFolder+'/module.vttconvert');

// api config
const api      = require(modulesFolder+'/module.apiclient');
const langCode = require(modulesFolder+'/module.langs');

// config
const configFile  = path.join(modulesFolder,'config.main.yml');
const profileFile = path.join(modulesFolder,'config.profile.yml');
const sessionFile = path.join(modulesFolder,'config.session.yml');

// client default
let client = {
    // base
    ipAddress : '',
    xNonce    : '',
    xSignature: '',
    // personal
    visitId : '',
    // profile data
    profile: {
        userId   : 0,
        profileId: 0,
        deviceId : '',
    },
};

// defaults
let cfg = {};

// check configs
if(!fs.existsSync(configFile)){
    console.log(`[ERROR] config file not found!`);
    process.exit();
}
else{
    cfg = yaml.parse(
        fs.readFileSync(configFile, 'utf8')
            .replace(/\${__dirname}/g,__dirname.replace(/\\/g,'/'))
    );
}

// load profile
if(fs.existsSync(profileFile)){
    client.profile = yaml.parse(fs.readFileSync(profileFile, 'utf8'));
}

// cookies
let session = {};

// load cookies
if(fs.existsSync(sessionFile)){
    session = yaml.parse(fs.readFileSync(sessionFile, 'utf8'));
}

// cli
let argv = yargs
    .wrap(Math.min(100))
    .usage('Usage: $0 [options]')
    .help(false).version(false)
    
    // login
    .describe('auth','Enter auth mode')
    
    // search
    .describe('search','Sets the show title for search')
    
    // params
    .describe('s','Sets the show id')
    .describe('e','Select episode ids (comma-separated, hyphen-sequence)')
    
    .describe('q','Video quality')
    .choices('q', ['360p','480p','720p','1080p'])
    .default('q', cfg.cli.videoQuality)
    
    .describe('dub','Select dub language')
    .choices('dub', Object.keys(langCode))
    .default('dub', cfg.cli.dubLanguage)
    
    .describe('br','Force download broadcast version instead of home video version (if both versions presents)')
    .boolean('br')
    
    .describe('nosubs','Skip download subtitles for non-japanese dub (if available)')
    .boolean('nosubs')
    
    // proxy
    .describe('proxy','http(s)/socks proxy WHATWG url (ex. https://myproxyhost:1080/)')
    .describe('proxy-auth','Colon-separated username and password for proxy')
    .describe('ssp','Ignore proxy settings for stream downloading')
    .boolean('ssp')
    
    .describe('mp4','Mux into mp4')
    .boolean('mp4')
    .default('mp4',cfg.cli.mp4mux)
    .describe('mks','Add subtitles to mkv (if available)')
    .boolean('mks')
    .default('mks',cfg.cli.muxSubs)
    .describe('caps','Caption subs only for non-Japanese dub / Full subs only for Japanese dub')
    .boolean('caps')
    .default('caps',cfg.cli.capsSubs)
    
    .describe('a','Filenaming: Release group (title tag)')
    .default('a',cfg.cli.releaseGroup)
    .describe('t','Filenaming: Series title override')
    .describe('ep','Filenaming: Episode number override (ignored in batch mode)')
    .describe('suffix','Filenaming: Filename suffix override (first "SIZEp" will be replaced with actual video size)')
    .default('suffix',cfg.cli.fileSuffix)
    
    // util
    .describe('stag','Custom title tag in subtitle file')
    .default('stag',cfg.cli.assTitleTag)
    .describe('rfont','Replace all default fonts with custom font in subtitle file')
    .default('rfont',cfg.cli.assFont)
    .describe('ftag','Custom title tag in muxed file info')
    .default('ftag',cfg.cli.muxTitleTag)
    .describe('nocleanup','Move temporary files to trash folder instead of deleting')
    .boolean('nocleanup')
    .default('nocleanup',cfg.cli.noCleanUp)
    
    // help
    .describe('h','Show this help')
    .alias('h','help')
    .boolean('h')
    .version(false)
    
    .argv;

// fn variables
let fnTitle = '',
    fnEpNum = '',
    fnSuffix = '',
    fnOutput = '',
    tsDlPath = false,
    sxList   = [],
    fontSize = 34;

// go to work folder
try {
    fs.accessSync(cfg.dir.content, fs.R_OK | fs.W_OK)
} catch (e) {
    console.log(e);
    console.log(`[ERROR] %s`,e.messsage);
    process.exit();
}
process.chdir(cfg.dir.content);

// select mode
if(argv.auth){
    doAuth();
}
else if(argv.search){
    doSearch();
}
else if(argv.s && !isNaN(parseInt(argv.s,10)) && parseInt(argv.s,10) > 0){
    getShow();
}
else{
    yargs.showHelp();
    process.exit();
}


// init
async function doInit(){
    if(!client.ipAddress){
        const newIp = await reqData('Ping', '');
        if(!newIp.ok){return false;}
        client.ipAddress = JSON.parse(newIp.res.body).IPAddress;
    }
    if(!client.profile.deviceId){
        const newDevice = await reqData('InitDevice', {"DeviceName":api.devName});
        if(!newDevice.ok){return false;}
        client.profile = Object.assign(client.profile,{
            deviceId: JSON.parse(newDevice.res.body).Data.DeviceId,
        });
        fs.writeFileSync(profileFile,yaml.stringify(client.profile));
    }
    if(!client.visitId){
        const newVisitId = await reqData('InitVisit', {});
        if(!newVisitId.ok){return false;}
        client.visitId = JSON.parse(newVisitId.res.body).Data.VisitId;
    }
    return true;
}

// Auth
async function doAuth(){
    const aInit = await doInit();
    if(!aInit){return;}
    console.log(`[INFO] Authentication`);
    const iLogin = await shlp.question(`[Q] LOGIN/EMAIL`);
    const iPsswd = await shlp.question(`[Q] PASSWORD   `);
    const auth = await reqData('Authenticate', {"Email":iLogin,"Password":iPsswd});
    if(!auth.ok){return;}
    const authData = JSON.parse(auth.res.body).Data;
    client.profile = Object.assign(client.profile, {
        userId:    authData.User.Id,
        profileId: authData.Profiles[0].Id,
    });
    fs.writeFileSync(profileFile,yaml.stringify(client.profile));
    console.log(`[INFO] Auth complete!`);
    console.log(`[INFO] Service level for "${iLogin}" is ${authData.User.ServiceLevel}`);
}

// Search
async function doSearch(){
    const aInit = await doInit();
    if(!aInit){return;}
    const searchItems = await reqData('Search', {"Query":argv.search});
    if(!searchItems.ok){return;}
    const sItems = JSON.parse(searchItems.res.body).Data.TitleResults;
    if(sItems.length>0){
         console.log(`[INFO] Search Results:`);
        for(let i=0;i<sItems.length;i++){
            console.log(`[#${sItems[i].Id}] ${sItems[i].Name} [${sItems[i].ShowInfoTitle}]`);
        }
    }
    else{
        console.log(`[ERROR] Nothing found!`);
    }
}

// get season
async function getShow(){
    const aInit = await doInit();
    if(!aInit){return;}
    const getShowData = await reqData('GetTitle', {"Id":argv.s});
    if(!getShowData.ok){return;}
    const showData = JSON.parse(getShowData.res.body).Data.Title;
    // console.log(yaml.stringify(showData));
    console.log(`[#${showData.Id}] ${showData.Name} [${showData.ShowInfoTitle}]`);
    // build inputed episodes
    let selEpsInp = argv.e ? argv.e.toString().split(',') : [], selEpsInpRanges = [];
    selEpsInp = selEpsInp.map((e)=>{
        if(e.match('-')){
            let eRegx = e.split('-');
            let eSplitNum, eFirstNum, eLastNum;
            if( eRegx.length == 2 && eRegx[0].match(/^s\d{2}e\d{3}$/i) && eRegx[1].match(/^\d{3}$/) ){
                eSplitNum = eRegx[0].split('e');
                eFirstNum = parseInt(eSplitNum[1]);
                eLastNum = parseInt(eRegx[1]);
                if(eFirstNum < eLastNum){
                    for(let i=eFirstNum;i<eLastNum+1;i++){
                        selEpsInpRanges.push(eSplitNum[0]+'e'+(('00'+i).slice(-3)).toLowerCase());
                    }
                    return '';
                }
                else{ return eRegx[0].toLowerCase(); }
            }
            else if( eRegx.length == 2 && eRegx[0].match(/^(ova|movie)(\d\d?)$/i) && eRegx[1].match(/^\d{2}$/)){
                eSplitNum = eRegx[0].match(/^(ova|movie)(\d\d?)$/i);
                eFirstNum = parseInt(eSplitNum[2]);
                eLastNum = parseInt(eRegx[1]);
                if(eFirstNum < eLastNum){
                    for(let i=eFirstNum;i<eLastNum+1;i++){
                        selEpsInpRanges.push(eSplitNum[1]+(('0'+i).slice(-2)).toLowerCase());
                    }
                    return '';
                }
                else{ return eRegx[0].toLowerCase(); }
            }
            else{ return e.toLowerCase(); }
        }
        else{ return e.toLowerCase(); }
    });
    selEpsInp = [...new Set(selEpsInp.concat(selEpsInpRanges))];
    // console.log(selEpsInp);
    // build selected episodes
    let selEpsArr = []; let ovaSeq = 1; let movieSeq = 1;
    for(let i=0;i<showData.Episodes.length;i++){
        let titleId = showData.Episodes[i].TitleId;
        let epKey = showData.Episodes[i].VideoKey;
        let nameLong = showData.Episodes[i].DisplayNameLong;
        if(nameLong.match(/OVA/i)){
            nameLong = 'ova'+(('0'+ovaSeq).slice(-2)); ovaSeq++;
        }
        else if(nameLong.match(/Theatrical/i)){
            nameLong = 'movie'+(('0'+movieSeq).slice(-2)); movieSeq++;
        }
        else{
            nameLong = epKey;
        }
        let sumDub = showData.Episodes[i].Summary.match(/^Audio: (.*)/m);
        sumDub = sumDub ? `\n - ${sumDub[0]}` : ``;
        let sumSub = showData.Episodes[i].Summary.match(/^Subtitles: (.*)/m);
        sumSub = sumSub ? `\n - ${sumSub[0]}` : ``;
        let selMark = '';
        if(selEpsInp.includes(epKey) || !epKey.match(/e(\d+)$/) && selEpsInp.includes(nameLong)){
            selEpsArr.push({titleId,epKey,nameLong});
            selMark = ' (selected)';
        }
        let epKeyTitle   = !epKey.match(/e(\d+)$/) ? nameLong : epKey
        let titleIdStr = ( titleId != argv.s ? `#${titleId}|` : '' ) + epKeyTitle;
        console.log(`[${titleIdStr}] ${showData.Episodes[i].Name}${selMark}${sumDub}${sumSub}`);
    }
    console.log();
    // select episodes
    if(selEpsArr.length>0){
        for(let s=0;s<selEpsArr.length;s++){
            let getVideoData = await reqData('GetVideos', {"VideoKey":selEpsArr[s].epKey,"TitleId":selEpsArr[s].titleId});
            if(getVideoData.ok){
                let videoData = JSON.parse(getVideoData.res.body);
                let ssNum = selEpsArr[s].epKey.match(/^s(\d+)/) ? parseInt(selEpsArr[s].epKey.match(/^s(\d+)/)[1]) : 1;
                let showTitle = ssNum > 1 ? `${showData.Name} S${ssNum}` : showData.Name;
                let epNum = selEpsArr[s].epKey.match(/e(\d+)$/) ? ('0'+selEpsArr[s].epKey.match(/e(\d+)$/)[1]).slice(-2) : selEpsArr[s].nameLong.toUpperCase();
                console.log(`[INFO] ${showTitle} - ${epNum}`);
                // set customs
                fnTitle = argv.title ? argv.title : showTitle;
                fnEpNum = selEpsArr.length < 2 && argv.ep ? argv.ep : epNum;
                // --
                let videoList = videoData.Data.VideoLanguages;
                let subsList  = videoData.Data.CaptionLanguages;
                console.log(`[INFO] Available dubs and subtitles:`);
                console.log(`\tVideos: `+videoList.join('\n\t\t'));
                console.log(`\tSubs  : `+subsList.join('\n\t\t'));
                console.log(`[INFO] Selected dub: ${langCode[argv.dub]}`);
                let videoUrls = videoData.Data.VideoUrls, videoUrl  = ``;
                let subsUrls  = videoData.Data.CaptionVttUrls;
                fontSize = videoData.Data.FontSize ? videoData.Data.FontSize : fontSize;
                let videoSel  = videoList.filter( v => v.match(langCode[argv.dub]) );
                if(videoSel.length===0){
                    console.log(`[ERROR] Selected dub not found!\n`);
                }
                else if(videoSel.length===1){
                    videoUrl = videoUrls[videoSel[0]].hls[0];
                    console.log(`[INFO] Selected release: ${videoSel[0].split(',')[1].trim()}`);
                    await downloadMedia(videoUrl,subsUrls,videoData.Data.FontSize);
                }
                else if(videoSel.length===2){
                    if(argv.br){
                        videoUrl = videoUrls[videoSel.filter(v=>v.match(/Broadcast/))[0]].hls[0];
                        console.log(`[INFO] Selected release: Broadcast`);
                        await downloadMedia(videoUrl,subsUrls,videoData.Data.FontSize);
                    }
                    else{
                        videoUrl = videoUrls[videoSel.filter(v=>v.match(/Home Video/))[0]].hls[0];
                        console.log(`[INFO] Selected release: Home Video`);
                        await downloadMedia(videoUrl,subsUrls,videoData.Data.FontSize);
                    }
                }
            }
        }
    }
    else{
        console.log(`[INFO] Episodes not selected!`);
    }
}

async function getStream(data){
    if(argv.skipdl){
        return { ok: true };
    }
    else{
        return await streamdl(data);
    }
}

async function downloadMedia(videoUrl,subsUrls,fontSize){
    let getVideoQualities = await getData(videoUrl);
    if(!getVideoQualities.ok){return;}
    let s = m3u8(getVideoQualities.res.body).playlists;
    let pls = {};
    console.log(`[INFO] Available qualities:`);
    for(let i=0;i<s.length;i++){
        let qs = s[i].attributes.RESOLUTION.height+'p';
        let qb = Math.round(s[i].attributes.BANDWIDTH/1024);
        console.log(`\t${qs} @ ${qb}kbps`+(qs==argv.q?` (selected)`:``));
        if(qs==argv.q){
            tsDlPath = s[i].uri;
        }
    }
    console.log();
    if(!tsDlPath){
        console.log(`\n[ERROR] Selected video quality not found!\n`)
    }
    else{
        // video download
        let reqVid = await getData(tsDlPath);
        if(!reqVid.ok){return;}
        
        let chunkList = m3u8(reqVid.res.body);
        chunkList.baseUrl = tsDlPath.split('/').slice(0, -1).join('/')+'/';
        fnSuffix = argv.suffix.replace('SIZEp',argv.q);
        fnOutput = shlp.cleanupFilename(`[${argv.a}] ${fnTitle} - ${fnEpNum} [${fnSuffix}]`);
        
        let subsMargin = 0;
        if(chunkList.segments[0].uri.match(/\/bumpers\//)){
            subsMargin = chunkList.segments[0].duration;
            chunkList.segments.splice(0, 1);
        }
        
        let proxyHLS;
        if(argv.proxy && !argv.ssp){
            try{
                proxyHLS.url = buildProxyUrl(argv.proxy,argv['proxy-auth']);
            }
            catch(e){}
        }
        let dldata = await getStream({
            fn: fnOutput,
            m3u8json: chunkList,
            baseurl: chunkList.baseUrl,
            pcount: 10,
            proxy: (proxyHLS?proxyHLS:false)
        });
        if(!dldata.ok){
            console.log(`[ERROR] ${dldata.err}\n`);
            return;
        }
        if(argv.skipdl){
            console.log(`[INFO] Video download skiped!\n`);
            argv.nosubs = false;
        }
        else{
            console.log(`[INFO] Video downloaded!\n`);
        }
        // stag
        argv.stag = argv.stag ? argv.stag : argv.a;
        argv.stag = shlp.cleanupFilename(argv.stag);
        // subs download
        let subsLangArr = Object.keys(subsUrls);
        sxList = [];
        argv.nosubs = argv.dub == 'jpn' ? false : argv.nosubs;
        if(!argv.nosubs && subsLangArr.length > 0){
            for(let z=0; z<subsLangArr.length; z++){
                let vttStr = '', cssStr = '', assStr = '', assExt = 'ass';
                let subs4XUrl = subsUrls[subsLangArr[z]].split('/');
                subsXUrl = subs4XUrl[subs4XUrl.length-1].replace(/.vtt$/,'');
                let getCssContent = await getData(genSubsUrl('css', subsXUrl));
                let getVttContent = await getData(genSubsUrl('vtt', subsXUrl));
                if(getCssContent.ok && getVttContent.ok){
                    let subFn = `${fnOutput}.${subsLangArr[z]}`;
                    cssStr = getCssContent.res.body;
                    vttStr = getVttContent.res.body;
                    assStr = vtt(argv.stag, fontSize, vttStr, cssStr, subsMargin, argv.rfont);
                    fs.writeFileSync(`${subFn}.${assExt}`, assStr,'utf8');
                    sxList.push({
                        file: `${subFn}.${assExt}`,
                        language: subsLangArr[z],
                        langCode: getLangCode(subsLangArr[z]),
                        isCaps: subsLangArr[z].match(/caps$/i) ? true : false
                    });
                    console.log(`[INFO] Subtitle downloaded and converted: ${subFn}.${assExt}`);
                }
            }
        }
        // go to muxing
        if(argv.skipdl){
            console.log();
            return;
        }
        await muxStreams();
    }
}

function getLangCode(lang){
    for (k in langCode) {
        let r = new RegExp(langCode[k], 'i');
        if (r.test(lang)) {
            return k.match(/-/) ? k.split('-')[0] : k;
        }
    }
    return 'unk';
}

function genSubsUrl(type, file){
    return [
        `${api.wwwhost}/caption/${type}/`,
        ( type == 'css' ? '?id=' : '' ),
        `${file}.${type}`
    ].join('');
}

async function muxStreams(){
    // fix variables
    argv.dub = argv.dub.match('-') ? argv.dub.split('-')[0] : argv.dub;
    const addSubs = argv.mks && sxList.length > 0 && !argv.mp4 ? true : false;
    // ftag
    argv.ftag = argv.ftag ? argv.ftag : argv.a;
    argv.ftag = shlp.cleanupFilename(argv.ftag); 
    // check exec
    if( !argv.mp4 && !isFile(cfg.bin.mkvmerge) && !isFile(cfg.bin.mkvmerge+`.exe`) ){
        console.log(`[WARN] MKVMerge not found, skip using this...`);
        cfg.bin.mkvmerge = false;
    }
    if( !isFile(cfg.bin.ffmpeg) && !isFile(cfg.bin.ffmpeg+`.exe`) ){
        console.log((cfg.bin.mkvmerge?`\n`:``)+`[WARN] FFmpeg not found, skip using this...`);
        cfg.bin.ffmpeg = false;
    }
    // mux to mkv
    if(!argv.mp4 && cfg.bin.mkvmerge){
        let mkvmux  = [];
        // defaults
        mkvmux.push(`--output`,`${fnOutput}.mkv`);
        mkvmux.push(`--disable-track-statistics-tags`,`--engage`,`no_variable_data`);
        // video
        mkvmux.push(`--track-name`,`1:[${argv.ftag}]`);
        mkvmux.push(`--language`,`0:${argv.dub}`);
        mkvmux.push(`--video-tracks`,`1`,`--audio-tracks`,`0`);
        mkvmux.push(`--no-subtitles`,`--no-attachments`);
        mkvmux.push(`${fnOutput}.ts`);
        // subtitles
        if(addSubs){
            for(let t in sxList){
                if(capsOpt(sxList[t].isCaps)){
                    mkvmux.push(`--track-name`,`0:${sxList[t].language}`);
                    mkvmux.push(`--language`,`0:${sxList[t].langCode}`);
                    mkvmux.push(`${sxList[t].file}`);
                }
            }
        }
        fs.writeFileSync(`${fnOutput}.json`,JSON.stringify(mkvmux,null,'  '));
        shlp.exec(`mkvmerge`,`"${cfg.bin.mkvmerge}"`,`@"${fnOutput}.json"`);
        fs.unlinkSync(`${fnOutput}.json`);
    }
    else if(cfg.bin.ffmpeg){
        let ffsubs = {fsubs:'',meta1:'',meta2:''};
        if(addSubs){
            for(let t in sxList){
                if(capsOpt(sxList[t].isCaps)){
                    ffsubs.fsubs += `-i "${sxList[t].file}" `
                    ffsubs.meta1 += `-map ${(parseInt(t)+1)} -c:s copy `;
                    ffsubs.meta2 += `-metadata:s:s:${(t)} title="${sxList[t].language}" -metadata:s:s:${(t)} language=${sxList[t].langCode} `;
                }
            }
        }
        let ffext = !argv.mp4 ? `mkv` : `mp4`;
        let ffmux = `-i "${fnOutput}.ts" `;
            ffmux += ffsubs.fsubs;
            ffmux += `-map 0 -c:v copy -c:a copy `;
            ffmux += ffsubs.meta1;
            ffmux += `-metadata encoding_tool="no_variable_data" `;
            ffmux += `-metadata:s:v:0 title="[${argv.ftag}]" -metadata:s:a:0 language=${argv.dub} `;
            ffmux += ffsubs.meta2;
            ffmux += `"${fnOutput}.${ffext}"`;
        // mux to mkv
        try{ shlp.exec(`ffmpeg`,`"${cfg.bin.ffmpeg}"`,ffmux); }catch(e){}
    }
    else{
        console.log(`\n[INFO] Done!\n`);
        return;
    }
    if(argv.nocleanup){
        fs.renameSync(fnOutput+`.ts`, path.join(cfg.dir.trash,`/${fnOutput}.ts`));
        if(addSubs){
            for(let t in sxList){
                fs.renameSync(sxList[t].file, path.join(cfg.dir.trash,`/${sxList[t].file}`));
            }
        }
    }
    else{
        fs.unlinkSync(fnOutput+`.ts`);
        if(addSubs){
            for(let t in sxList){
                fs.unlinkSync(sxList[t].file);
            }
        }
    }
    console.log(`\n[INFO] Done!\n`);
}

function capsOpt(isCaps){
    return !argv.caps 
        || argv.caps &&  isCaps && argv.dub != 'jpn'
        || argv.caps && !isCaps && argv.dub == 'jpn'
        ? true : false;
}

function isFile(file){
    try{
        const isFile = fs.statSync(file).isFile();
        return isFile;
    }
    catch(e){
        return false;
    }
}

// Generate Nonce
function generateNonce(){
    const initDate      = new Date();
    const nonceDate     = [
        initDate.getUTCFullYear().toString().slice(-2), // yy
        ('0'+(initDate.getUTCMonth()+1)).slice(-2),     // MM
        ('0'+initDate.getUTCDate()).slice(-2),          // dd
        ('0'+initDate.getUTCHours()).slice(-2),         // HH
        ('0'+initDate.getUTCMinutes()).slice(-2)        // mm
    ].join(''); // => "yyMMddHHmm" (UTC)
    const nonceCleanStr = nonceDate + api.apikey;
    const nonceHash     = crypto.createHash('sha256').update(nonceCleanStr).digest('hex');
    return nonceHash;
}

// Generate Signature
function generateSignature(body,visitId,profile){
    const sigCleanStr = [
        client.ipAddress,
        api.appId,
        profile.deviceId,
        visitId,
        profile.userId,
        profile.profileId,
        body,
        client.xNonce,
        api.apikey,
    ].join('');
    return crypto.createHash('sha256').update(sigCleanStr).digest('hex');
}

// getData
async function getData(reqUrl){
    return await reqData(reqUrl, '', 'GET');
}

// postApi
async function reqData(method, body, type){
    let options = { headers: {} };
    // get request type
    const isGet = type == 'GET' ? true : false;
    // set request type, url and user agent
    options.method  = isGet ? 'GET' : 'POST';
    options.url     = ( !isGet ? api.apihost + '/api/v1/' : '') + method;
    options.headers['user-agent'] = isGet ? api.clientExo : api.clientWeb;
    // set api data
    if(!isGet){
        options.body      = body == '' ? body : JSON.stringify(body);
        // set api headers
        if(method != 'Ping'){
            client.xNonce     = generateNonce();
            if(method == 'InitVisit'){
                client.xSignature = generateSignature(options.body,'',{
                    deviceId:  client.profile.deviceId,
                    userId:    0,
                    profileId: 0
                });
                options.headers = Object.assign(options.headers, {
                    'X-VisitId'      : '',
                    'X-UserId'       : 0,
                    'X-ProfileId'    : 0,
                });
            }
            else{
                client.xSignature = generateSignature(options.body,client.visitId,client.profile);
                options.headers = Object.assign(options.headers, {
                    'X-VisitId'      : client.visitId,
                    'X-UserId'       : client.profile.userId,
                    'X-ProfileId'    : client.profile.profileId,
                });
            }
            options.headers = Object.assign(options.headers, {
                'X-DeviceId'     : client.profile.deviceId,
                'X-Nonce'        : client.xNonce,
                'X-Signature'    : client.xSignature,
            });
        }
        options.headers = Object.assign({
            'Content-Type'   : 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-ApplicationId': api.appId,
        }, options.headers);
        // cookies
        let cookiesList    = Object.keys(session);
        if(cookiesList.length > 0){
            if(method == 'Ping'){
                options.headers.Cookie = shlp.cookie.make(session,cookiesList);
            }
        }
    }
    else if(isGet && !options.url.match(/\?/)){
        client.xNonce     = generateNonce();
        client.xSignature = generateSignature(options.body,client.visitId,client.profile);
        options.url = options.url + '?' + (new URLSearchParams({
            'X-ApplicationId': api.appId,
            'X-DeviceId'     : client.profile.deviceId,
            'X-VisitId'      : client.visitId,
            'X-UserId'       : client.profile.userId,
            'X-ProfileId'    : client.profile.profileId,
            'X-Nonce'        : client.xNonce,
            'X-Signature'    : client.xSignature,
        })).toString();
    }
    // check m3u8 request and ssp param
    let useProxy = isGet && argv.ssp && options.url.match(/\.m3u8/) ? false : true;
    // set proxy
    if(useProxy && argv.proxy){
        try{
            let proxyUrl = buildProxyUrl(argv.proxy,argv['proxy-auth']);
            options.agent = new ProxyAgent(proxyUrl);
            options.timeout = 10000;
        }
        catch(e){
            console.log(`[WARN] Not valid proxy URL${e.input?' ('+e.input+')':''}!`);
            console.log(`[WARN] Skiping...\n`);
        }
    }
    try{
        if(argv.debug){
            console.log(`[DEBUG] Request params:`);
            console.log(options);
        }
        let res = await got(options);
        if(!isGet && res.headers && res.headers['set-cookie']){
            const newReqCookies = shlp.cookie.parse(res.headers['set-cookie']);
            delete newReqCookies['.AspNet.ApplicationCookie'];
            delete newReqCookies['.AspNet.ExternalCookie'];
            session = Object.assign(session, newReqCookies);
            if(session.VisitId || session.UserStatus || session.Visitor){
                fs.writeFileSync(sessionFile,yaml.stringify(session));
            }
        }
        if(!isGet){
            const resJ = JSON.parse(res.body);
            if(resJ.Code > 0){
                console.log(`[ERROR] Code ${resJ.Code} (${resJ.Status}): ${resJ.Message}\n`);
                if(resJ.Code == 81 || resJ.Code == 5){
                    console.log(`[NOTE] App was broken because of changes in official app.`);
                    console.log(`[NOTE] See: https://github.com/seiya-dev/hidive-downloader-nx/issues/14\n`);
                }
                if(resJ.Code == 55){
                    console.log(`[NOTE] You need premium account to view this video.`);
                }
                return {
                    ok: false,
                    res,
                };
            }
        }
        return {
            ok: true,
            res,
        };
    }
    catch(error){
        if(error.statusCode && error.statusMessage){
            console.log(`\n[ERROR] ${error.name} ${error.statusCode}: ${error.statusMessage}\n`);
        }
        else{
            console.log(`\n[ERROR] ${error.name}: ${error.code}\n`);
        }
        return {
            ok: false,
            error,
        };
    }
}

// make proxy url
function buildProxyUrl(proxyBaseUrl,proxyAuth){
    let proxyCfg = new URL(proxyBaseUrl);
    if(!proxyCfg.hostname || !proxyCfg.port){
        throw new Error();
    }
    if(proxyAuth && proxyAuth.match(':')){
        proxyCfg.auth = proxyAuth;
    }
    return url.format({
        protocol: proxyCfg.protocol,
        slashes: true,
        auth: proxyCfg.auth,
        hostname: proxyCfg.hostname,
        port: proxyCfg.port,
    });
}
